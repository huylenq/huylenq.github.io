import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const thoughts = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './content/thoughts' }),
  schema: z.object({
    title: z.string(),
    slug: z.string(),
    maturity: z.enum(["seed", "budding", "evergreen"]).default("seed"),
  }),
});

export const collections = { thoughts };
