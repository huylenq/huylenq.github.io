import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";
import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkRehype from "remark-rehype";
import rehypeStringify from "rehype-stringify";
import type {
  ThoughtGraph,
  ThoughtGraphFile,
  ThoughtEdge,
  ThoughtApiResponse,
  BacklinkEntry,
  PublicThought,
  Maturity,
} from "../src/lib/types.js";

// ── Configuration ──────────────────────────────────────────────

const VAULT_PATH =
  process.env.VAULT_PATH ??
  "/Users/huy/Library/Mobile Documents/iCloud~md~obsidian/Documents/IWE";
const PROJECT_ROOT = path.resolve(import.meta.dirname, "..");
const CONTENT_THOUGHTS_DIR = path.join(PROJECT_ROOT, "content", "thoughts");
const API_THOUGHTS_DIR = path.join(PROJECT_ROOT, "public", "api", "thoughts");
const THOUGHT_ASSETS_DIR = path.join(PROJECT_ROOT, "public", "thought-assets");

const REDIRECTS_FILE = path.join(CONTENT_THOUGHTS_DIR, "_redirects.json");

const SKIP_DIRS = new Set(["node_modules"]);

// ── Types ──────────────────────────────────────────────────────

type RedirectMap = Map<string, string>; // old-slug → current publish-id

const VALID_MATURITIES = new Set<Maturity>(["seed", "budding", "evergreen"]);

interface VaultThought {
  title: string;
  vaultPath: string;
  rawContent: string;
  frontmatter: Record<string, unknown>;
  maturity: Maturity;
}

// ── Step 1: Scan vault for public thoughts ────────────────────

function scanVault(): {
  publicThoughts: Map<string, VaultThought>;
  filenameToId: Map<string, string>;
  redirects: RedirectMap;
} {
  const publicThoughts = new Map<string, VaultThought>();
  const filenameToId = new Map<string, string>();
  const redirects: RedirectMap = new Map();
  const mdFiles = collectMarkdownFiles(VAULT_PATH);

  for (const filePath of mdFiles) {
    let raw: string;
    try {
      raw = fs.readFileSync(filePath, "utf-8");
    } catch {
      continue;
    }

    let fm: Record<string, unknown>;
    let content: string;
    try {
      const parsed = matter(raw);
      fm = parsed.data;
      content = parsed.content;
    } catch {
      // Malformed frontmatter — skip
      continue;
    }

    const tags: string[] = normalizeTags(fm.tags);
    const isPublic = tags.includes("public");
    if (!isPublic) continue;

    const publishId = fm["publish-id"] as string | undefined;
    if (!publishId) {
      console.error(
        `FATAL: Note "${filePath}" is tagged #public but has no publish-id.`
      );
      console.error(
        `  → Open the note in Obsidian and run the "Assign Publish ID" command.`
      );
      process.exit(1);
    }

    // Collision detection
    const existing = publicThoughts.get(publishId);
    if (existing) {
      console.error(
        `FATAL: publish-id "${publishId}" is used by multiple notes:`
      );
      console.error(`  1. ${existing.vaultPath}`);
      console.error(`  2. ${filePath}`);
      process.exit(1);
    }

    const rawMaturity = fm.maturity as string | undefined;
    const maturity: Maturity =
      rawMaturity && VALID_MATURITIES.has(rawMaturity as Maturity)
        ? (rawMaturity as Maturity)
        : "seed";

    const title = path.basename(filePath, ".md");
    publicThoughts.set(publishId, {
      title,
      vaultPath: filePath,
      rawContent: content, // gray-matter already strips frontmatter from `content`
      frontmatter: fm,
      maturity,
    });
    filenameToId.set(title, publishId);

    // Collect redirected-publish-ids
    const rawRedirects = fm["redirected-publish-ids"];
    if (rawRedirects) {
      const oldSlugs = Array.isArray(rawRedirects)
        ? rawRedirects.map(String)
        : [String(rawRedirects)];
      for (const oldSlug of oldSlugs) {
        const claimedBy = redirects.get(oldSlug);
        if (claimedBy) {
          console.error(
            `FATAL: redirected-publish-id "${oldSlug}" is claimed by multiple notes:`
          );
          console.error(`  1. publish-id "${claimedBy}"`);
          console.error(`  2. publish-id "${publishId}" (${filePath})`);
          process.exit(1);
        }
        redirects.set(oldSlug, publishId);
      }
    }
  }

  // Fail fast: old slug collides with an active publish-id
  for (const [oldSlug, claimedBy] of redirects) {
    if (publicThoughts.has(oldSlug)) {
      console.error(
        `FATAL: redirected-publish-id "${oldSlug}" (from "${claimedBy}") collides with an active publish-id.`
      );
      console.error(`  → The note "${publicThoughts.get(oldSlug)!.vaultPath}" uses "${oldSlug}" as its publish-id.`);
      process.exit(1);
    }
  }

  return { publicThoughts, filenameToId, redirects };
}

