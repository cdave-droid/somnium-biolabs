// Home page backdrop for everything after the hero: a space shuttle silhouetted against Earth's
// glowing atmosphere at the horizon.
// The page places it in a layer that stays on screen while the sections scroll over it. A dark wash
// over the top keeps the text readable and blends the photo into the black of the page.
import Image from 'next/image';

export default function HorizonBackdrop() {
  return (
    <div className="absolute inset-0 overflow-hidden bg-[#0b0f14]" aria-hidden="true">
      <Image
        src="/shuttle-horizon.jpg"
        alt=""
        fill
        sizes="100vw"
        quality={90}
        className="object-cover object-center"
      />
      <div className="absolute inset-0 bg-gradient-to-b from-[#0b0f14]/85 via-[#0b0f14]/65 to-[#0b0f14]/45" />
    </div>
  );
}
