# huylenq.com

Personal website for Huy — an Andy Matuschak-style stacked-panes thoughts system publishing Obsidian notes.

## Architecture

**Stack:** Astro (static) + React islands (stacked panes) → GitHub Pages

**Pipeline:** Obsidian vault → `scripts/publish.ts` → `content/thoughts/` + `public/api/thoughts/` → `astro build` → static HTML

```
Obsidian vault (iCloud)
    ↓  [npm run publish]  scans for #public + publish-id
content/thoughts/*.md + public/api/thoughts/*.json + _graph.json
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

Deploy workflow: `npm run publish && git add content/ public/api/ public/thought-assets/ && git commit && git push`

## Project Structure

```
├── scripts/publish.ts          # Vault scanner + markdown transformer + backlink graph builder
├── astro.config.mjs            # Static output, React integration, legacy redirects
├── src/
│   ├── content.config.ts       # Astro content collection (thoughts)
│   ├── lib/
│   │   ├── types.ts            # Shared interfaces: PublicThought, ThoughtGraph, BacklinkEntry, ThoughtApiResponse
│   │   └── thoughts.ts         # Client-side fetch utility
│   ├── components/
│   │   ├── StackedThoughts.tsx  # React island: stacked panes with URL sync, link interception
│   │   ├── ThoughtPane.tsx      # Single pane renderer
│   │   ├── Backlinks.tsx        # Collapsible backlinks section
│   │   └── Header.astro         # Site nav
│   ├── layouts/
│   │   ├── BaseLayout.astro     # HTML shell, loads Google Fonts + all CSS
│   │   └── PageLayout.astro     # Centered content wrapper with Header
│   ├── pages/
│   │   ├── index.astro          # Homepage: intro + thought list from _graph.json
│   │   ├── thoughts/[slug].astro # Dynamic thought route at /thoughts/<slug>
│   │   ├── cv.astro             # PDF embed + download
│   │   ├── sketches.astro       # Video gallery
│   │   └── about.astro          # Bio
│   └── styles/
│       ├── global.css           # Paper & Ink design system variables + base styles
│       ├── stacked-thoughts.css # Pane layout, collapse, mobile
│       └── thought.css          # Thought content typography
├── content/thoughts/            # GENERATED — do not hand-edit
│   ├── _graph.json              # Public thought graph (backlinks, titles)
│   └── *.md                     # Transformed thoughts with title + slug frontmatter
├── public/
│   ├── api/thoughts/*.json      # GENERATED — per-thought JSON for client-side fetch
│   ├── thought-assets/          # GENERATED — images copied from vault
│   ├── CNAME                    # huylenq.com
│   ├── assets/huy-resume.pdf
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
4. Context excerpts come only from public thought content
5. All private frontmatter stripped (sr-due, sr-interval, etc.)
6. `%%comments%%`, dataview blocks, ad-* blocks stripped
7. No vault paths leak — only publish-id slugs

## Obsidian Plugin (separate repo)

The `public-thoughts` plugin lives at `/Users/huy/src/iPKM/public-thoughts/`. It adds a "Toggle public" command that assigns a `publish-id` (UUID) and toggles the `public` tag in frontmatter.

## Stacked Panes Behavior

- Desktop: horizontal scroll container, 625px panes, earlier panes collapse to 40px strips
- Mobile (<768px): single pane with back button
- URL sync: `/thoughts/{slug}?stacked=s1&stacked=s2`
- Link clicks intercepted via event delegation — only `/thoughts/` links open as new panes
- First pane HTML comes from pre-rendered API JSON; subsequent panes fetched client-side

## Bookshelf (`src/pages/books.astro`)

Recessed wall shelf (tủ âm tường) displaying book covers from Amazon.

**Adding books:** Extract from Huy's Readwise book notes at `{VAULT_PATH}/Readwise/Books/{Title}.md`. Each note has frontmatter (`Author`, `Full Title`) and a cover image line: `![rw-book-cover](https://images-na.ssl-images-amazon.com/images/I/{COVER_ID}._SL200_.jpg)`. Add to the `books` array with `{ title, author, cover: '{COVER_ID}' }`.

**Shelf layout:** Books are split into rows via `topShelf`/`bottomShelf` slices. When adding books, update the slice indices and add entries to the `heightOffsets` array (small ints between -7 and 7 for visual variation). Books use `flex: 0 1 120px` so they shrink gracefully if a row gets crowded.

**Alcove sizing:** The `.bookshelf` has `max-width: 950px` which fits ~6 books per row comfortably. If adding 7+ per row, increase `max-width` (~130px per additional book). The `overflow: hidden` clips anything outside the alcove boundary.

## Content Conventions

- Thought slugs are human-readable for blog-migrated posts (`hello-world`, `trust`, `a-reading-system`)
- New thoughts from the plugin get UUID slugs
- The `content/thoughts/` and `public/api/thoughts/` directories are gitignored but committed when publishing
- `_graph.json` is the source of truth for the thought index and backlinks