function collectMarkdownFiles(dir: string): string[] {
  const results: string[] = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.name.startsWith(".") || SKIP_DIRS.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...collectMarkdownFiles(full));
    } else if (entry.name.endsWith(".md")) {
      results.push(full);
    }
  }
  return results;
}

function normalizeTags(tags: unknown): string[] {
  if (Array.isArray(tags)) return tags.map(String);
  if (typeof tags === "string") return tags.split(/[,\s]+/).filter(Boolean);
  return [];
}

// ── Step 2: Transform markdown ─────────────────────────────────

interface TransformResult {
  markdown: string;
  /** publish-ids of outgoing links to other public thoughts */
  outgoingLinks: Set<string>;
}

function transformThought(
  thought: VaultThought,
  filenameToId: Map<string, string>,
  publishId: string
): TransformResult {
  let md = thought.rawContent;
  const outgoingLinks = new Set<string>();

  // Strip %%comment%% blocks
  md = md.replace(/%%[\s\S]*?%%/g, "");

  // Strip ```dataview fenced blocks
  md = md.replace(/```dataview[\s\S]*?```/g, "");

  // Strip ```ad-* admonition blocks
  md = md.replace(/```ad-[\w-]+[\s\S]*?```/g, "");

  // Strip block reference IDs (^block-id at end of lines)
  md = md.replace(/ +\^[\w-]+$/gm, "");

  // Convert ==highlight== to <mark>
  md = md.replace(/==(.*?)==/g, "<mark>$1</mark>");

  // Strip inline tags (#tag) — but not headings (# Heading)
  md = md.replace(/(^|\s)#([a-zA-Z][\w\/-]*)/gm, "$1");

  // Convert ![[embed]] transclusion → [[embed]] (remove the !)
  // But NOT image embeds like ![[image.png]] — those are handled separately
  md = md.replace(/!\[\[([^\]]+)\]\]/g, (match, inner: string) => {
    if (isImageFile(inner)) return match; // keep image embeds for later processing
    return `[[${inner}]]`;
  });

  // Resolve image/attachment references: ![[image.png]]
  md = md.replace(/!\[\[([^\]|]+?)(\|[^\]]*)?\]\]/g, (_match, filename: string) => {
    const resolved = resolveAttachment(filename.trim(), thought.vaultPath, publishId);
    if (resolved) return `![${filename}](${resolved})`;
    return `![${filename}](${filename})`; // leave broken
  });

  // Resolve markdown-style image references: ![alt](path)
  md = md.replace(
    /!\[([^\]]*)\]\((?!https?:\/\/)([^)]+)\)/g,
    (_match, alt: string, srcPath: string) => {
      const resolved = resolveAttachment(
        path.basename(srcPath),
        thought.vaultPath,
        publishId
      );
      if (resolved) return `![${alt}](${resolved})`;
      return `![${alt}](${srcPath})`; // leave as-is
    }
  );

  // Resolve [[wikilinks]]
  md = md.replace(/\[\[([^\]]+)\]\]/g, (_match, inner: string) => {
    const pipeIdx = inner.indexOf("|");
    const target = pipeIdx >= 0 ? inner.slice(0, pipeIdx).trim() : inner.trim();
    const alias = pipeIdx >= 0 ? inner.slice(pipeIdx + 1).trim() : undefined;

    // Strip any heading anchor (e.g. "Note#Section" → "Note")
    const targetBase = target.includes("#") ? target.split("#")[0] : target;
    const displayText = alias ?? target;
    const targetId = filenameToId.get(targetBase);

    if (targetId) {
      outgoingLinks.add(targetId);
      return `[${displayText}](/thoughts/${targetId})`;
    }
    return `<span class="private-link">${displayText}</span>`;
  });

  return { markdown: md, outgoingLinks };
}

const IMAGE_EXTS = new Set([
  ".png", ".jpg", ".jpeg", ".gif", ".svg", ".webp", ".bmp", ".ico", ".avif",
]);

function isImageFile(name: string): boolean {
  const ext = path.extname(name).toLowerCase();
  return IMAGE_EXTS.has(ext);
}

