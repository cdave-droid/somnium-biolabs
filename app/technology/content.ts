// Technology page copy (PhysioBridge™). Mirrors the shared doc "Technology page copy: PhysioBridge™":
// the header, the opening paragraphs, one entry per section in the page's left-hand menu, and the
// contact box. Edit the words here; the page layout reads everything from this file.

export type Block =
  | { kind: 'paragraph'; text: string }
  | { kind: 'list'; items: { lead: string; text: string }[] }
  | { kind: 'subsection'; title: string; tagline: string; text: string };

export type Section = { id: string; title: string; blocks: Block[] };

export const header = {
  title: 'PhysioBridge™',
  labels: ['Machine Learning', 'Computational Biology', 'Human Physiology'],
  subtitle: 'Cardiovascular intelligence, anywhere.',
};

export const intro = [
  'The human cardiovascular system adapts constantly to its surroundings. Yet most monitoring shows what is happening now, not how one person’s physiology will respond to what comes next.',
  'PhysioBridge™ is Somnium Biolabs’ flagship technology, built to close that gap. It is a cardiovascular digital twin: it combines physiological data with computational modeling and AI to create a personalized, evolving model of how each person’s heart and circulation work. Our aim is to move from passive monitoring to predictive and continuous cardiovascular intelligence, available wherever people live, work and explore.',
];

export const sections: Section[] = [
  {
    id: 'monitoring-to-prediction',
    title: 'From Monitoring to Prediction',
    blocks: [
      {
        kind: 'paragraph',
        text: 'Heart rate, blood pressure and oxygen saturation are valuable measurements, but each shows only part of how the cardiovascular system is working. We are developing PhysioBridge to help researchers and clinicians understand the physiology behind those numbers, and to anticipate how it may change.',
      },
      { kind: 'paragraph', text: 'Our work focuses on three capabilities:' },
      {
        kind: 'list',
        items: [
          { lead: 'Understand.', text: 'Estimate an individual’s cardiovascular function from the data available, for a fuller picture of the physiological state.' },
          { lead: 'Predict.', text: 'Model how that person’s cardiovascular system may respond to physiological stress, a changing environment or an evolving illness.' },
          { lead: 'Anticipate.', text: 'Study the early changes that can come before serious deterioration, so assessment and care can begin sooner.' },
        ],
      },
      { kind: 'paragraph', text: 'The goal is cardiovascular information that clinicians, crews and patients can act on.' },
    ],
  },
  {
    id: 'beyond-the-hospital',
    title: 'Beyond the Hospital',
    blocks: [
      {
        kind: 'paragraph',
        text: 'The need for better physiological monitoring reaches far beyond the hospital. An astronaut on the Moon, a service member at a remote post and a patient hours away from a specialist share the same challenge: knowing how that person’s cardiovascular system is changing, and how to prevent deterioration. PhysioBridge is being developed with each of these settings in mind.',
      },
      {
        kind: 'subsection',
        title: 'Space exploration',
        tagline: 'Supporting human health beyond Earth.',
        text: 'Spaceflight reshapes the cardiovascular system. Fluids shift toward the head, the heart and vessels adapt to microgravity, and every change in gravity tests them again. PhysioBridge can model each crew member’s response to these conditions, supporting research into astronaut health, readiness and risk on lunar and deep-space missions.',
      },
      {
        kind: 'subsection',
        title: 'Military and aerospace',
        tagline: 'Physiological insight for demanding operations.',
        text: 'Service members and aviators work under physical and environmental stress that can strain the cardiovascular system, often far from medical facilities. PhysioBridge supports research into how individuals respond to that stress, and into early signs that their tolerance is falling. Our long-term goal is cardiovascular assessment in the field, where connectivity, equipment and medical support are limited.',
      },
      {
        kind: 'subsection',
        title: 'Rural and remote care',
        tagline: 'Cardiovascular insight beyond the hospital.',
        text: 'In rural and underserved communities, specialist cardiovascular assessment can be hours away, and sometimes not available altogether. PhysioBridge brings advanced assessment into remote care by turning remotely collected data into a clearer picture of cardiovascular function, providing insights (e.g. cardiac output, volume status, etc.) usually only provided by invasive cardiac measurements. That would help clinicians and AI systems recognize concerning changes earlier and decide when a patient needs more care.',
      },
      {
        kind: 'subsection',
        title: 'Chronic disease and home monitoring',
        tagline: 'From occasional readings to continuous understanding.',
        text: 'Cardiovascular disease is managed over months and years, and a patient’s condition can change between visits. We are studying how personalized models could strengthen remote patient monitoring, starting with conditions such as heart failure. Instead of relying only on single readings and fixed thresholds, the approach follows how each patient’s cardiovascular function changes over time. The aim is earlier detection of deterioration, individual risk assessment and more proactive care.',
      },
    ],
  },
  {
    id: 'built-on-physiology',
    title: 'Built on Physiology',
    blocks: [
      { kind: 'paragraph', text: 'PhysioBridge combines computational physiology with artificial intelligence, guided by four principles:' },
      {
        kind: 'list',
        items: [
          { lead: 'Personalized.', text: 'Physiology differs from person to person, so PhysioBridge is designed to adapt to each individual’s cardiovascular characteristics as they change over time.' },
          { lead: 'Grounded in physiology.', text: 'Our approach rests on the established biology of how the heart and circulation work, so its predictions stay physiologically meaningful and interpretable.' },
          { lead: 'Predictive.', text: 'By exploring how cardiovascular function may respond to changing conditions, PhysioBridge moves monitoring from observation toward anticipation, and eventually autonomous care.' },
          { lead: 'Made for remote settings.', text: 'We are designing for wearable sensors and for places where specialist care or a reliable connection may be out of reach.' },
        ],
      },
    ],
  },
  {
    id: 'research-and-validation',
    title: 'Research and Validation',
    blocks: [
      {
        kind: 'paragraph',
        text: 'Physiological intelligence has to be proven before it can be trusted. Our first research focus is cardiovascular adaptation in spaceflight, where understanding how individuals respond to long periods in microgravity and to changes in gravity is both a scientific and an operational challenge.',
      },
      {
        kind: 'paragraph',
        text: 'Through research collaborations with computational biologists, mathematicians, biomedical engineers, clinicians and AI engineers, and through planned validation studies, we are currently evaluating the accuracy, reliability and limits of PhysioBridge. If you would like to join these research efforts, contact us below.',
      },
    ],
  },
  {
    id: 'healthcare-without-boundaries',
    title: 'Healthcare Without Boundaries',
    blocks: [
      {
        kind: 'paragraph',
        text: 'Physiological monitoring should not depend on geography, infrastructure or distance from a hospital. Advanced cardiovascular insight should reach the astronaut exploring another world, the service member in an austere environment and the patient cared for at home.',
      },
      {
        kind: 'paragraph',
        text: 'PhysioBridge is our first step toward that future. As the technology matures, we see increasingly autonomous systems that help people monitor, understand and protect their own physiology where medical resources are scarce or delayed. Further ahead, we aim to develop technologies that help people stay healthy in environments once thought beyond our biological limits.',
      },
      { kind: 'paragraph', text: 'Our mission is to make human physiology understandable, predictable and controllable, anywhere: on Earth, in space and beyond.' },
    ],
  },
];

export const contact = {
  title: 'Partner with Somnium',
  text: 'We welcome new collaborations with research institutions, healthcare innovators, aerospace organizations and defense partners to advance cardiovascular digital twins and bring them into real-world use.',
  emailLead: 'To explore a research collaboration or technology partnership, email',
  email: 'contact@somniumbio.com',
};
