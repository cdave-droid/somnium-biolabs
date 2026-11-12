// The list of pages handed to search engines and AI crawlers (served at /sitemap.xml).
import type { MetadataRoute } from 'next';
import { SITE_URL, pages } from './site';

export default function sitemap(): MetadataRoute.Sitemap {
  return Object.values(pages).map((page) => ({
    url: `${SITE_URL}${page.path}`,
    lastModified: new Date(),
    changeFrequency: 'monthly',
    priority: page.path === '/' ? 1 : 0.8,
  }));
}
