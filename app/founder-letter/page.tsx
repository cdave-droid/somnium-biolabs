'use client';

import Image from 'next/image';
import { useEffect, useRef, useState } from 'react';
import Footer from '../components/Footer';
import FooterNav from '../components/FooterNav';
import { LiquidButton } from '../components/ui/liquid-glass-button';
import { header, intro, sections, signOff } from './content';

export default function FounderLetter() {
  const [activeSection, setActiveSection] = useState(sections[0].id);
  const [showBottomBar, setShowBottomBar] = useState(false);
  const [hideBottomBar, setHideBottomBar] = useState(false);
  const [scrollProgress, setScrollProgress] = useState(0);
  const [visibleSections, setVisibleSections] = useState<Set<string>>(new Set());
  const sectionsRef = useRef<{ [key: string]: HTMLDivElement | null }>({});

  useEffect(() => {
    const handleScroll = () => {
      const scrollPosition = window.scrollY;
      const blueSectionHeight = 600; // Approximate height of the blue section
      const documentHeight = document.documentElement.scrollHeight;
      const windowHeight = window.innerHeight;
      
      // Show bottom bar when scrolling past the blue section
      setShowBottomBar(scrollPosition > blueSectionHeight);
      
      // Hide bottom bar when approaching footer (around 80% scroll or when near footer)
      const footerThreshold = documentHeight - windowHeight - 200; // 200px before footer
      setHideBottomBar(scrollPosition >= footerThreshold);
      
      // Calculate scroll progress for the gradient line (only in white content area, before footer)
      if (scrollPosition > blueSectionHeight && scrollPosition < footerThreshold) {
        const contentScrollPosition = scrollPosition - blueSectionHeight;
        const contentHeight = footerThreshold - blueSectionHeight;
        const contentScrollPercentage = (contentScrollPosition / contentHeight) * 100;
        setScrollProgress(Math.min(contentScrollPercentage, 100));
      } else {
        setScrollProgress(0);
      }
      
      // Reset to first section when scrolling back up to the top
      if (scrollPosition <= blueSectionHeight) {
        setActiveSection(sections[0].id);
        return;
      }
      
      // Only track sections when we're in the white content area
      if (scrollPosition > blueSectionHeight - 100) {
        for (const [sectionId, element] of Object.entries(sectionsRef.current)) {
          if (element) {
            const { offsetTop, offsetHeight } = element;
            const adjustedOffsetTop = offsetTop - blueSectionHeight;
            const adjustedScrollPosition = scrollPosition - blueSectionHeight;
            
            if (adjustedScrollPosition >= adjustedOffsetTop && adjustedScrollPosition < adjustedOffsetTop + offsetHeight) {
              setActiveSection(sectionId);
              break;
            }
          }
        }
      }
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
            setVisibleSections((prev) => new Set(prev).add(sectionId));
          }
        });
      },
      {
        threshold: 0.1,
        rootMargin: '0px 0px -100px 0px'
      }
    );

    Object.values(sectionsRef.current).forEach((element) => {
      if (element) {
        observer.observe(element);
      }
    });

    return () => {
      observer.disconnect();
    };
  }, []);

  const scrollToSection = (sectionId: string) => {
    const element = sectionsRef.current[sectionId];
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <div className="min-h-screen bg-stone-50">
      {/* The top menu comes from the site layout (app/layout.tsx), so the page doesn't draw its own. */}

      {/* Header Section - Founder Letter */}
      <section className="py-20 text-white relative overflow-hidden">
        {/* Background image */}
        <div 
          className="absolute inset-0 bg-cover bg-center bg-no-repeat"
          style={{ backgroundImage: 'url(/y1.jpg)' }}
        ></div>
        {/* Dark overlay for readability */}
        <div className="absolute inset-0 bg-black/30"></div>
        {/* Blur overlay */}
        <div className="absolute inset-0 backdrop-blur-sm bg-white/10"></div>
        {/* Noise/Texture overlay */}
        <div className="absolute inset-0 opacity-10" style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 400 400' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)' opacity='0.1'/%3E%3C/svg%3E")`
        }}></div>
        <div className="max-w-4xl mx-auto px-3 sm:px-6 lg:px-8 text-center relative z-10">
          <h1 className="text-3xl sm:text-4xl lg:text-6xl font-bold mb-6 mt-20">
            {header.title}
          </h1>
          <div className="flex flex-wrap justify-center gap-2 sm:gap-4 mb-6">
            {header.labels.map((label) => (
              <LiquidButton key={label} variant="founder-letter" size="sm">
                {label}
              </LiquidButton>
            ))}
          </div>
          <p className="text-base sm:text-lg lg:text-xl text-blue-100 max-w-3xl mx-auto leading-relaxed">
            {header.subtitle}
          </p>
        </div>
      </section>

      {/* Scrollable Main Content */}
      <section className="relative bg-stone-50">
        <div className="pb-20">
          <div className="flex relative">
            {/* Left Sidebar Navigation - Sticky to white content area - Hidden on mobile */}
            <div className="hidden md:block sticky top-24 left-0 h-fit z-40 pl-4 sm:pl-8 mr-4 sm:mr-8 pt-8">
              <nav className="space-y-3">
                {sections.map((section) => (
                  <button
                    key={section.id}
                    onClick={() => scrollToSection(section.id)}
                    className={`block text-left transition-all duration-300 relative ${
                      activeSection === section.id
                        ? 'text-gray-900 font-medium text-base'
                        : 'text-gray-600 hover:text-gray-900 text-sm'
                    }`}
                  >
                    {/* Horizontal line before each item */}
                    <div className={`absolute left-0 top-1/2 transform -translate-y-1/2 -ml-8 w-4 h-px transition-colors duration-300 ${
                      activeSection === section.id ? 'bg-gray-900' : 'bg-gray-400'
                    }`}></div>
                    
                    {activeSection === section.id && (
                      <div className="absolute left-0 top-1/2 transform -translate-y-1/2 -ml-8 w-px h-4 bg-gray-900"></div>
                    )}
                    {section.title}
                  </button>
                ))}
              </nav>
            </div>

      {/* Main Content */}
            <div className="flex-1 max-w-4xl mx-auto px-3 sm:px-6 lg:px-8 py-12">
            <div className="prose prose-lg max-w-none">
                
                {/* Introduction */}
                <div className="mb-16">
                  {intro.map((paragraph, index) => (
                    <p key={index} className={`text-gray-700 leading-relaxed text-lg ${index < intro.length - 1 ? 'mb-6' : 'mb-8'}`}>
                      {paragraph}
                    </p>
                  ))}
                </div>

                {/* Sections (each one is an item in the left-hand menu) */}
                {sections.map((section, sectionIndex) => (
                  <div
                    key={section.id}
                    ref={(el) => { sectionsRef.current[section.id] = el; }}
                    className={`mb-12 transition-all duration-700 ${
                      visibleSections.has(section.id)
                        ? 'opacity-100 translate-y-0'
                        : 'opacity-0 translate-y-8'
                    }`}
                    id={section.id}
                  >
                    <h3 className="text-2xl font-bold text-gray-900 mb-4">
                      {section.title}
                    </h3>
                    {section.paragraphs.map((paragraph, index) => (
                      <p key={index} className={`text-gray-700 leading-relaxed text-lg ${index < section.paragraphs.length - 1 ? 'mb-6' : ''}`}>
                        {paragraph}
                      </p>
                    ))}

                    {/* Quote Section: closes the letter */}
                    {sectionIndex === sections.length - 1 && (
                      <div className="bg-gray-50 border-l-4 border-gray-600 p-6 my-8">
                        <blockquote className="text-xl italic text-gray-800 mb-4">
                          {signOff.quote.map((line, i) => (
                            <span key={line} className="block">
                              {i === 0 && '“'}{line}{i === signOff.quote.length - 1 && '”'}
                            </span>
                          ))}
                        </blockquote>
                        <div className="flex items-end justify-between gap-6">
                          <div>
                            <p className="text-gray-700 font-semibold">
                              — {signOff.name}
                            </p>
                            <p className="text-gray-600 text-sm">
                              {signOff.role}
                            </p>
                          </div>
                          {/* Photo in a circle outline, with the Instagram handle underneath; both link to Instagram */}
                          <a
                            href={signOff.instagram}
                            target="_blank"
                            rel="noopener noreferrer"
                            aria-label={`${signOff.name} on Instagram, @${signOff.handle}`}
                            className="group flex shrink-0 flex-col items-center"
                          >
                            <span className="block rounded-full p-1 ring-2 ring-gray-300 transition-colors duration-200 group-hover:ring-gray-500">
                              <span className="block h-20 w-20 sm:h-28 sm:w-28 overflow-hidden rounded-full">
                                <Image
                                  src={signOff.photo}
                                  alt={signOff.name}
                                  width={224}
                                  height={224}
                                  className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                                />
                              </span>
                            </span>
                            <span className="mt-2 inline-flex items-center gap-1.5 text-sm font-medium text-gray-700 underline-offset-4 group-hover:text-gray-900 group-hover:underline">
                              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                                <rect x="3" y="3" width="18" height="18" rx="5" />
                                <circle cx="12" cy="12" r="4" />
                                <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" />
                              </svg>
                              @{signOff.handle}
                            </span>
                          </a>
                        </div>
                      </div>
                    )}
                  </div>
                ))}

            </div>
          </div>
        </div>
      </div>
    </section>

      {/* Footer */}
      <Footer 
        variant="founder-letter"
      />

      {/* Growing Gradient Line - Shows when scrolling */}
      {showBottomBar && !hideBottomBar && (
        <div className="fixed bottom-0 left-0 right-0 z-50">
          {/* Growing gradient line based on scroll progress */}
          <div className="px-12 py-4 bg-gradient-to-r from-white/10 via-gray-100/20 to-white/10">
            <div className="h-2 bg-gray-200/50 rounded-full relative overflow-hidden">
              <div 
                className="h-full rounded-full transition-all duration-100 ease-out"
                style={{ 
                  width: `${scrollProgress}%`,
                  background: scrollProgress < 20 
                    ? 'linear-gradient(to right, #fca5a5, #ef4444)' // Light Red to Red
                    : scrollProgress < 40 
                    ? 'linear-gradient(to right, #fca5a5, #f97316)' // Light Red to Orange
                    : scrollProgress < 60 
                    ? 'linear-gradient(to right, #fca5a5, #f97316, #fde047)' // Light Red to Orange to Light Yellow
                    : scrollProgress < 80 
                    ? 'linear-gradient(to right, #fca5a5, #f97316, #fde047, #86efac)' // Light Red to Orange to Light Yellow to Light Green
                    : 'linear-gradient(to right, #fca5a5, #f97316, #fde047, #86efac, #93c5fd)' // Full gradient with lighter colors
                }}
              ></div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
