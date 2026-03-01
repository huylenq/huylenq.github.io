import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";
import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkRehype from "remark-rehype";
import rehypeStringify from "rehype-stringify";
import type {
  NoteGraph,
  NoteApiResponse,
  BacklinkEntry,
  PublicNote,
} from "../src/lib/types.js";

// ── Configuration ──────────────────────────────────────────────

const VAULT_PATH =
  process.env.VAULT_PATH ??
  "/Users/huy/Library/Mobile Documents/iCloud~md~obsidian/Documents/IWE";
const PROJECT_ROOT = path.resolve(import.meta.dirname, "..");
const CONTENT_NOTES_DIR = path.join(PROJECT_ROOT, "content", "notes");
const API_NOTES_DIR = path.join(PROJECT_ROOT, "public", "api", "notes");
const NOTE_ASSETS_DIR = path.join(PROJECT_ROOT, "public", "note-assets");

const SKIP_DIRS = new Set(["node_modules"]);

// ── Types ──────────────────────────────────────────────────────

interface VaultNote {
  title: string;
  vaultPath: string;
  rawContent: string;
  frontmatter: Record<string, unknown>;
}

// ── Step 1: Scan vault for public notes ────────────────────────

function scanVault(): {
  publicNotes: Map<string, VaultNote>;
  filenameToId: Map<string, string>;
} {
  const publicNotes = new Map<string, VaultNote>();
  const filenameToId = new Map<string, string>();
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
      // Malformed frontmatter — skip, it can't be a valid public note
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
    const existing = publicNotes.get(publishId);
    if (existing) {
      console.error(
        `FATAL: publish-id "${publishId}" is used by multiple notes:`
      );
      console.error(`  1. ${existing.vaultPath}`);
      console.error(`  2. ${filePath}`);
      process.exit(1);
    }

    const title = path.basename(filePath, ".md");
    publicNotes.set(publishId, {
      title,
      vaultPath: filePath,
      rawContent: content, // gray-matter already strips frontmatter from `content`
      frontmatter: fm,
    });
    filenameToId.set(title, publishId);
  }

  return { publicNotes, filenameToId };
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
  /** publish-ids of outgoing links to other public notes */
  outgoingLinks: Set<string>;
}

function transformNote(
  note: VaultNote,
  filenameToId: Map<string, string>,
  publishId: string
): TransformResult {
  let md = note.rawContent;
  const outgoingLinks = new Set<string>();

  // Strip %%comment%% blocks
  md = md.replace(/%%[\s\S]*?%%/g, "");

  // Strip ```dataview fenced blocks
  md = md.replace(/```dataview[\s\S]*?```/g, "");

  // Strip ```ad-* admonition blocks
  md = md.replace(/```ad-[\w-]+[\s\S]*?```/g, "");

  // Convert ![[embed]] transclusion → [[embed]] (remove the !)
  // But NOT image embeds like ![[image.png]] — those are handled separately
  md = md.replace(/!\[\[([^\]]+)\]\]/g, (match, inner: string) => {
    if (isImageFile(inner)) return match; // keep image embeds for later processing
    return `[[${inner}]]`;
  });

  // Resolve image/attachment references: ![[image.png]]
  md = md.replace(/!\[\[([^\]|]+?)(\|[^\]]*)?\]\]/g, (_match, filename: string) => {
    const resolved = resolveAttachment(filename.trim(), note.vaultPath, publishId);
    if (resolved) return `![${filename}](${resolved})`;
    return `![${filename}](${filename})`; // leave broken
  });

  // Resolve markdown-style image references: ![alt](path)
  md = md.replace(
    /!\[([^\]]*)\]\((?!https?:\/\/)([^)]+)\)/g,
    (_match, alt: string, srcPath: string) => {
      const resolved = resolveAttachment(
        path.basename(srcPath),
        note.vaultPath,
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
      return `[${displayText}](/${targetId})`;
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
  notePath: string,
  publishId: string
): string | null {
  const noteDir = path.dirname(notePath);
  const candidates = [
    path.join(noteDir, filename),
    path.join(noteDir, "attachments", filename),
    path.join(VAULT_PATH, "attachments", filename),
    path.join(VAULT_PATH, "assets", filename),
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      const destDir = path.join(NOTE_ASSETS_DIR, publishId);
      fs.mkdirSync(destDir, { recursive: true });
      fs.copyFileSync(candidate, path.join(destDir, filename));
      return `/note-assets/${publishId}/${filename}`;
    }
  }
  return null;
}

// ── Step 3: Build backlink graph ───────────────────────────────

