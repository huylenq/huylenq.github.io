/** Metadata for a single public thought (used in graph and API responses) */
export interface PublicThought {
  /** The publish-id UUID used as URL slug */
  slug: string;
  /** Thought title (derived from filename) */
  title: string;
  /** Backlinks from other public thoughts */
  backlinks: BacklinkEntry[];
}

/** A single backlink reference */
export interface BacklinkEntry {
  /** publish-id of the linking thought */
  slug: string;
  /** Title of the linking thought */
  title: string;
  /** Context excerpt (~200 chars around the link) */
  context: string;
}

/** The full public thought graph: publish-id → thought metadata */
export type ThoughtGraph = Record<string, PublicThought>;

/** JSON payload served at /api/thoughts/{slug}.json for client-side pane loading */
export interface ThoughtApiResponse {
  slug: string;
  title: string;
  /** Pre-rendered HTML content */
  html: string;
  backlinks: BacklinkEntry[];
}
