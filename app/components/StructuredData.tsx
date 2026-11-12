// Machine-readable facts for search engines and AI assistants (schema.org JSON-LD): the company, its
// founder, PhysioBridge and Frontier Medicine, and how they connect. Nothing here is shown on the page.
import { SITE_URL, pages, site } from '../site';

const ORG = `${SITE_URL}/#organization`;
const PERSON = `${SITE_URL}/#founder`;

const graph = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'Organization',
      '@id': ORG,
      name: site.name,
      url: SITE_URL,
      logo: `${SITE_URL}/logo.jpg`,
      email: site.email,
      description: site.description,
      founder: { '@id': PERSON },
      knowsAbout: [
        'Cardiovascular digital twins', 'Computational physiology', 'Cardiovascular monitoring',
        'Space medicine', 'Critical care medicine', 'Human hibernation', 'Extreme physiology',
      ],
    },
    {
      '@type': 'Person',
      '@id': PERSON,
      name: site.founder.name,
      honorificSuffix: site.founder.honorificSuffix,
      jobTitle: site.founder.jobTitle,
      description: site.founder.description,
      image: `${SITE_URL}${site.founder.image}`,
      worksFor: { '@id': ORG },
      sameAs: site.founder.sameAs,
      knowsAbout: ['Critical care medicine', 'Space medicine', 'Human hibernation', 'Cardiovascular physiology'],
    },
    {
      '@type': 'Product',
      name: 'PhysioBridge™',
      description: pages.technology.description,
      url: `${SITE_URL}${pages.technology.path}`,
      brand: { '@id': ORG },
      category: 'Cardiovascular digital twin (in development)',
    },
    {
      '@type': 'CreativeWork',
      name: 'Frontier Medicine',
      description: pages.media.description,
      url: `${SITE_URL}${pages.media.path}`,
      creator: { '@id': PERSON },
      publisher: { '@id': ORG },
      about: ['Human hibernation', 'Space medicine', 'Extreme physiology', 'Critical care medicine'],
    },
    { '@type': 'WebSite', '@id': `${SITE_URL}/#website`, url: SITE_URL, name: site.name, publisher: { '@id': ORG } },
  ],
};

export default function StructuredData() {
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(graph) }} />;
}
