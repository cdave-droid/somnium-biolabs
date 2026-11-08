'use client';

import { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import Footer from './components/Footer';
import { LiquidButton } from './components/ui/liquid-glass-button';

// Published facts behind the "Into the unknown" cards (sources listed below the cards).
const FACTS = [
  {
    value: '1–3',
    unit: 'days',
    label: 'Apollo surface stays',
    text: 'All human experience of lunar gravity comes from these short stays. A lunar base plans month-long stays, with spacewalks several times a week.',
    hoverBg: 'tech-bg-blue',
  },
  {
    value: '17',
    unit: '%',
    label: 'Less aerobic capacity',
    text: 'Early in space station missions, astronauts’ peak aerobic capacity fell about 17%, while their peak heart rate didn’t change.',
    hoverBg: 'tech-bg-purple',
  },
  {
    value: '10–20',
    unit: 'years',
    label: 'Of arterial aging',
    text: 'Six months in orbit stiffened astronauts’ arteries as much as 10 to 20 years of aging would on Earth.',
    hoverBg: 'tech-bg-green',
  },
  {
    value: '100+',
    unit: '',
    label: 'Spacewalks a year',
    text: 'A working lunar base could need more than a hundred spacewalks a year, more than any ground team can watch over an intermittent link to Earth.',
    hoverBg: 'tech-bg-orange',
  },
];

const SOURCES = [
  {
    label: 'NASA, Artemis Base Camp concept (2020)',
    href: 'https://www.nasa.gov/blogs/missions/2020/10/28/lunar-living-nasas-artemis-base-camp-concept/',
  },
  {
    label: 'Richter et al., Frontiers in Physiology (2017)',
    href: 'https://www.ncbi.nlm.nih.gov/pmc/articles/PMC5559498/',
  },
  {
    label: 'Moore et al., Journal of Applied Physiology (2014)',
    href: 'https://pubmed.ncbi.nlm.nih.gov/24970852/',
  },
  {
    label: 'Hughson et al., American Journal of Physiology (2016)',
    href: 'https://doi.org/10.1152/ajpheart.00802.2015',
  },
];

// Illustrative example: blood pumped per minute = heart rate × volume per beat.
const MONITORS = [
  { name: 'Heart A', perBeat: '70 mL', output: '8.4 L/min', bar: '100%', pulse: '1.18' },
  { name: 'Heart B', perBeat: '50 mL', output: '6.0 L/min', bar: '71%', pulse: '1.08' },
];

const PRINCIPLES = [
  {
    title: 'Personal',
    text: 'One twin for each crewmember, learning how their own heart adapts and recovers across a mission.',
    icon: ['M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z'],
  },
  {
    title: 'Predictive',
    text: 'Forecasts cardiovascular reserve for the next task and the trip home, before a limit is reached.',
    icon: ['M13 7h8m0 0v8m0-8l-8 8-4-4-6 6'],
  },
  {
    title: 'Compares plans',
    text: 'Weighs pace, rest and when to turn back, so the crew can choose with foresight.',
    icon: ['M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4'],
  },
  {
    title: 'On board',
    text: 'Runs on mission hardware, with no Earth link required.',
    icon: ['M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z'],
  },
  {
    title: 'Honest',
    text: 'Shows how confident it is, and says so when it can’t advise.',
    icon: [
      'M15 12a3 3 0 11-6 0 3 3 0 016 0z',
      'M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z',
    ],
  },
  {
    title: 'Crew in command',
    text: 'The crew makes every decision. The twin adds foresight to existing safety rules.',
    icon: ['M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z'],
  },
];

// Planet surfaces are drawn with CSS gradients, so no extra images are needed.
const STOPS: {
  name: string;
  tag: string;
  text: string;
  surface: string;
  link?: { href: string; label: string };
}[] = [
  {
    name: 'The Moon',
    tag: 'The proving ground',
    text: 'Month-long stays, frequent spacewalks, and only intermittent contact with Earth.',
    surface:
      'radial-gradient(circle at 62% 58%, rgba(0,0,0,0.16) 0 9%, transparent 10%), radial-gradient(circle at 38% 70%, rgba(0,0,0,0.12) 0 6%, transparent 7%), radial-gradient(circle at 54% 30%, rgba(0,0,0,0.1) 0 5%, transparent 6%), radial-gradient(circle at 32% 28%, #fafaf9 0%, #d6d3cd 38%, #9c978f 72%, #5d5a55 100%)',
  },
  {
    name: 'Mars',
    tag: 'The destination',
    text: 'Messages take 4 to 22 minutes each way, so crews must make decisions on their own.',
    surface:
      'radial-gradient(ellipse 34% 14% at 55% 62%, rgba(90,25,8,0.35) 0 60%, transparent 64%), radial-gradient(ellipse 22% 10% at 40% 38%, rgba(90,25,8,0.25) 0 60%, transparent 64%), radial-gradient(circle at 32% 28%, #f7c3a1 0%, #e07a4a 35%, #b14a24 70%, #5f200c 100%)',
  },
  {
    name: 'Earth',
    tag: 'Back home',
    text: 'The same idea — a twin that looks ahead — guides our work in critical care.',
    surface:
      'radial-gradient(ellipse 28% 20% at 60% 42%, rgba(80,160,95,0.9) 0 60%, transparent 63%), radial-gradient(ellipse 16% 24% at 36% 64%, rgba(80,160,95,0.85) 0 60%, transparent 63%), radial-gradient(ellipse 36% 9% at 50% 22%, rgba(255,255,255,0.45) 0 55%, transparent 60%), radial-gradient(circle at 32% 28%, #cfeaff 0%, #5aa0e6 32%, #1f62b0 68%, #0c2a55 100%)',
    link: { href: '/technology', label: 'Explore the Technology' },
  },
];

// Builds a heartbeat (ECG) trace: one beat every 300 units, baseline at y = 60.
const ECG_BEAT_WIDTH = 300;

function ecgPath(beats: number) {
  let d = 'M0,60';
  for (let i = 0; i < beats; i++) {
    const x = i * ECG_BEAT_WIDTH;
    d += ` L${x + 100},60 Q${x + 115},50 ${x + 130},60 L${x + 150},60 L${x + 158},68 L${x + 168},12 L${x + 178},84 L${x + 186},60 L${x + 215},60 Q${x + 237},44 ${x + 259},60 L${x + 300},60`;
  }
  return d;
}

function HeartbeatLine({
  beats = 4,
  tone = 'red',
  className = '',
}: {
  beats?: number;
  tone?: 'red' | 'green';
  className?: string;
}) {
  const d = ecgPath(beats);
  return (
    <div className={`w-full ${className}`} aria-hidden="true">
      <svg
        viewBox={`0 0 ${beats * ECG_BEAT_WIDTH} 100`}
        preserveAspectRatio="none"
        className="w-full h-full overflow-visible"
      >
        <path d={d} fill="none" className={tone === 'green' ? 'ecg-base ecg-base-green' : 'ecg-base'} vectorEffect="non-scaling-stroke" />
        <path
          d={d}
          fill="none"
          pathLength={1000}
          className={tone === 'green' ? 'ecg-sweep ecg-sweep-green' : 'ecg-sweep'}
          vectorEffect="non-scaling-stroke"
        />
      </svg>
    </div>
  );
}

export default function Home() {
  const [isScrolled, setIsScrolled] = useState(false);
  const [visibleSections, setVisibleSections] = useState<Set<string>>(new Set());
  const [currentBackground, setCurrentBackground] = useState<'video' | 'gif'>('video');
  const [isVideoEnded, setIsVideoEnded] = useState(false);
  const [videoDuration, setVideoDuration] = useState<number>(0);
  const sectionRefs = useRef<{ [key: string]: HTMLElement | null }>({});
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const handleScroll = () => {
      // Check if we're on the home page
      const isHomePage = window.location.pathname === '/';
      
      // Use different thresholds for home page vs other pages
      const threshold = isHomePage ? window.innerHeight * 1.5 : 100;
      
      setIsScrolled(window.scrollY > threshold);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const sectionId = entry.target.id;
            if (sectionId) {
              setVisibleSections((prev) => new Set(prev).add(sectionId));
            }
            // Add visible class for scroll animations
            entry.target.classList.add('visible');
          } else {
            // Remove visible class when out of view (optional)
            entry.target.classList.remove('visible');
          }
        });
      },
      {
        threshold: 0.1,
        rootMargin: '0px 0px -100px 0px'
      }
    );

    Object.values(sectionRefs.current).forEach((element) => {
      if (element) {
        observer.observe(element);
      }
    });

    // Observe elements with scroll animation classes
    setTimeout(() => {
      const animatedElements = document.querySelectorAll('.scroll-fade-in, .scroll-slide-left, .scroll-slide-right, .scroll-scale-up, .scroll-rotate');
      animatedElements.forEach((el) => observer.observe(el));
    }, 100);

    return () => {
      observer.disconnect();
    };
  }, []);

  // Parallax effect
  useEffect(() => {
    const handleScroll = () => {
      const scrolled = window.pageYOffset;
      const parallaxElements = document.querySelectorAll('.parallax-slow, .parallax-medium, .parallax-fast');
      
      parallaxElements.forEach((element) => {
        const htmlElement = element as HTMLElement;
        const speed = element.classList.contains('parallax-slow') ? 0.5 : 
                     element.classList.contains('parallax-medium') ? 0.3 : 0.1;
        const yPos = -(scrolled * speed);
        htmlElement.style.setProperty('--scroll-slow', `${yPos * 2}px`);
        htmlElement.style.setProperty('--scroll-medium', `${yPos * 1.5}px`);
        htmlElement.style.setProperty('--scroll-fast', `${yPos}px`);
      });
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Handle video and GIF cycling
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleLoadedMetadata = () => {
      setVideoDuration(video.duration);
    };

    const handleVideoEnd = () => {
      setIsVideoEnded(true);
      setCurrentBackground('gif');
      
      // Use video duration for GIF timing, fallback to 5 seconds if duration not available
      const gifDuration = videoDuration > 0 ? videoDuration * 1000 : 5000;
      
      setTimeout(() => {
        setCurrentBackground('video');
        setIsVideoEnded(false);
        video.currentTime = 0; // Reset video to beginning
        video.play();
      }, gifDuration);
    };

    const handleVideoError = () => {
      console.warn('Video failed to load, falling back to GIF');
      setCurrentBackground('gif');
    };

    video.addEventListener('loadedmetadata', handleLoadedMetadata);
    video.addEventListener('ended', handleVideoEnd);
    video.addEventListener('error', handleVideoError);

    return () => {
      video.removeEventListener('loadedmetadata', handleLoadedMetadata);
      video.removeEventListener('ended', handleVideoEnd);
      video.removeEventListener('error', handleVideoError);
    };
  }, [videoDuration]);

  return (
    <div className="min-h-screen bg-white text-black overflow-x-hidden" style={{ scrollBehavior: 'smooth' }}>
      {/* Hero Section */}
      <section className="relative min-h-screen flex items-center justify-center overflow-hidden">
        {/* Background Video */}
        <video
          ref={videoRef}
          className={`absolute inset-0 w-full h-full object-cover ${currentBackground === 'video' ? 'opacity-100' : 'opacity-0'}`}
          autoPlay
          muted
          loop={false}
          playsInline
          style={{ 
            transition: 'none',
            objectPosition: 'center 05%'
          }}
        >
          <source src="/hero_01.mp4" type="video/mp4" />
          Your browser does not support the video tag.
        </video>
        
        {/* Background GIF */}
        <div 
          className={`absolute inset-0 w-full h-full bg-cover bg-center bg-no-repeat ${currentBackground === 'gif' ? 'opacity-100' : 'opacity-0'}`}
          style={{
            backgroundImage: 'url(/hero_02.gif)',
            backgroundPosition: 'center 20%',
            transition: 'none'
          }}
        />
        
        {/* Dark Overlay */}
        <div className="absolute inset-0 bg-black/40"></div>
        
        {/* Blur Overlay */}
        <div className="absolute inset-0 backdrop-blur-[4px] bg-white/5"></div>
        
        {/* Dynamic Blue Circle Overlay */}
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-64 h-64 sm:w-80 sm:h-80 lg:w-96 lg:h-96 bg-blue-500/20 rounded-full blur-3xl animate-pulse"></div>
        
        {/* Main content */}
        <div className="relative z-10 text-center px-3 sm:px-6 lg:px-8 max-w-6xl mx-auto">
          <div className="space-y-8 animate-slideUp">
            <h1 className="text-xl sm:text-5xl lg:text-6xl xl:text-7xl font-bold tracking-tight text-white mb-6 scroll-fade-in parallax-slow">
              Somnium Biolabs
             </h1>
            <p className="text-md sm:text-2xl text-white/90 max-w-3xl mx-auto leading-relaxed animate-fadeInUp animation-delay-200">
             Engineering Tomorrow’s Biology for Life Without Limits  
            </p>
            
            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center items-center mt-8 sm:mt-12 animate-fadeInUp animation-delay-400">
                <LiquidButton 
                  variant="landing"
                  size="lg"
                  className="w-full sm:w-auto cursor-pointer"
                  onClick={() => window.location.href = '/technology'}
                >
                  Explore the Technology
                </LiquidButton>
                <LiquidButton 
                  variant="landing"
                  size="lg"
                  className="w-full sm:w-auto cursor-pointer"
                  onClick={() => window.location.href = '/founder-letter'}
                >
                  Read the Founder's Letter
                </LiquidButton>
            </div>
          </div>
        </div>
      </section>

      {/* Mission Statement */}
      <section
        id="mission"
        className="relative pt-20 lg:pt-32 pb-12 lg:pb-16 overflow-hidden"
        style={{ backgroundColor: '#F8F2EB' }}
      >
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <p className="text-xs sm:text-sm font-semibold uppercase tracking-[0.25em] text-[#9E2306] mb-6 scroll-fade-in">
            Continuous Cardiovascular Twin
          </p>
          <h2 className="text-balance text-3xl sm:text-5xl font-bold text-gray-900 leading-tight mb-8 scroll-fade-in">
            A lunar base will ask more of the human heart than any mission flown.
          </h2>
          <p className="text-lg sm:text-xl text-gray-700 max-w-3xl mx-auto leading-relaxed scroll-fade-in">
            We’re building a personal cardiovascular twin for every crewmember. It looks ahead, runs on board, and keeps the crew in command when Earth is out of reach.
          </p>
        </div>
        <HeartbeatLine className="mt-12 sm:mt-16 h-16 sm:h-24" />
      </section>

      {/* Section Divider */}
      <div className="border-t border-gray-400"></div>

      {/* What We Know Section */}
      <section id="unknown" className="relative py-20 lg:py-28" style={{ backgroundColor: '#F8F2EB' }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12 sm:mb-16">
            <h2 className="text-balance text-3xl sm:text-5xl font-bold text-gray-900 mb-6 scroll-fade-in">
              Into the unknown
            </h2>
            <p className="text-lg sm:text-xl text-gray-700 max-w-3xl mx-auto leading-relaxed scroll-fade-in">
              No one has measured how the heart adapts, recovers or wears down across weeks of repeated spacewalks in lunar gravity. Here is what we do know.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-6">
            {FACTS.map((fact, index) => (
              <div
                key={fact.label}
                className="scroll-fade-in"
                style={{ transitionDelay: `${index * 120}ms` }}
              >
                <div className="h-full bg-white/50 backdrop-blur-sm rounded-xl p-6 group relative overflow-hidden hover:scale-105 transition-transform duration-300">
                  <div className={`absolute inset-0 ${fact.hoverBg} opacity-0 group-hover:opacity-100 transition-opacity duration-300`}></div>
                  <div className="relative z-10">
                    <p className="font-bold text-gray-900 mb-2 leading-none">
                      <span className="text-4xl xl:text-5xl">{fact.value}</span>
                      {fact.unit && (
                        <span className={`text-xl xl:text-2xl font-semibold text-gray-600 ${fact.unit === '%' ? '' : 'ml-1.5'}`}>{fact.unit}</span>
                      )}
                    </p>
                    <p className="text-xs font-semibold uppercase tracking-[0.15em] text-[#9E2306] mt-3 mb-4">
                      {fact.label}
                    </p>
                    <p className="text-gray-700 text-sm sm:text-base leading-relaxed">{fact.text}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <p className="mt-10 text-xs text-gray-500 text-center max-w-4xl mx-auto leading-relaxed">
            Sources:{' '}
            {SOURCES.map((source, index) => (
              <span key={source.href}>
                <a
                  href={source.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline decoration-gray-300 underline-offset-2 hover:text-gray-700"
                >
                  {source.label}
                </a>
                {index < SOURCES.length - 1 ? '; ' : '.'}
              </span>
            ))}
          </p>
        </div>
      </section>

      {/* Section Divider */}
      <div className="border-t border-gray-400"></div>

      {/* Heart Rate Explainer Section */}
      <section id="heartbeat" className="relative py-20 lg:py-28" style={{ backgroundColor: '#F8F2EB' }}>
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12 sm:mb-16">
            <h2 className="text-balance text-3xl sm:text-5xl font-bold text-gray-900 mb-6 scroll-fade-in">
              The same heartbeat can hide a very different heart
            </h2>
            <p className="text-lg sm:text-xl text-gray-700 max-w-3xl mx-auto leading-relaxed scroll-fade-in">
              Heart-rate monitors count beats. They can’t see how much blood each beat moves.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 lg:gap-10">
            {MONITORS.map((monitor, index) => (
              <div
                key={monitor.name}
                className="scroll-fade-in"
                style={{ transitionDelay: `${index * 150}ms` }}
              >
                <div className="rounded-2xl bg-[#0B1117] border border-white/10 shadow-2xl p-6 sm:p-8 text-white">
                  <div className="flex items-center justify-between mb-6">
                    <p className="text-sm font-semibold uppercase tracking-[0.2em] text-white/60">{monitor.name}</p>
                    <svg
                      className="heart-pulse w-8 h-8 text-[#E5484D]"
                      style={{ '--pulse-scale': monitor.pulse } as React.CSSProperties}
                      viewBox="0 0 24 24"
                      fill="currentColor"
                      aria-hidden="true"
                    >
                      <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
                    </svg>
                  </div>

                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-300/80 mb-1">Heart rate</p>
                  <p className="text-5xl sm:text-6xl font-bold text-emerald-400 tabular-nums mb-4">
                    120 <span className="text-lg sm:text-xl font-medium text-emerald-300/80">beats/min</span>
                  </p>
                  <HeartbeatLine tone="green" className="h-12 mb-6" />

                  <div className="grid grid-cols-2 gap-4 mb-5">
                    <div>
                      <p className="text-xs uppercase tracking-[0.15em] text-white/50 mb-1">Per beat</p>
                      <p className="text-2xl sm:text-3xl font-semibold tabular-nums">{monitor.perBeat}</p>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-[0.15em] text-white/50 mb-1">Blood pumped</p>
                      <p className="text-2xl sm:text-3xl font-semibold tabular-nums">{monitor.output}</p>
                    </div>
                  </div>
                  <div className="h-3 rounded-full bg-white/10 overflow-hidden">
                    <div
                      className="output-bar h-full rounded-full bg-gradient-to-r from-[#E5484D] to-[#F59E0B]"
                      style={{ '--bar': monitor.bar } as React.CSSProperties}
                    ></div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="text-center mt-12 max-w-3xl mx-auto">
            <p className="text-2xl sm:text-3xl font-bold text-gray-900 mb-4 text-balance scroll-fade-in">
              29% less blood, and the heart rate reads the same.
            </p>
            <p className="text-base sm:text-lg text-gray-700 leading-relaxed scroll-fade-in">
              When capacity falls, the same work gets harder too. After a 17% drop in capacity, a task that took half of a crewmember’s capacity takes 60%.
            </p>
            <p className="mt-6 text-xs text-gray-500">
              Illustrative numbers. Blood pumped per minute = heart rate × volume per beat.
            </p>
          </div>
        </div>
      </section>

      {/* A Twin That Looks Ahead Section */}
      <section id="approach" className="relative py-20 lg:py-32 overflow-hidden">
        {/* Background Video */}
        <video
          className="absolute inset-0 w-full h-full object-cover"
          autoPlay
          muted
          loop
          playsInline
          poster="/phy-poster.jpg"
          aria-hidden="true"
        >
          <source src="/phy.mp4" type="video/mp4" />
        </video>
        {/* Dark Overlay */}
        <div className="absolute inset-0 bg-black/60"></div>
        {/* Blur Overlay */}
        <div className="absolute inset-0 backdrop-blur-[2px] bg-white/5"></div>

        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12 sm:mb-16">
            <h2 className="text-balance text-3xl sm:text-5xl font-bold text-white mb-6 scroll-fade-in">
              A twin that looks ahead
            </h2>
            <p className="text-lg sm:text-xl text-white/85 max-w-3xl mx-auto leading-relaxed scroll-fade-in">
              Today’s monitors describe the present and react to limits. Our twin forecasts what comes next.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 lg:gap-6">
            {PRINCIPLES.map((principle, index) => (
              <div
                key={principle.title}
                className="scroll-fade-in"
                style={{ transitionDelay: `${(index % 3) * 120}ms` }}
              >
                <div className="h-full rounded-xl bg-white/[0.08] border border-white/15 p-6 hover:bg-white/[0.14] transition-colors duration-300">
                  <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center mb-4">
                    <svg className="w-6 h-6 text-gray-800" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                      {principle.icon.map((d) => (
                        <path key={d} strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={d} />
                      ))}
                    </svg>
                  </div>
                  <h3 className="text-lg font-semibold text-white mb-2">{principle.title}</h3>
                  <p className="text-white/80 text-sm sm:text-base leading-relaxed">{principle.text}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Moon to Mars Section */}
      <section id="horizon" className="relative py-20 lg:py-28" style={{ backgroundColor: '#F8F2EB' }}>
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-14 sm:mb-20">
            <h2 className="text-balance text-3xl sm:text-5xl font-bold text-gray-900 mb-6 scroll-fade-in">
              Proven on the Moon, built for Mars
            </h2>
            <p className="text-lg sm:text-xl text-gray-700 max-w-3xl mx-auto leading-relaxed scroll-fade-in">
              The farther crews travel, the less Earth can help in the moment. We’re building for that future, and bringing what we learn back home.
            </p>
          </div>

          <div className="relative">
            {/* Dashed path between the planets (desktop) */}
            <div
              aria-hidden="true"
              className="hidden md:block absolute top-14 left-[16.67%] right-[16.67%] border-t-2 border-dashed border-gray-400/70"
            ></div>
            <ol className="relative grid grid-cols-1 md:grid-cols-3 gap-10 md:gap-8">
              {STOPS.map((stop, index) => (
                <li
                  key={stop.name}
                  className="relative scroll-fade-in"
                  style={{ transitionDelay: `${index * 150}ms` }}
                >
                  {/* Dashed path between the planets (mobile) */}
                  {index < STOPS.length - 1 && (
                    <div
                      aria-hidden="true"
                      className="md:hidden absolute left-10 top-20 -bottom-10 border-l-2 border-dashed border-gray-400/70"
                    ></div>
                  )}
                  <div className="flex md:flex-col items-start md:items-center gap-5 md:gap-0 md:text-center">
                    <div
                      aria-hidden="true"
                      className="planet relative z-10 w-20 h-20 md:w-28 md:h-28 shrink-0 rounded-full md:mb-6"
                      style={{ background: stop.surface }}
                    ></div>
                    <div className="pt-1 md:pt-0">
                      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#9E2306] mb-1">{stop.tag}</p>
                      <h3 className="text-2xl font-bold text-gray-900 mb-2">{stop.name}</h3>
                      <p className="text-gray-700 leading-relaxed md:max-w-xs md:mx-auto">{stop.text}</p>
                      {stop.link && (
                        <Link
                          href={stop.link.href}
                          className="inline-flex items-center gap-2 mt-5 px-5 py-2.5 rounded-full bg-gray-900 text-white text-sm font-medium hover:bg-gray-700 transition-colors"
                        >
                          {stop.link.label}
                          <span aria-hidden="true">→</span>
                        </Link>
                      )}
                    </div>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </section>

      {/* Section Divider */}
      <div className="border-t border-gray-400"></div>

      {/* Contact Section */}
      <section id="contact" className="py-16 sm:py-24 text-center" style={{ backgroundColor: '#F8F2EB' }}>
        <div className="max-w-3xl mx-auto px-4 sm:px-6">
          <h2 className="text-balance text-2xl sm:text-4xl font-bold text-gray-900 mb-4 scroll-fade-in">
            Working on human spaceflight or crew health?
          </h2>
          <p className="text-base sm:text-lg text-gray-700 leading-relaxed mb-8 scroll-fade-in">
            Let’s talk. Researchers, mission planners, partners and future teammates are all welcome.
          </p>
          <a
            href="mailto:contact@somniumbio.com"
            className="inline-flex items-center px-6 py-3 rounded-full bg-gray-900 text-white font-medium hover:bg-gray-700 transition-colors"
          >
            contact@somniumbio.com
          </a>
        </div>
      </section>

      {/* Footer */}
      <Footer variant="home" />
    </div>
  );
}
