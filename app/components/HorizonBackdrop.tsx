// Home page backdrop for everything after the hero: a sunrise breaking over the glowing edge of a
// dark planet. Original artwork made of CSS gradients plus one small drawing of stars. The page places
// it in a layer that stays on screen while the sections scroll over it.

function mulberry32(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = seed;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Stars as zero-length round-capped strokes, kept to the sky above the planet's edge.
function stars(count: number, seed: number, maxY: number) {
  const rand = mulberry32(seed);
  let d = '';
  for (let i = 0; i < count; i++) {
    d += `M${(rand() * 1000).toFixed(1)} ${(rand() * maxY).toFixed(1)}h0.01`;
  }
  return d;
}

const FAINT = stars(110, 7, 600);
const BRIGHT = stars(16, 19, 560);
const TWINKLE = stars(12, 31, 580);

// Where the sunrise sits: 64% across, on the planet's edge (the edge's highest point is 88% down).
const HORIZON = '88%';
const SUN_X = '64%';
const SUN_Y = 'calc(88% + 0.65vw)';

export default function HorizonBackdrop() {
  return (
    <div className="absolute inset-0 overflow-hidden bg-[#0B0F14]" aria-hidden="true">
      {/* Sky, with a faint blue airglow just above the horizon */}
      <div
        className="absolute inset-0"
        style={{ background: 'linear-gradient(to bottom, #0B0F14 0%, #0B0F14 56%, #0D1622 77%, #112539 87%, #0B0F14 100%)' }}
      />

      {/* Stars */}
      <svg viewBox="0 0 1000 700" preserveAspectRatio="xMidYMid slice" className="absolute inset-0 w-full h-full">
        <path d={FAINT} stroke="white" strokeOpacity="0.22" strokeWidth="0.9" strokeLinecap="round" />
        <path d={BRIGHT} stroke="white" strokeOpacity="0.45" strokeWidth="1.4" strokeLinecap="round" />
        <path d={TWINKLE} className="backdrop-twinkle" stroke="white" strokeWidth="1.2" strokeLinecap="round" />
      </svg>

      {/* Sunrise behind the planet: a wide warm bloom and a bright core */}
      <div
        className="absolute backdrop-breathe"
        style={{
          left: SUN_X,
          top: SUN_Y,
          width: '120vw',
          height: '80vh',
          transform: 'translate(-50%, -50%)',
          background:
            'radial-gradient(ellipse at center, rgba(255,214,170,0.24) 0%, rgba(245,172,112,0.11) 28%, rgba(56,189,248,0.05) 52%, transparent 70%)',
        }}
      />
      <div
        className="absolute backdrop-breathe"
        style={{
          left: SUN_X,
          top: SUN_Y,
          width: '28vw',
          height: '10vh',
          transform: 'translate(-50%, -50%)',
          background:
            'radial-gradient(ellipse at center, rgba(255,255,255,0.85) 0%, rgba(255,233,200,0.6) 22%, rgba(255,190,125,0.22) 52%, transparent 72%)',
          filter: 'blur(2px)',
        }}
      />

      {/* The planet, with its glowing atmosphere along the edge */}
      <div
        className="absolute rounded-full"
        style={{
          width: '300vw',
          height: '300vw',
          left: '50%',
          top: HORIZON,
          transform: 'translateX(-50%)',
          background: 'radial-gradient(circle at 50% 0%, #0A0F16 0%, #05070A 6%, #030406 30%)',
          boxShadow:
            '0 -1px 0 0 rgba(219,240,255,0.6), 0 -6px 22px rgba(125,211,252,0.32), 0 -36px 110px rgba(56,189,248,0.18), 0 -90px 220px rgba(56,189,248,0.09)',
        }}
      />
    </div>
  );
}
