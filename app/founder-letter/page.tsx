'use client';

import { useEffect, useRef, useState } from 'react';
import Footer from '../components/Footer';
import FooterNav from '../components/FooterNav';
import Navigation from '../components/Navigation';
import { LiquidButton } from '../components/ui/liquid-glass-button';

export default function FounderLetter() {
  const [activeSection, setActiveSection] = useState('why-now');
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
        setActiveSection('why-now');
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

  const sections = [
    { id: 'why-now', title: 'Why Now' },
    { id: 'our-responsibility', title: 'Our Responsibility' },
    { id: 'the-dream', title: 'The Dream We Serve' }
  ];

  return (
    <div className="min-h-screen bg-stone-50">
      {/* Navigation */}
      <Navigation />
      
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
            Founder Letter
          </h1>
          <div className="flex flex-wrap justify-center gap-2 sm:gap-4 mb-6">
            <LiquidButton variant="founder-letter" size="sm">
              Company
            </LiquidButton>
            <LiquidButton variant="founder-letter" size="sm">
              Vision
            </LiquidButton>
          </div>
          <p className="text-base sm:text-lg lg:text-xl text-blue-100 max-w-3xl mx-auto leading-relaxed">
          Every ICU patient is a physiological mystery to solve
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
                  <p className="text-gray-700 leading-relaxed text-lg mb-8">
                  Digital Twin technologies has been used for years in manufacturing, aerospace, supply chain, and many other fields. Nowadays, no human would step onto a plane without countless safety simulations in place. Medicine deserves the same precision.
                  </p>
                </div>

                {/* Why Now */}
                <div 
                  ref={(el) => { sectionsRef.current['why-now'] = el; }}
                  className={`mb-12 transition-all duration-700 ${
                    visibleSections.has('why-now') 
                      ? 'opacity-100 translate-y-0' 
                      : 'opacity-0 translate-y-8'
                  }`}
                  id="why-now"
                >
                  <h3 className="text-2xl font-bold text-gray-900 mb-4">
                    Why Now
                  </h3>
                  <p className="text-gray-700 leading-relaxed text-lg">
                    The convergence of real-time clinical data, advanced modeling, and powerful AI finally makes this possible. We are at a crucial stage in not just our healthcare system but our civilization. If we can navigate this radical change with the right values, compassion, and shared prosperity, we can build systems of the future that will enable humanity to thrive and reach our destiny of becoming multi-planetary.
                  </p>
                </div>

                {/* Our Responsibility */}
                <div 
                  ref={(el) => { sectionsRef.current['our-responsibility'] = el; }}
                  className={`mb-12 transition-all duration-700 ${
                    visibleSections.has('our-responsibility') 
                      ? 'opacity-100 translate-y-0' 
                      : 'opacity-0 translate-y-8'
                  }`}
                  id="our-responsibility"
                >
                  <h3 className="text-2xl font-bold text-gray-900 mb-4">
                    Our Responsibility
                  </h3>
                  <p className="text-gray-700 leading-relaxed text-lg mb-6">
                    We are not building another black box.
                  </p>
                  <p className="text-gray-700 leading-relaxed text-lg">
                    Somnium Biolabs is built on the values of compassion, growth, and freedom. These values permeate through our actions and our Twin Engine; because without our values aligned, there can be no trust. Trust has been the most sacred aspect of medicine, but we are rapidly losing this due to many factors, which I am sure you can identify. It is our responsibility, as doctors and healthcare workers, to ensure we build systems and solutions that scale trust as much as we scale computation and diagnostic accuracy.
                  </p>
                </div>

                {/* The Dream We Serve */}
                <div 
                  ref={(el) => { sectionsRef.current['the-dream'] = el; }}
                  className={`mb-12 transition-all duration-700 ${
                    visibleSections.has('the-dream') 
                      ? 'opacity-100 translate-y-0' 
                      : 'opacity-0 translate-y-8'
                  }`}
                  id="the-dream"
                >
                  <h3 className="text-2xl font-bold text-gray-900 mb-4">
                    The Dream We Serve
                  </h3>
                  <p className="text-gray-700 leading-relaxed text-lg mb-6">
                    "Somnium" means The Dream.
                  </p>
                  <p className="text-gray-700 leading-relaxed text-lg mb-6">
                    It reflects a strong personal belief that you create what you believe. So if I believe in the possibility of a dream-like utopia, and I work hard towards this dream, it will come to fruition. This is what inspired me to start Somnium Biolabs. We are building the lab of the future, one that is not afraid to tackle the impossible dreams of humanity.
                  </p>
                  <p className="text-gray-700 leading-relaxed text-lg mb-8">
                    Next leap in medicine will not come from more data alone, but from creating living models of ourselves — mirrors through which we can safely explore the boundaries of life and consciousness.
                  </p>
                  
                  {/* Quote Section */}
                  <div className="bg-gray-50 border-l-4 border-gray-600 p-6 my-8">
                    <blockquote className="text-xl italic text-gray-800 mb-4">
                      "Beliefs color your world. So why not believe in the biggest dream you possibly can imagine?"
                    </blockquote>
                    <p className="text-gray-700 font-semibold">
                      — Dr. Chintan Dave
                    </p>
                    <p className="text-gray-600 text-sm">
                      Founder & CEO, Somnium Biolabs
                    </p>
                  </div>
                </div>

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
