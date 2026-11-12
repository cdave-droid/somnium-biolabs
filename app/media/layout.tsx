import type { Metadata } from 'next';
import { pages } from '../site';

// The page itself runs in the browser, so its title and search summary are set here.
const page = pages.media;

export const metadata: Metadata = {
  title: page.title,
  description: page.description,
  alternates: { canonical: page.path },
  openGraph: { title: page.title, description: page.description, url: page.path },
};

export default function MediaLayout({ children }: { children: React.ReactNode }) {
  return children;
}
