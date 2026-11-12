'use client';

import { useEffect, useState, useRef } from 'react';
import Footer from './components/Footer';
import ApproachStory from './components/ApproachStory';
import DataHorizon from './components/DataHorizon';
import HorizonBackdrop from './components/HorizonBackdrop';
import { LiquidButton } from './components/ui/liquid-glass-button';

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
    <div className="min-h-screen bg-[#0B0F14] text-white overflow-x-clip" style={{ scrollBehavior: 'smooth' }}>
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
                  Read the Founder Letter
                </LiquidButton>
            </div>
          </div>
        </div>
      </section>

      {/* Everything after the hero shares one backdrop that stays on screen while the sections scroll over it */}
      <div className="relative">
        <div className="pointer-events-none absolute inset-0">
          <div className="sticky top-0 h-screen">
            <HorizonBackdrop />
          </div>
        </div>

        <div className="relative">
          {/* Where the data runs out */}
          <DataHorizon />

          {/* A model of one */}
          <ApproachStory />

          {/* Contact Section */}
          <section id="contact" className="text-white text-center">
            <div className="max-w-3xl mx-auto px-6 pt-20 pb-28 sm:pt-24 sm:pb-32">
              <h2 className="text-balance text-3xl sm:text-5xl font-bold tracking-tight leading-[1.1]">
                Working on or interested in human spaceflight or extreme medicine?
              </h2>
              <p className="mt-6 text-lg sm:text-2xl text-white/90 leading-relaxed">
                Let’s talk.
              </p>
              <a
                href="mailto:contact@somniumbio.com"
                className="mt-10 inline-flex items-center px-7 py-3.5 rounded-full bg-white text-gray-900 font-semibold hover:bg-gray-200 active:scale-[0.98] transition"
              >
                contact@somniumbio.com
              </a>
            </div>
          </section>

          {/* Footer */}
          <Footer variant="home" />
        </div>
      </div>
    </div>
  );
}