function resolveAttachment(
  filename: string,
  thoughtPath: string,
  publishId: string
): string | null {
  const thoughtDir = path.dirname(thoughtPath);
  const candidates = [
    path.join(thoughtDir, filename),
    path.join(thoughtDir, "attachments", filename),
    path.join(VAULT_PATH, "attachments", filename),
    path.join(VAULT_PATH, "assets", filename),
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      const destDir = path.join(THOUGHT_ASSETS_DIR, publishId);
      fs.mkdirSync(destDir, { recursive: true });
      fs.copyFileSync(candidate, path.join(destDir, filename));
      return `/thought-assets/${publishId}/${filename}`;
    }
  }
  return null;
}

// ── Step 3: Build backlink graph ───────────────────────────────

async function buildGraph(
  publicThoughts: Map<string, VaultThought>,
  linkMap: Map<string, Set<string>>,
  transformedMarkdown: Map<string, string>
): Promise<{ graph: ThoughtGraph; edges: ThoughtEdge[] }> {
  // linkMap: sourceId → Set<targetId>
  // Invert to get backlinks: targetId → Set<sourceId>
  const backlinksMap = new Map<string, BacklinkEntry[]>();
  const edges: ThoughtEdge[] = [];

  for (const [sourceId, targets] of linkMap) {
    const sourceThought = publicThoughts.get(sourceId)!;
    const sourceMd = transformedMarkdown.get(sourceId)!;

    for (const targetId of targets) {
      const targetThought = publicThoughts.get(targetId);
      if (!targetThought) continue; // safety

      edges.push({ source: sourceId, target: targetId });

      const contextMd = extractContext(sourceMd, targetThought.title, targetId);
      const context = contextMd
        ? await renderMarkdownToHtml(contextMd)
        : "";
      const entry: BacklinkEntry = {
        slug: sourceId,
        title: sourceThought.title,
        context,
      };

      const existing = backlinksMap.get(targetId) ?? [];
      existing.push(entry);
      backlinksMap.set(targetId, existing);
    }
  }

  const graph: ThoughtGraph = {};
  for (const [id, thought] of publicThoughts) {
    const publicThought: PublicThought = {
      slug: id,
      title: thought.title,
      backlinks: backlinksMap.get(id) ?? [],
      maturity: thought.maturity,
    };
    graph[id] = publicThought;
  }

  return { graph, edges };
}

const CONTEXT_WINDOW = 200;

