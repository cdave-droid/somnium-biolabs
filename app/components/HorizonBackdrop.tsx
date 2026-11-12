// Home page backdrop for everything after the hero: Earth's thin glowing atmosphere seen edge-on
// from orbit, with the sun just breaking the horizon. The page places it in a layer that stays on
// screen while the sections scroll over it.
//
// The photo is wide and its horizon sits 38% of the way down, so instead of stretching it to fill
// the screen it is placed so the horizon lands about 72% of the way down; the black of space above
// and below blends into the page. On narrow screens it is drawn wider than the screen and shifted
// so the sunrise (70% across the photo) stays in view.
import Image from 'next/image';

const WIDTH = 'max(100vw, 120vh)';
const HEIGHT = `calc(${WIDTH} * 0.5621)`;

export default function HorizonBackdrop() {
  return (
    <div className="absolute inset-0 overflow-hidden bg-black" aria-hidden="true">
      <div
        className="absolute"
        style={{
          width: WIDTH,
          height: HEIGHT,
          top: `calc(72% - ${HEIGHT} * 0.379)`,
          left: `min(0px, max(calc(100vw - ${WIDTH}), calc(65vw - ${WIDTH} * 0.698)))`,
        }}
      >
        <Image src="/thin-horizon.jpg" alt="" fill sizes="100vw" quality={95} className="object-cover" />
      </div>
    </div>
  );
}
