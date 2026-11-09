'use client';

// Home page: "A model of one". On wide screens the section stays in place for two screens of scrolling
// while a chart builds in four steps: the average patient, one person's readings, a model fitted to
// them, and a forecast with a band showing how sure it is. Phones show the finished chart.
import { useEffect, useRef, useState } from 'react';

const STEPS = [
  { title: 'What medicine knows', text: 'Computational models of how the heart, vessels and lungs work together.' },
  { title: 'What one person shows', text: 'A handful of that person’s own signals, from a monitor or a wearable.' },
  { title: 'Precision physiology', text: 'AI fits the physiology to the individual.' },
  { title: 'State prediction', text: 'Personalized model enables continuous prediction of physiological states.' },
];

const POINTS: [number, number][] = [
  [60, 214], [105, 226], [150, 221], [205, 243], [250, 240], [300, 262], [350, 268], [390, 285],
];

function ModelChart({ step }: { step: number }) {
  const draw = (on: boolean, delay = 0) => ({
    strokeDasharray: 1,
    strokeDashoffset: on ? 0 : 1,
    transition: `stroke-dashoffset 900ms cubic-bezier(0.22,1,0.36,1) ${delay}ms, opacity 500ms ease`,
  });
  return (
    <svg viewBox="0 0 640 420" className="w-full h-auto" role="img" aria-label="Chart: an average-patient curve, one person's readings below it, a personal model fitted to those readings, and a forecast with a band showing its uncertainty.">
      {/* time axis and "now" marker */}
      <line x1="40" y1="380" x2="600" y2="380" className="stroke-white/15" strokeWidth="1" />
      <text x="600" y="404" textAnchor="end" className="fill-white/45 text-[13px]">Time</text>
      <g style={{ opacity: step >= 3 ? 1 : 0, transition: 'opacity 600ms ease' }}>
        <line x1="400" y1="48" x2="400" y2="380" className="stroke-white/25" strokeWidth="1" strokeDasharray="4 6" />
        <text x="400" y="36" textAnchor="middle" className="fill-white/60 text-[13px]">Now</text>
      </g>

      {/* average patient */}
      <path
        d="M40,200 C140,190 240,206 340,198 S520,196 600,200"
        pathLength={1}
        fill="none"
        className="stroke-white/70"
        strokeWidth="2"
        style={{ ...draw(true), opacity: step >= 2 ? 0.35 : 1 }}
      />
      <text x="600" y="186" textAnchor="end" className="fill-white/60 text-[13px]" style={{ opacity: step >= 2 ? 0.5 : 1, transition: 'opacity 500ms ease' }}>
        Average patient
      </text>

      {/* forecast band and line */}
      <path
        d="M400,284 C460,288 530,296 600,300 L600,366 C530,342 460,310 400,284 Z"
        className="fill-sky-300"
        style={{ opacity: step >= 3 ? 0.16 : 0, transition: 'opacity 700ms ease 300ms' }}
      />
      <path
        d="M400,284 C460,298 530,318 600,332"
        pathLength={1}
        fill="none"
        className="stroke-sky-300"
        strokeWidth="2.5"
        strokeLinecap="round"
        style={{ ...draw(step >= 3, 150), strokeDasharray: step >= 3 ? '0.02 0.03' : 1, strokeDashoffset: step >= 3 ? 0 : 1 }}
      />
      <text x="600" y="290" textAnchor="end" className="fill-sky-300 text-[13px]" style={{ opacity: step >= 3 ? 1 : 0, transition: 'opacity 500ms ease 600ms' }}>
        Forecast
      </text>

      {/* personal model */}
      <path
        d="M40,210 C120,222 200,236 260,247 S360,272 400,284"
        pathLength={1}
        fill="none"
        className="stroke-sky-300"
        strokeWidth="3"
        strokeLinecap="round"
        style={draw(step >= 2)}
      />
      <text x="232" y="282" textAnchor="middle" className="fill-sky-300 text-[13px]" style={{ opacity: step >= 2 ? 1 : 0, transition: 'opacity 500ms ease 500ms' }}>
        Personalized model
      </text>

      {/* one person's readings */}
      {POINTS.map(([x, y], i) => (
        <circle
          key={x}
          cx={x}
          cy={y}
          r="5"
          className="fill-white"
          style={{ opacity: step >= 1 ? 1 : 0, transition: `opacity 400ms ease ${step >= 1 ? i * 70 : 0}ms` }}
        />
      ))}
    </svg>
  );
}

export default function ApproachStory() {
  const ref = useRef<HTMLElement>(null);
  const [step, setStep] = useState(3);

  useEffect(() => {
    const wide = window.matchMedia('(min-width: 768px)');
    const update = () => {
      const el = ref.current;
      if (!el) return;
      if (!wide.matches) {
        setStep(3);
        return;
      }
      const travel = el.offsetHeight - window.innerHeight;
      const progress = Math.min(1, Math.max(0, -el.getBoundingClientRect().top / Math.max(1, travel)));
      setStep(Math.min(3, Math.floor(progress * 4)));
    };
    update();
    window.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
    return () => {
      window.removeEventListener('scroll', update);
      window.removeEventListener('resize', update);
    };
  }, []);

  return (
    <section id="approach" ref={ref} className="text-white md:h-[200vh]">
      <div className="md:sticky md:top-0 md:h-screen">
        <div className="max-w-7xl mx-auto px-6 lg:px-10 pt-24 pb-20 md:pt-28 md:pb-0 short:pt-20 grid md:grid-cols-12 gap-x-12 gap-y-12">
          <div className="md:col-span-5">
            <h2 className="text-4xl sm:text-5xl lg:text-6xl short:text-5xl font-bold tracking-tight leading-[1.05]">A model of one</h2>
            <p className="mt-6 short:mt-4 text-lg lg:text-xl short:text-lg text-white/90 leading-relaxed">
              We combine computational models of human physiology with AI. The models carry what medicine knows about how bodies work. The AI fits them to one person, so care can be predictive and precise, even at the edge of medicine.
            </p>
            <ol className="mt-10 short:mt-6 space-y-5 short:space-y-3">
              {STEPS.map((s, i) => (
                <li key={s.title} className={`transition-colors duration-500 ${i <= step ? 'text-white' : 'text-white/50'}`}>
                  <h3 className="text-lg font-bold tracking-tight">{s.title}</h3>
                  <p className="mt-1 text-base leading-relaxed opacity-80">{s.text}</p>
                </li>
              ))}
            </ol>
          </div>
          <div className="md:col-span-7 md:pt-4">
            <ModelChart step={step} />
          </div>
        </div>
      </div>
    </section>
  );
}
