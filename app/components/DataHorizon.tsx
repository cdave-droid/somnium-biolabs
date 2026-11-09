// Home page: "Where the data runs out". A field of dots that thins from the hospital
// records medical AI learns from, through the ICU, remote Earth and the military, to
// twelve dots for the twelve people who have walked on the Moon.
// Dots are placed by a fixed-seed generator, so the server and the browser draw the same picture.

type Zone = { name: string; line: string; dots: number; phoneDots: number; tone: string };

const ZONES: Zone[] = [
  { name: 'Hospital records', line: 'Where medical AI excels.', dots: 1100, phoneDots: 240, tone: 'text-gray-500' },
  { name: 'The ICU', line: 'The sickest patients are the rarest cases.', dots: 260, phoneDots: 80, tone: 'text-gray-300' },
  { name: 'Remote Earth', line: 'No specialist nearby, almost no local data.', dots: 80, phoneDots: 30, tone: 'text-gray-200' },
  { name: 'The military', line: 'Field injuries rarely reach the record.', dots: 28, phoneDots: 16, tone: 'text-gray-100' },
  { name: 'Space', line: 'Twelve people have walked on the Moon.', dots: 12, phoneDots: 12, tone: 'text-white' },
];

function mulberry32(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = seed;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Zero-length strokes with round caps draw as dots, so each zone is a single small path.
function dotPath(count: number, x0: number, width: number, height: number, seed: number, padX: number, padY: number) {
  const rand = mulberry32(seed);
  let d = '';
  for (let i = 0; i < count; i++) {
    const x = x0 + padX + rand() * (width - padX * 2);
    const y = padY + rand() * (height - padY * 2);
    d += `M${x.toFixed(1)} ${y.toFixed(1)}h0.01`;
  }
  return d;
}

// Wide screens: five columns with 2% gaps, matching the text grid above the field
// (column 184 units, gap 20 units, in a 1000-unit-wide drawing).
const FIELD = { w: 1000, h: 220, col: 184, step: 204 };
const FIELD_PATHS = ZONES.map((z, i) => dotPath(z.dots, i * FIELD.step, FIELD.col, FIELD.h, 101 + i * 17, 4, 8));

// Phones: one strip per zone.
const STRIP = { w: 400, h: 56 };
const STRIP_PATHS = ZONES.map((z, i) => dotPath(z.phoneDots, 0, STRIP.w, STRIP.h, 501 + i * 23, 6, 6));

const isLast = (i: number) => i === ZONES.length - 1;

export default function DataHorizon() {
  return (
    <section id="data" className="text-white">
      <div className="max-w-7xl mx-auto px-6 lg:px-10 pt-24 pb-20 lg:pt-30 lg:pb-24">
        <h2 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight leading-[1.05] text-balance">
          Where the data runs out
        </h2>
        <p className="mt-6 text-lg sm:text-2xl text-white/90 leading-relaxed max-w-3xl">
          Medical AI learns from crowds: millions of patient records. At the edge of medicine there is no crowd, and the further care gets from the hospital, the less traditional approaches work.
        </p>

        {/* Wide screens: one field across five columns */}
        <div className="hidden md:block mt-14 lg:mt-16">
          <div className="grid grid-cols-5 gap-x-[2%]">
            {ZONES.map((zone) => (
              <div key={zone.name}>
                <h3 className="text-lg font-bold tracking-tight">{zone.name}</h3>
                <p className="mt-1 text-sm lg:text-base text-white/75 leading-relaxed">{zone.line}</p>
              </div>
            ))}
          </div>
          <svg
            viewBox={`0 0 ${FIELD.w} ${FIELD.h}`}
            className="w-full h-auto mt-8"
            role="img"
            aria-label="Dots standing for available patient data: a dense cloud for hospital records, thinning through the ICU, remote Earth and the military to twelve dots for space."
          >
            {ZONES.map((zone, i) => (
              <path
                key={zone.name}
                d={FIELD_PATHS[i]}
                className={zone.tone}
                stroke="currentColor"
                strokeWidth={isLast(i) ? 5 : 3.2}
                strokeLinecap="round"
              />
            ))}
          </svg>
        </div>

        {/* Phones: one strip per zone */}
        <ol className="md:hidden mt-12 space-y-10">
          {ZONES.map((zone, i) => (
            <li key={zone.name}>
              <h3 className="text-lg font-bold tracking-tight">{zone.name}</h3>
              <p className="mt-1 text-base text-white/75 leading-relaxed">{zone.line}</p>
              <svg viewBox={`0 0 ${STRIP.w} ${STRIP.h}`} className="w-full h-auto mt-4" aria-hidden="true">
                <path
                  d={STRIP_PATHS[i]}
                  className={zone.tone}
                  stroke="currentColor"
                  strokeWidth={isLast(i) ? 7 : 4.5}
                  strokeLinecap="round"
                />
              </svg>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
