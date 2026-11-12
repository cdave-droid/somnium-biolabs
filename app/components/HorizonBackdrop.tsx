// Home page backdrop for everything after the hero: a photo of Earth at night from orbit, with the red glow of dawn on the horizon.
// The page places it in a layer that stays on screen while the sections scroll over it. A dark wash
// over the top keeps the text readable and blends the photo into the black of the page.
import Image from 'next/image';

export default function HorizonBackdrop() {
  return (
    <div className="absolute inset-0 overflow-hidden bg-[#0b0f14]" aria-hidden="true">
      <Image
        src="/earth-night.jpg"
        alt=""
        fill
        sizes="100vw"
        quality={90}
        className="object-cover object-[50%_42%]"
      />
      <div className="absolute inset-0 bg-gradient-to-b from-[#0b0f14]/80 via-[#0b0f14]/30 to-transparent" />
    </div>
  );
}
