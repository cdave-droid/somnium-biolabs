// Founder's Letter copy. The page layout reads everything from this file: the header, the opening
// paragraphs, one entry per section in the page's left-hand menu, and the closing quote.
import type { ReactNode } from 'react';

export type LetterSection = { id: string; title: string; paragraphs: ReactNode[] };

export const header = {
  title: 'Founder’s Letter',
  labels: ['Company', 'Vision'],
  subtitle: 'Every patient is a physiological mystery to solve.',
};

export const intro: ReactNode[] = [
  'As an ICU physician, I’ve spent years caring for patients during some of the most vulnerable and critically ill moments of their lives. Despite remarkable advances in medicine, much of healthcare remains reactive. We monitor the human body, recognize when something goes wrong, and intervene after we observe a trend.',
  'But what if we could predict what happens next? What if we could eventually control aspects of our physiology rather than simply respond to them? If we were to imagine 20 years in the future, where we had real human hibernation pods, what kind of technology do we need to bring this closer to reality?',
  'These questions inspired me to start Somnium Biolabs.',
];

export const sections: LetterSection[] = [
  {
    id: 'understanding-to-predicting',
    title: 'From Understanding to Predicting',
    paragraphs: [
      'Today, we are developing PhysioBridge™, a cardiovascular digital twin designed to understand and predict how an individual’s heart and circulation respond to changing conditions.',
      'Our goal is to bring personalized physiological intelligence beyond the hospital, from patients in remote communities to military personnel in extreme environments and astronauts exploring space.',
      'But this is only the beginning.',
    ],
  },
  {
    id: 'the-dream',
    title: 'The Dream We Serve',
    paragraphs: [
      'I believe we are entering a new chapter of human evolution, where technology will allow us to consciously shape our biological future.',
      'Imagine autonomous medical systems that continuously monitor our physiological state, anticipate deterioration, and help protect human life even when a doctor is millions of miles away.',
      'Imagine a future where we can deliberately regulate our metabolism, preserve organ function, and buy biological time when conventional medicine reaches its limits.',
      'One day, this could lead to hibernation pods capable of sustaining humans through prolonged spaceflight, critical illness, or environments we cannot survive today.',
      'These are enormous scientific challenges. But every breakthrough in human history began with the willingness to pursue what once seemed impossible.',
    ],
  },
  {
    id: 'our-responsibility',
    title: 'Our Responsibility',
    paragraphs: [
      'As our ability to understand and influence human biology grows, so does our responsibility.',
      <>
        Somnium is built on three values: <strong className="font-semibold text-gray-900">compassion, growth, and freedom.</strong>
      </>,
      'Technology alone will not create a better future. We must consciously choose to build systems that preserve human dignity, scale trust, and expand opportunities for everyone.',
      <>
        “Somnium” means <em>The Dream</em>.
      </>,
      'My dream is to help build a future where humanity is no longer limited by the biological constraints we inherited, but can consciously evolve to live healthier, longer, and eventually become an interstellar species.',
      'I believe that future is possible. And I believe it is worth dedicating our lives to building.',
    ],
  },
];

export const signOff = {
  // Each entry starts on its own line.
  quote: ['Beliefs color your world.', 'So why not believe in the biggest dream you can possibly imagine?'],
  name: 'Dr. Chintan Dave',
  role: 'Founder & CEO, Somnium Biolabs',
  photo: '/founder-chintan-dave.jpg',
  handle: 'drchintandave',
  instagram: 'https://www.instagram.com/drchintandave/',
};
