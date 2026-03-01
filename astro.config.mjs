import { defineConfig } from 'astro/config';
import react from '@astrojs/react';

export default defineConfig({
  site: 'https://huylenq.com',
  output: 'static',
  integrations: [react()],
  redirects: {
    '/hello/': '/hello-world',
    '/reading-workflow/': '/a-reading-system',
  },
});
