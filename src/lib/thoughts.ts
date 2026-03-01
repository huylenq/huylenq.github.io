import type { ThoughtApiResponse } from './types';

export async function fetchThought(slug: string): Promise<ThoughtApiResponse> {
  const res = await fetch(`/api/thoughts/${slug}.json`);
  if (!res.ok) throw new Error(`Failed to fetch thought: ${slug}`);
  return res.json();
}
