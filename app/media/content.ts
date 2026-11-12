// Media page copy (Frontier Medicine). Same shape as the Technology page: opening paragraphs, one entry
// per section in the page's left-hand menu, and the contact box. Edit the words here; the page layout
// reads everything from this file.
import type { Section } from '../technology/content';

export const header = {
  title: 'Frontier Medicine',
  video: '/frontier-medicine.mp4',
  poster: '/frontier-medicine-poster.jpg',
};

export const intro = [
  'Frontier Medicine is the study of human physiology under extreme environments, and of the technology required to keep a person alive in them. It runs from the intensive care unit to the edge of the atmosphere: the same failing lung, the same oxygen debt, whether the patient is in a bed or in a suit.',
  'It is two things at once: a media production studio that turns the hardest problems in physiology into films and essays, and a research program for the medical problems that still sound like science fiction.',
];

export const sections: Section[] = [
  {
    id: 'what-we-make',
    title: 'What We Make',
    blocks: [
      {
        kind: 'paragraph',
        text: 'Frontier Medicine publishes short films, essays and carousels about the human body at its limits: how it fails without oxygen, under heavy gravity, in deep cold, and far from rescue. Each piece is written by a critical care physician for curious people, and none of it is simplified until it stops being true.',
      },
      {
        kind: 'list',
        items: [
          { lead: 'Measured, not dramatized.', text: 'Every story starts from a real number and its unit, taken from the physiology itself.' },
          { lead: 'Honest about uncertainty.', text: 'Where science has no answer yet, we say so plainly.' },
          { lead: 'Grounded at the bedside.', text: 'Every piece returns at least once to what the same physiology means for a patient in intensive care.' },
        ],
      },
      { kind: 'paragraph', text: 'Films and field notes are published on Instagram and other platforms at @drchintandave.' },
    ],
  },
  {
    id: 'research-programs',
    title: 'Research Programs',
    blocks: [
      {
        kind: 'paragraph',
        text: 'The work is organized into four research programs, each one a boundary of where a human can survive. Every film, essay and study is filed under one of them.',
      },
      {
        kind: 'subsection',
        title: 'FM-01 · Hypoxia',
        tagline: 'Oxygen debt, altitude and apnea.',
        text: 'What happens to the body when oxygen runs short: on the summit of a mountain, at the bottom of a breath-hold dive, and in a patient whose lungs are failing.',
      },
      {
        kind: 'subsection',
        title: 'FM-02 · Load',
        tagline: 'Gravity, acceleration and deconditioning.',
        text: 'How the heart, vessels and muscles respond to too much gravity, too little, and the long recovery after months without it.',
      },
      {
        kind: 'subsection',
        title: 'FM-03 · Thermal',
        tagline: 'Cold, heat and the metabolic floor.',
        text: 'How far human metabolism can be slowed and safely brought back, from accidental hypothermia to the animals that hibernate through winter, and what that could mean for long spaceflight and critical illness.',
      },
      {
        kind: 'subsection',
        title: 'FM-04 · Isolation',
        tagline: 'Care without evacuation.',
        text: 'How to keep a person alive when the nearest hospital is days, months or millions of miles away, and no one is coming to take them home.',
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
        text: 'Frontier Medicine treats these settings as one problem. What we learn at the bedside informs how we protect people in space, and the demands of space push us to build better care on Earth. The same questions drive the technology Somnium Biolabs is building.',
      },
    ],
  },
];

export const contact = {
  title: 'Follow Frontier Medicine',
  instagramLead: 'Watch the films on Instagram at',
  handle: 'drchintandave',
  instagram: 'https://www.instagram.com/drchintandave/',
  emailLead: 'For research or media collaborations, email',
  email: 'contact@somniumbio.com',
};
