# huylenq.com

Personal website for Huy — an Andy Matuschak-style stacked-panes notes system publishing Obsidian notes.

## Architecture

**Stack:** Astro (static) + React islands (stacked panes) → GitHub Pages

**Pipeline:** Obsidian vault → `scripts/publish.ts` → `content/notes/` + `public/api/notes/` → `astro build` → static HTML

```
Obsidian vault (iCloud)
    ↓  [npm run publish]  scans for #public + publish-id
content/notes/*.md + public/api/notes/*.json + _graph.json
    ↓  [npm run build]    Astro static build
dist/ → GitHub Pages (huylenq.com)
```

## Key Commands

```bash
npm run publish    # vault → content/ + public/api/ (run locally, vault not in CI)
npm run dev        # astro dev server at localhost:4321
npm run build      # astro build → dist/
npm run preview    # serve dist/ locally
```

Deploy workflow: `npm run publish && git add content/ public/api/ public/note-assets/ && git commit && git push`

## Project Structure

```
├── scripts/publish.ts          # Vault scanner + markdown transformer + backlink graph builder
├── astro.config.mjs            # Static output, React integration, legacy redirects
├── src/
│   ├── content.config.ts       # Astro content collection (notes)
│   ├── lib/
│   │   ├── types.ts            # Shared interfaces: PublicNote, NoteGraph, BacklinkEntry, NoteApiResponse
│   │   └── notes.ts            # Client-side fetch utility
│   ├── components/
│   │   ├── StackedNotes.tsx    # React island: stacked panes with URL sync, link interception
│   │   ├── NotePane.tsx        # Single pane renderer
│   │   ├── Backlinks.tsx       # Collapsible backlinks section
│   │   └── Header.astro        # Site nav
│   ├── layouts/
│   │   ├── BaseLayout.astro    # HTML shell, loads Google Fonts + all CSS
│   │   └── PageLayout.astro    # Centered content wrapper with Header
│   ├── pages/
│   │   ├── index.astro         # Homepage: intro + note list from _graph.json
│   │   ├── [slug].astro        # Dynamic note route with StackedNotes React island
│   │   ├── cv.astro            # PDF embed + download
│   │   ├── sketches.astro      # Video gallery
│   │   └── about.astro         # Bio
│   └── styles/
│       ├── global.css          # Paper & Ink design system variables + base styles
│       ├── stacked-notes.css   # Pane layout, collapse, mobile
│       └── note.css            # Note content typography
├── content/notes/              # GENERATED — do not hand-edit
│   ├── _graph.json             # Public note graph (backlinks, titles)
│   └── *.md                    # Transformed notes with title + slug frontmatter
├── public/
│   ├── api/notes/*.json        # GENERATED — per-note JSON for client-side fetch
│   ├── note-assets/            # GENERATED — images copied from vault
│   ├── CNAME                   # huylenq.com
│   ├── assets/huy-cv.pdf
│   └── sketches/*.mp4
└── .github/workflows/deploy.yml
```

## Design System: Paper & Ink

Monochromatic, editorial aesthetic adapted from Hexos Lab. No accent colors — just ink on paper.

**Colors:** `--ink-black` (#1a1a1a) through `--ink-faint` (#b0b0b0) on `--paper` (#fdfcf9) / `--paper-aged` (#f8f6f1)

**Typography:** Crimson Pro (serif, body + headings) + Inter (sans, UI labels/nav). Body 18px, line-height 1.8, justified paragraphs with hyphens.

**Headings:** Serif, lightweight (400 weight). H2 is uppercase with bottom border.

**Links:** Ink-dark with thin underline, no color accent. Private links are dashed + dimmed.

**UI labels** (nav, pane titles, backlinks toggle): Inter, small caps, 0.75rem, letter-spaced, uppercase.

When adding new styles, use the `--ink-*` / `--paper-*` / `--space-*` variables. Do not introduce new colors.

## Publish Pipeline (scripts/publish.ts)

The pipeline reads from the vault at `VAULT_PATH` env var (defaults to Huy's iCloud vault path).

**Privacy invariants — non-negotiable:**
1. Only notes with `tags: [public]` AND `publish-id` in frontmatter are processed
2. Wikilinks to non-public notes → `<span class="private-link">` (no href)
3. Backlink graph is public-to-public only
4. Context excerpts come only from public note content
5. All private frontmatter stripped (sr-due, sr-interval, etc.)
6. `%%comments%%`, dataview blocks, ad-* blocks stripped
7. No vault paths leak — only publish-id slugs

## Obsidian Plugin (separate repo)

The `public-notes` plugin lives at `/Users/huy/src/iPKM/public-notes/`. It adds a "Toggle public" command that assigns a `publish-id` (UUID) and toggles the `public` tag in frontmatter.

## Stacked Panes Behavior

- Desktop: horizontal scroll container, 625px panes, earlier panes collapse to 40px strips
- Mobile (<768px): single pane with back button
- URL sync: `/{slug}?stacked=s1&stacked=s2`
- Link clicks intercepted via event delegation — only internal note links open as new panes
- First pane HTML comes from pre-rendered API JSON; subsequent panes fetched client-side

## Content Conventions

- Note slugs are human-readable for blog-migrated posts (`hello-world`, `trust`, `a-reading-system`)
- New notes from the plugin get UUID slugs
- The `content/notes/` and `public/api/notes/` directories are gitignored but committed when publishing
- `_graph.json` is the source of truth for the note index and backlinks
