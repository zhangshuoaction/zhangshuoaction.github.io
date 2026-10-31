import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';
import { postIdFromEntry } from './lib/post-id.mjs';
const blog = defineCollection({
  loader: glob({
    base: './src/content/blog',
    pattern: ['**/*.md', '!**/.obsidian/**', '!**/.trash/**'],
    generateId: ({ entry }) => postIdFromEntry(entry),
  }),
  schema: z.object({
    title: z.string().min(1), description: z.string().min(1),
    pubDate: z.coerce.date(), updatedDate: z.coerce.date().optional(),
    tags: z.array(z.string().trim().transform((tag) => tag.replace(/^#+/, '').trim()).pipe(z.string().min(1))).default([]),
    draft: z.boolean().default(false), featured: z.boolean().default(false), sample: z.boolean().default(false),
  }),
});
export const collections = { blog };
