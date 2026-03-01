/** Metadata for a single public note (used in graph and API responses) */
export interface PublicNote {
  /** The publish-id UUID used as URL slug */
  slug: string;
  /** Note title (derived from filename) */
  title: string;
  /** Backlinks from other public notes */
  backlinks: BacklinkEntry[];
}

/** A single backlink reference */
export interface BacklinkEntry {
  /** publish-id of the linking note */
  slug: string;
  /** Title of the linking note */
  title: string;
  /** Context excerpt (~200 chars around the link) */
  context: string;
}

/** The full public note graph: publish-id → note metadata */
export type NoteGraph = Record<string, PublicNote>;

/** JSON payload served at /api/notes/{slug}.json for client-side pane loading */
export interface NoteApiResponse {
  slug: string;
  title: string;
  /** Pre-rendered HTML content */
  html: string;
  backlinks: BacklinkEntry[];
}
