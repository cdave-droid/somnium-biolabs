// Facts about Somnium Biolabs used in page titles, search descriptions and the structured data that
// search engines and AI assistants read. Keep these consistent with the page copy and with
// every profile elsewhere (LinkedIn, Instagram, papers, talks): the same names, spelled the same way.

export const SITE_URL = 'https://www.somniumbio.com';

export const site = {
  name: 'Somnium Biolabs',
  description:
    'Somnium Biolabs is developing PhysioBridge™, a cardiovascular digital twin that combines computational physiology with AI to understand and predict how each person’s heart and circulation respond, from the ICU to remote care and human spaceflight.',
  email: 'contact@somniumbio.com',
  founder: {
    name: 'Chintan Dave',
    honorificSuffix: 'MD',
    jobTitle: 'Founder & CEO, Somnium Biolabs',
    description: 'ICU physician, founder of Somnium Biolabs and of Frontier Medicine.',
    image: '/founder-chintan-dave.jpg',
    sameAs: ['https://www.instagram.com/drchintandave/'],
  },
};

// One entry per page: its address, title and the summary search engines and AI assistants show.
export const pages = {
  home: {
    path: '/',
    title: 'Somnium Biolabs: Cardiovascular Intelligence for the Edge of Medicine',
    description: site.description,
  },
  technology: {
    path: '/technology',
    title: 'PhysioBridge™: Cardiovascular Digital Twin',
    description:
      'PhysioBridge™ is a cardiovascular digital twin in development at Somnium Biolabs. It combines physiological data with computational modeling and AI to estimate and predict how an individual’s heart and circulation respond, for space exploration, military and aerospace, rural care and home monitoring.',
  },
  media: {
    path: '/media',
    title: 'Frontier Medicine: Human Hibernation, Space Medicine and Extreme Physiology',
    description:
      'Frontier Medicine, founded by ICU physician Chintan Dave, MD, is the study of human physiology under extreme environments. Season 1 covers human hibernation organ by organ, and the Hibernation Fellows program opens applications in January 2027.',
  },
  founderLetter: {
    path: '/founder-letter',
    title: 'Founder Letter',
    description:
      'Why ICU physician Chintan Dave, MD, founded Somnium Biolabs: from reactive medicine to predicting physiology, and the long road toward human hibernation.',
  },
};
