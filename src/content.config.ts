import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const thoughts = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './content/thoughts' }),
  schema: z.object({
    title: z.string(),
    slug: z.string(),
  }),
});

export const collections = { thoughts };