function buildGraph(
  publicNotes: Map<string, VaultNote>,
  linkMap: Map<string, Set<string>>,
  transformedMarkdown: Map<string, string>
): NoteGraph {
  // linkMap: sourceId → Set<targetId>
  // Invert to get backlinks: targetId → Set<sourceId>
  const backlinksMap = new Map<string, BacklinkEntry[]>();

  for (const [sourceId, targets] of linkMap) {
    const sourceNote = publicNotes.get(sourceId)!;
    const sourceMd = transformedMarkdown.get(sourceId)!;

    for (const targetId of targets) {
      const targetNote = publicNotes.get(targetId);
      if (!targetNote) continue; // safety

      const context = extractContext(sourceMd, targetNote.title, targetId);
      const entry: BacklinkEntry = {
        slug: sourceId,
        title: sourceNote.title,
        context,
      };

      const existing = backlinksMap.get(targetId) ?? [];
      existing.push(entry);
      backlinksMap.set(targetId, existing);
    }
  }

  const graph: NoteGraph = {};
  for (const [id, note] of publicNotes) {
    const publicNote: PublicNote = {
      slug: id,
      title: note.title,
      backlinks: backlinksMap.get(id) ?? [],
    };
    graph[id] = publicNote;
  }

  return graph;
}

function extractContext(
  markdown: string,
  targetTitle: string,
  targetId: string
): string {
  const paragraphs = markdown.split(/\n\n+/);

  // Look for a paragraph containing a link to the target (by slug or title)
  for (const para of paragraphs) {
    if (para.includes(`(/${targetId})`) || para.includes(targetTitle)) {
      const cleaned = para.replace(/\n/g, " ").trim();
      if (cleaned.length <= 200) return cleaned;
      return cleaned.slice(0, 197) + "...";
    }
  }
  return "";
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
  for (const dir of [CONTENT_NOTES_DIR, API_NOTES_DIR, NOTE_ASSETS_DIR]) {
    fs.rmSync(dir, { recursive: true, force: true });
    fs.mkdirSync(dir, { recursive: true });
  }
}

async function writeOutputs(
  publicNotes: Map<string, VaultNote>,
  transformedMarkdown: Map<string, string>,
  graph: NoteGraph
) {
  for (const [id, note] of publicNotes) {
    const md = transformedMarkdown.get(id)!;
    const backlinks = graph[id]?.backlinks ?? [];

    // content/notes/{publish-id}.md
    const contentMd = [
      "---",
      `title: "${note.title.replace(/"/g, '\\"')}"`,
      `slug: "${id}"`,
      "---",
      md,
    ].join("\n");
    fs.writeFileSync(path.join(CONTENT_NOTES_DIR, `${id}.md`), contentMd);
    console.log(`  Writing ${id}...`);

    // public/api/notes/{publish-id}.json
    const html = await renderMarkdownToHtml(md);
    const apiResponse: NoteApiResponse = {
      slug: id,
      title: note.title,
      html,
      backlinks,
    };
    fs.writeFileSync(
      path.join(API_NOTES_DIR, `${id}.json`),
      JSON.stringify(apiResponse, null, 2)
    );
  }

  // content/notes/_graph.json
  fs.writeFileSync(
    path.join(CONTENT_NOTES_DIR, "_graph.json"),
    JSON.stringify(graph, null, 2)
  );
}

// ── Main ───────────────────────────────────────────────────────

async function main() {
  console.log(`Scanning vault: ${VAULT_PATH}`);

  const { publicNotes, filenameToId } = scanVault();
  console.log(`Found ${publicNotes.size} public notes.`);

  cleanOutputDirs();

  if (publicNotes.size === 0) {
    const emptyGraph: NoteGraph = {};
    fs.writeFileSync(
      path.join(CONTENT_NOTES_DIR, "_graph.json"),
      JSON.stringify(emptyGraph, null, 2)
    );
    console.log("No public notes found. Wrote empty graph. Done!");
    return;
  }

  // Transform all notes
  const transformedMarkdown = new Map<string, string>();
  const linkMap = new Map<string, Set<string>>();

  for (const [id, note] of publicNotes) {
    const { markdown, outgoingLinks } = transformNote(note, filenameToId, id);
    transformedMarkdown.set(id, markdown);
    linkMap.set(id, outgoingLinks);
  }

  // Build backlink graph
  const graph = buildGraph(publicNotes, linkMap, transformedMarkdown);

  // Write outputs
  await writeOutputs(publicNotes, transformedMarkdown, graph);

  console.log("Done!");
}

main().catch((err) => {
  console.error("Publish failed:", err);
  process.exit(1);
});
