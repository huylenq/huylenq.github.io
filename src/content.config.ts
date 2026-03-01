import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const notes = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './content/notes' }),
  schema: z.object({
    title: z.string(),
    slug: z.string(),
  }),
});

export const collections = { notes };
