import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import mdx from '@mdx-js/rollup';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';

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
  redirects: {},
});
