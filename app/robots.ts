// Served at /robots.txt: every crawler, including AI assistants' (GPTBot, ClaudeBot, PerplexityBot,
// Google-Extended and others), may read the whole site, and is pointed to the page list.
import type { MetadataRoute } from 'next';
import { SITE_URL } from './site';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: '*', allow: '/' }],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
