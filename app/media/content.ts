// Media page copy (Frontier Medicine). Mirrors the shared doc "Media page copy: Frontier Medicine":
// opening paragraphs, one entry per section in the page's left-hand menu, and the contact box.
// Edit the words here; the page layout reads everything from this file.
import type { Section } from '../technology/content';

export const header = {
  title: 'Frontier Medicine',
  video: '/frontier-medicine.mp4',
  poster: '/frontier-medicine-poster.jpg',
};

export const intro = [
  'Frontier Medicine is the study of human physiology under extreme environments, and of the technology required to keep a person alive in them. It runs from the intensive care unit to the edge of space. When studying extreme physiology, our traditional medical and AI approaches break down; and Frontier Medicine is the study and control of this extreme physiology.',
  'The second aim of Frontier Medicine is to inspire people to work on futuristic and science fiction medical problems. With AI making most research and technology rapidly achievable, the main question becomes: what is actually worth building?',
  'Frontier Medicine exists to provide infrastructure for inspired humans who want to solve big medical problems together. We are mainly a media production studio (160,000 followers across social media) that turns the hardest problems in physiology into stories and educational content, and a research program that allows inspired humans to work together.',
];

export const sections: Section[] = [
  {
    id: 'human-hibernation',
    title: 'Human Hibernation',
    blocks: [
      {
        kind: 'paragraph',
        text: 'Frontier Medicine started season 1 with a deep dive into the science, medicine, and technological progress on Human Hibernation. The season follows how each of the main organs is changed by hibernation, and the current and future scientific and technological advancements required to make hibernation a reality.',
      },
      { kind: 'paragraph', text: 'Cases and physiology deep dives are published on Instagram, YouTube, and other platforms at @drchintandave.' },
    ],
  },
  {
    id: 'hibernation-fellows',
    title: 'Hibernation Fellows',
    blocks: [
      {
        kind: 'paragraph',
        text: 'Applications open in January 2027 for the first cohort of Hibernation Fellows: **16 fellows**, working in 4 teams, on human hibernation research. Over the six-month program, fellows will work together on the frontier medical problems that stand between today’s science and human hibernation, with the chance to win a **$15,000 USD** prize.',
      },
      {
        kind: 'link',
        text: 'Register your interest',
        href: 'https://dr-dave-frontier-medicine.kit.com/44f13b9cf4',
        after: ' to hear as soon as applications open.',
      },
    ],
  },
  {
    id: 'icu-to-orbit',
    title: 'From the ICU to Orbit',
    blocks: [
      {
        kind: 'paragraph',
        text: 'The intensive care unit is already an extreme environment. The patients there live at the edge of what physiology can tolerate, kept alive by machines that measure and support them minute by minute. The astronaut, the high-altitude climber and the soldier in the field face the same failures, with less help nearby.',
      },
      {
        kind: 'paragraph',
        text: 'Frontier Medicine treats these settings as one problem. What we learn at the bedside informs how we protect people in space, and the demands of space push us to build better care on Earth. The same questions drive the technology Somnium Biolabs is building, and Frontier Medicine is the channel to communicate this work and to inspire the public towards building a more hopeful future.',
      },
    ],
  },
];

export const contact = {
  title: 'Follow Frontier Medicine',
  instagramLead: 'Connect on Instagram at',
  handle: 'drchintandave',
  instagram: 'https://www.instagram.com/drchintandave/',
  emailLead: 'For research or technology collaborations, email',
  email: 'contact@somniumbio.com',
};
