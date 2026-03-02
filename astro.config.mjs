import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import mdx from '@mdx-js/rollup';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const redirectsPath = path.join(__dirname, 'content/thoughts/_redirects.json');
const redirects = fs.existsSync(redirectsPath)
  ? JSON.parse(fs.readFileSync(redirectsPath, 'utf-8'))
  : {};

export default defineConfig({
  site: 'https://huylenq.com',
  output: 'static',
  integrations: [react()],
  vite: {
    plugins: [
      {
        enforce: 'pre',
        ...mdx({
          jsxImportSource: 'react',
          remarkPlugins: [remarkMath],
          rehypePlugins: [rehypeKatex],
        }),
      },
    ],
  },
  redirects,
});
