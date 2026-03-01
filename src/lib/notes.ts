import type { NoteApiResponse } from './types';

export async function fetchNote(slug: string): Promise<NoteApiResponse> {
  const res = await fetch(`/api/notes/${slug}.json`);
  if (!res.ok) throw new Error(`Failed to fetch note: ${slug}`);
  return res.json();
}