function extractContext(
  markdown: string,
  _targetTitle: string,
  targetId: string
): string {
  const paragraphs = markdown.split(/\n\n+/);
  const linkPattern = `(/thoughts/${targetId})`;

  for (const para of paragraphs) {
    if (!para.includes(linkPattern)) continue;

    const cleaned = para.replace(/\n/g, " ").trim();
    if (cleaned.length <= CONTEXT_WINDOW) return cleaned;

    // Find the markdown link and center the window on it
    const linkRegex = new RegExp(
      `\\[([^\\]]+)\\]\\(/thoughts/${escapeRegex(targetId)}\\)`
    );
    const match = linkRegex.exec(cleaned);
    if (!match) {
      // Link pattern exists but regex didn't match — fall back to start
      return cleaned.slice(0, CONTEXT_WINDOW - 3) + "...";
    }

    const linkStart = match.index;
    const linkEnd = linkStart + match[0].length;
    const linkLen = linkEnd - linkStart;

    // Budget the remaining chars equally before and after the link
    const budget = CONTEXT_WINDOW - linkLen;
    const halfBudget = Math.floor(budget / 2);

    let windowStart = linkStart - halfBudget;
    let windowEnd = linkEnd + halfBudget;

    // Clamp and redistribute if we hit a boundary
    if (windowStart < 0) {
      windowEnd = Math.min(cleaned.length, windowEnd + (-windowStart));
      windowStart = 0;
    }
    if (windowEnd > cleaned.length) {
      windowStart = Math.max(0, windowStart - (windowEnd - cleaned.length));
      windowEnd = cleaned.length;
    }

    // Snap to word boundaries
    if (windowStart > 0) {
      const spaceIdx = cleaned.indexOf(" ", windowStart);
      if (spaceIdx !== -1 && spaceIdx < linkStart) windowStart = spaceIdx + 1;
    }
    if (windowEnd < cleaned.length) {
      const spaceIdx = cleaned.lastIndexOf(" ", windowEnd);
      if (spaceIdx > linkEnd) windowEnd = spaceIdx;
    }

    let snippet = cleaned.slice(windowStart, windowEnd);
    if (windowStart > 0) snippet = "..." + snippet;
    if (windowEnd < cleaned.length) snippet = snippet + "...";

    return snippet;
  }
  return "";
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// ── Step 4: Write outputs ──────────────────────────────────────

async function renderMarkdownToHtml(md: string): Promise<string> {
  const result = await unified()
    .use(remarkParse)
    .use(remarkRehype, { allowDangerousHtml: true })
    .use(rehypeStringify, { allowDangerousHtml: true })
    .process(md);
  return String(result);
}

function cleanOutputDirs() {
  for (const dir of [CONTENT_THOUGHTS_DIR, API_THOUGHTS_DIR, THOUGHT_ASSETS_DIR]) {
    fs.rmSync(dir, { recursive: true, force: true });
    fs.mkdirSync(dir, { recursive: true });
  }
}

async function writeOutputs(
  publicThoughts: Map<string, VaultThought>,
  transformedMarkdown: Map<string, string>,
  graph: ThoughtGraph,
  edges: ThoughtEdge[],
  redirects: RedirectMap
) {
  for (const [id, thought] of publicThoughts) {
    const md = transformedMarkdown.get(id)!;
    const backlinks = graph[id]?.backlinks ?? [];

    // content/thoughts/{publish-id}.md
    const contentMd = [
      "---",
      `title: "${thought.title.replace(/"/g, '\\"')}"`,
      `slug: "${id}"`,
      `maturity: "${thought.maturity}"`,
      "---",
      md,
    ].join("\n");
    fs.writeFileSync(path.join(CONTENT_THOUGHTS_DIR, `${id}.md`), contentMd);
    console.log(`  Writing ${id}...`);

    // public/api/thoughts/{publish-id}.json
    const html = await renderMarkdownToHtml(md);
    const apiResponse: ThoughtApiResponse = {
      slug: id,
      title: thought.title,
      html,
      backlinks,
      maturity: thought.maturity,
    };
    fs.writeFileSync(
      path.join(API_THOUGHTS_DIR, `${id}.json`),
      JSON.stringify(apiResponse, null, 2)
    );
  }

  // content/thoughts/_graph.json
  const graphFile: ThoughtGraphFile = { thoughts: graph, edges };
  fs.writeFileSync(
    path.join(CONTENT_THOUGHTS_DIR, "_graph.json"),
    JSON.stringify(graphFile, null, 2)
  );

  // content/thoughts/_redirects.json
  const redirectEntries: Record<string, string> = {};
  for (const [oldSlug, currentId] of redirects) {
    redirectEntries[`/thoughts/${oldSlug}`] = `/thoughts/${currentId}`;
  }
  fs.writeFileSync(REDIRECTS_FILE, JSON.stringify(redirectEntries, null, 2));
  if (redirects.size > 0) {
    console.log(`  Wrote ${redirects.size} redirect(s) to _redirects.json`);
  }
}

// ── Main ───────────────────────────────────────────────────────

async function main() {
  console.log(`Scanning vault: ${VAULT_PATH}`);

  const { publicThoughts, filenameToId, redirects } = scanVault();
  console.log(`Found ${publicThoughts.size} public thoughts.`);

  cleanOutputDirs();

  if (publicThoughts.size === 0) {
    const emptyGraphFile: ThoughtGraphFile = { thoughts: {}, edges: [] };
    fs.writeFileSync(
      path.join(CONTENT_THOUGHTS_DIR, "_graph.json"),
      JSON.stringify(emptyGraphFile, null, 2)
    );
    fs.writeFileSync(REDIRECTS_FILE, JSON.stringify({}, null, 2));
    console.log("No public thoughts found. Wrote empty graph. Done!");
    return;
  }

  // Transform all thoughts
  const transformedMarkdown = new Map<string, string>();
  const linkMap = new Map<string, Set<string>>();

  for (const [id, thought] of publicThoughts) {
    const { markdown, outgoingLinks } = transformThought(thought, filenameToId, id);
    transformedMarkdown.set(id, markdown);
    linkMap.set(id, outgoingLinks);
  }

  // Build backlink graph
  const { graph, edges } = await buildGraph(publicThoughts, linkMap, transformedMarkdown);

  // Write outputs
  await writeOutputs(publicThoughts, transformedMarkdown, graph, edges, redirects);

  console.log("Done!");
}

main().catch((err) => {
  console.error("Publish failed:", err);
  process.exit(1);
});
