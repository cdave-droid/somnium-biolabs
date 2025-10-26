'use client';

import { useEffect, useState, useRef } from 'react';
import Footer from './components/Footer';
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

      {/* Virtual Human Section */}
        <section 
          ref={(el) => { sectionRefs.current['virtual-human'] = el; }}
          id="virtual-human"
          className="relative py-20 lg:py-32"
          style={{ backgroundColor: '#F8F2EB' }}
        >
        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl sm:text-5xl font-bold text-gray-900 mb-6 animate-fadeInUp">
            The world's first virtual physiological human unlocks human life without limits, for Earth and Beyond.
            </h2>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 md:gap-12">
            {/* Critical Care */}
            <div className="text-center scroll-slide-left animation-delay-200 hover:scale-105 transition-all duration-500 group relative">
              <div className="relative">
                <div className="w-32 h-32 sm:w-40 sm:h-40 md:w-48 md:h-48 mx-auto mb-6 sm:mb-8 rounded-full overflow-hidden bg-white/50 flex items-center justify-center relative z-10 border-2 border-transparent group-hover:border-gray-400 transition-colors duration-300">
                  <img 
                    src="/Critical_Care.jpg" 
                    alt="Critical Care" 
                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                  />
                </div>
              </div>
              
              <h3 className="text-xl sm:text-2xl font-bold text-gray-700 mb-3 sm:mb-4 group-hover:text-gray-700 transition-colors duration-300">Critical Care</h3>
              <p className="text-gray-700 text-base sm:text-lg group-hover:text-gray-700 transition-colors duration-300">
                Improved patient outcomes through custom simulations of personalized patient digital twins
              </p>
            </div>

            {/* Clinical Research */}
            <div className="text-center scroll-fade-in animation-delay-400 hover:scale-105 transition-all duration-500 group relative">
              <div className="relative">
                <div className="w-32 h-32 sm:w-40 sm:h-40 md:w-48 md:h-48 mx-auto mb-6 sm:mb-8 rounded-full overflow-hidden bg-white/50 flex items-center justify-center relative z-10 border-2 border-transparent group-hover:border-gray-400 transition-colors duration-300">
                  <img 
                    src="/Clinical_Research.jpg" 
                    alt="Clinical Research" 
                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                  />
                </div>
              </div>
              
              <h3 className="text-xl sm:text-2xl font-bold text-gray-700 mb-3 sm:mb-4 group-hover:text-gray-700 transition-colors duration-300">Clinical Research</h3>
              <p className="text-gray-700 text-base sm:text-lg group-hover:text-gray-700 transition-colors duration-300">
              Complete human physiological research platform, enabling rapid and cost-effective hypotheses generation and testing
              </p>
            </div>
            
            {/* Aerospace */}
            <div className="text-center scroll-slide-right animation-delay-600 hover:scale-105 transition-all duration-500 group relative">
              <div className="relative">
                <div className="w-32 h-32 sm:w-40 sm:h-40 md:w-48 md:h-48 mx-auto mb-6 sm:mb-8 rounded-full overflow-hidden bg-white/50 flex items-center justify-center relative z-10 border-2 border-transparent group-hover:border-gray-400 transition-colors duration-300">
                  <img 
                    src="/Aerospace.jpg" 
                    alt="Aerospace" 
                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                  />
                </div>
              </div>
              
              <h3 className="text-xl sm:text-2xl font-bold text-gray-700 mb-3 sm:mb-4 group-hover:text-gray-700 transition-colors duration-300">Aerospace</h3>
              <p className="text-gray-700 text-base sm:text-lg group-hover:text-gray-700 transition-colors duration-300">
              Unlock countless new avenues for human space research, cutting time and cost for testing, therapeutics, and improving astronaut outcomes
                </p>
            </div>
          </div>
        </div>
      </section>

      {/* Section Divider */}
      <div className="border-t border-gray-400"></div>

      {/* A Word on The Tech Section */}
      <section 
        ref={(el) => { sectionRefs.current['tech'] = el; }}
        id="tech"
        className="relative py-20 lg:py-32"
        style={{ backgroundColor: '#F8F2EB' }}
      >
        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl sm:text-5xl font-bold mb-6 animate-fadeInUp">
              A Word on <span className="text-gray-800">The Tech</span>
            </h2>
            <p className="text-xl text-gray-700 max-w-4xl mx-auto leading-relaxed scroll-fade-in animation-delay-200">
            Our Somnium Twin Engine (STE) combines cutting-edge AI infrastructure and advanced machine learning with deep domain expertise in physiology to create powerful new tools for healthcare innovation. Our technology provides a unified and personalized intelligence for the entire patient.
             </p>
          </div>
          
          {/* Static Cards Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 lg:gap-8">
            <div className="bg-white/50 backdrop-blur-sm rounded-xl p-4 sm:p-6 text-center hover:scale-105 transition-all duration-300 group relative overflow-hidden">
              {/* Animated Background */}
              <div className="absolute inset-0 tech-bg-blue opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
              
              <div className="w-16 h-16 mx-auto mb-4 flex items-center justify-center relative z-10">
                <svg className="w-12 h-12 text-gray-700 tech-blue transition-colors duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
              </div>
              <h3 className="text-lg font-bold text-gray-700 mb-3 tech-blue transition-colors duration-300">Foundation Models</h3>
              <p className="text-gray-700 text-xs sm:text-sm leading-relaxed group-hover:text-gray-700 transition-colors duration-300">
                Advanced AI models trained on massive human physiology datasets, providing deep understanding and physiological grounding to siloed medical data.
              </p>
            </div>

            <div className="bg-white/50 backdrop-blur-sm rounded-xl p-4 sm:p-6 text-center hover:scale-105 transition-all duration-300 group relative overflow-hidden">
              {/* Animated Background */}
              <div className="absolute inset-0 tech-bg-purple opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
              
              <div className="w-16 h-16 mx-auto mb-4 flex items-center justify-center relative z-10">
                <svg className="w-12 h-12 text-gray-700 tech-purple transition-colors duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" />
                </svg>
              </div>
              <h3 className="text-lg font-bold text-gray-700 mb-3 tech-purple transition-colors duration-300">Multi-omics Integration</h3>
              <p className="text-gray-700 text-xs sm:text-sm leading-relaxed group-hover:text-gray-700 transition-colors duration-300">
                Seamlessly integrate genomic, transcriptomic, proteomic, and metabolomic data for comprehensive personalized patient analyses.
              </p>
            </div>

            <div className="bg-white/50 backdrop-blur-sm rounded-xl p-4 sm:p-6 text-center hover:scale-105 transition-all duration-300 group relative overflow-hidden">
              {/* Animated Background */}
              <div className="absolute inset-0 tech-bg-green opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
              
              <div className="w-16 h-16 mx-auto mb-4 flex items-center justify-center relative z-10">
                <svg className="w-12 h-12 text-gray-700 tech-green transition-colors duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <h3 className="text-lg font-bold text-gray-700 mb-3 tech-green transition-colors duration-300">Real-time Processing</h3>
              <p className="text-gray-700 text-xs sm:text-sm leading-relaxed group-hover:text-gray-700 transition-colors duration-300">
                Lightning-fast analysis capabilities that scale from single samples to population-level studies.
              </p>
            </div>

            <div className="bg-white/50 backdrop-blur-sm rounded-xl p-4 sm:p-6 text-center hover:scale-105 transition-all duration-300 group relative overflow-hidden">
              {/* Animated Background */}
              <div className="absolute inset-0 tech-bg-orange opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
              
              <div className="w-16 h-16 mx-auto mb-4 flex items-center justify-center relative z-10">
                <svg className="w-12 h-12 text-gray-700 tech-orange transition-colors duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 100 4m0-4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 100 4m0-4v2m0-6V4" />
                </svg>
              </div>
              <h3 className="text-lg font-bold text-gray-700 mb-3 tech-orange transition-colors duration-300">Precision Predictions</h3>
              <p className="text-gray-700 text-xs sm:text-sm leading-relaxed group-hover:text-gray-700 transition-colors duration-300">
                High-accuracy outcome predictions and research simulations with quantified uncertainty.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Section Divider */}
      <div className="border-t border-gray-400"></div>

      {/* Design Optimization Section */}
      <section 
        ref={(el) => { sectionRefs.current['design-optimization'] = el; }}
        id="design-optimization"
        className="relative py-20 lg:py-32"
      >
        {/* Background Video */}
        <video
          className="absolute inset-0 w-full h-full object-cover"
          autoPlay
          muted
          loop
          playsInline
          style={{ 
            objectPosition: 'center center'
          }}
        >
          <source src="/phy.mp4" type="video/mp4" />
          Your browser does not support the video tag.
        </video>
        
        {/* Dark Overlay */}
        <div className="absolute inset-0 bg-black/50"></div>
        
        {/* Blur Overlay */}
        <div className="absolute inset-0 backdrop-blur-[2px] bg-white/5"></div>
        
        <div className="relative z-10 max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl sm:text-5xl font-bold text-white mb-6 animate-fadeInUp">
            Physiological Simulation, Outcome Optimization, and Deep Personalization
            </h2>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-6 lg:gap-8 relative">
            {/* Background Particles */}
            <div className="absolute inset-0 pointer-events-none overflow-hidden">
              {[...Array(15)].map((_, i) => (
                <div
                  key={i}
                  className="absolute w-1 h-1 bg-gray-400 rounded-full opacity-20 animate-particleFloat"
                  style={{
                    left: `${Math.random() * 100}%`,
                    top: `${Math.random() * 100}%`,
                    animationDelay: `${Math.random() * 5}s`,
                    animationDuration: `${3 + Math.random() * 4}s`
                  }}
                />
              ))}
            </div>
            {/* Benefit 1 */}
            <div className="text-center animate-fadeInUp animation-delay-200 hover:scale-105 transition-all duration-500 group relative">
              <div className="w-12 h-12 sm:w-16 sm:h-16 bg-white rounded-full flex items-center justify-center mx-auto mb-4 sm:mb-6 relative group-hover:animate-pulse">
                <svg className="w-6 h-6 sm:w-8 sm:h-8 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
              </div>
              <p className="text-white text-xs sm:text-sm leading-relaxed group-hover:text-gray-200 transition-colors duration-300">
              Enhanced understanding of baseline physiologic performance
              </p>
            </div>

            {/* Benefit 2 */}
            <div className="text-center animate-fadeInUp animation-delay-300 hover:scale-105 transition-all duration-500 group relative">
              <div className="w-12 h-12 sm:w-16 sm:h-16 bg-white rounded-full flex items-center justify-center mx-auto mb-4 sm:mb-6 relative group-hover:animate-pulse">
                <svg className="w-6 h-6 sm:w-8 sm:h-8 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                </svg>
              </div>
              <p className="text-white text-xs sm:text-sm leading-relaxed group-hover:text-gray-200 transition-colors duration-300">
              Hypothesis generation and testing through numerous physiologic simulations
              </p>
            </div>

            {/* Benefit 3 */}
            <div className="text-center animate-fadeInUp animation-delay-400 hover:scale-105 transition-all duration-500 group relative">
              <div className="w-12 h-12 sm:w-16 sm:h-16 bg-white rounded-full flex items-center justify-center mx-auto mb-4 sm:mb-6 relative group-hover:animate-pulse">
                <svg className="w-6 h-6 sm:w-8 sm:h-8 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
              <p className="text-white text-xs sm:text-sm leading-relaxed group-hover:text-gray-200 transition-colors duration-300">
              Decreased research and prototyping time, costs, and improved patient outcomes
              </p>
            </div>

            {/* Benefit 4 */}
            <div className="text-center animate-fadeInUp animation-delay-500 hover:scale-105 transition-all duration-500 group relative">
              <div className="w-12 h-12 sm:w-16 sm:h-16 bg-white rounded-full flex items-center justify-center mx-auto mb-4 sm:mb-6 relative group-hover:animate-pulse">
                <svg className="w-6 h-6 sm:w-8 sm:h-8 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                </svg>
              </div>
              <p className="text-white text-xs sm:text-sm leading-relaxed group-hover:text-gray-200 transition-colors duration-300">
              Provide scientific evidence following established guidelines for benchmarking, validation, and uncertainty quantification
              </p>
            </div>

            {/* Benefit 5 */}
            <div className="text-center animate-fadeInUp animation-delay-600 hover:scale-105 transition-all duration-500 group relative">
              <div className="w-12 h-12 sm:w-16 sm:h-16 bg-white rounded-full flex items-center justify-center mx-auto mb-4 sm:mb-6 relative group-hover:animate-pulse">
                <svg className="w-6 h-6 sm:w-8 sm:h-8 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                </svg>
              </div>
              <p className="text-white text-xs sm:text-sm leading-relaxed group-hover:text-gray-200 transition-colors duration-300">
              Communicate improved performances and outcomes through scientific publication
              </p>
            </div>
            
            {/* Benefit 6 */}
            <div className="text-center animate-fadeInUp animation-delay-700 hover:scale-105 transition-all duration-500 group relative">
              <div className="w-12 h-12 sm:w-16 sm:h-16 bg-white rounded-full flex items-center justify-center mx-auto mb-4 sm:mb-6 relative group-hover:animate-pulse">
                <svg className="w-6 h-6 sm:w-8 sm:h-8 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <p className="text-white text-xs sm:text-sm leading-relaxed group-hover:text-gray-200 transition-colors duration-300">
              Accelerate time to market at a fraction of the cost
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Section Divider */}
      <div className="border-t border-gray-400"></div>

      {/* Our Vision Section */}
      <section 
        ref={(el) => { sectionRefs.current['vision'] = el; }}
        id="vision"
        className="relative py-20 "
        style={{ backgroundColor: '#F8F2EB' }}
      >
        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl sm:text-5xl font-bold mb-6 animate-fadeInUp">
              Our <span className="text-gray-800">Vision</span>
            </h2>
            <p className="text-xl text-gray-700 max-w-4xl mx-auto leading-relaxed animate-fadeInUp animation-delay-200">
              Every patient deserves a digital counterpart that helps physicians and hospitals make safer, smarter decisions while helping patients live longer, healthier lives.
            </p>
          </div>
          
          {/* Sliding Cards Container */}
          <div className="relative overflow-hidden vision-cards-container">
            <div className="flex space-x-6 lg:space-x-8 vision-sliding-wrapper">
              {/* First Set of Cards */}
              <div className="bg-white/50 backdrop-blur-sm rounded-xl p-4 sm:p-6 text-center vision-card-hover group relative overflow-hidden min-w-[280px] sm:min-w-[320px]">
                {/* Animated Background */}
                <div className="absolute inset-0 vision-bg-blue opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                
                <div className="w-16 h-16 mx-auto mb-4 flex items-center justify-center relative z-10">
                  <svg className="w-12 h-12 text-gray-800 vision-blue transition-colors duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                </div>
                <h3 className="text-lg font-bold text-gray-800 mb-3 vision-blue transition-colors duration-300">For Physicians</h3>
                <p className="text-gray-700 text-xs sm:text-sm leading-relaxed group-hover:text-gray-700 transition-colors duration-300">
                Continuously learning patient digital twin that leverages custom simulations to provide safer and smarter clinical decisions with predictive insights.
                  </p>
              </div>

              <div className="bg-white/50 backdrop-blur-sm rounded-xl p-4 sm:p-6 text-center vision-card-hover group relative overflow-hidden min-w-[280px] sm:min-w-[320px]">
                {/* Animated Background */}
                <div className="absolute inset-0 vision-bg-yellow opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                
                <div className="w-16 h-16 mx-auto mb-4 flex items-center justify-center relative z-10">
                  <svg className="w-12 h-12 text-gray-800 vision-yellow transition-colors duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                  </svg>
                </div>
                <h3 className="text-lg font-bold text-gray-800 mb-3 vision-yellow transition-colors duration-300">For Hospitals</h3>
                <p className="text-gray-700 text-xs sm:text-sm leading-relaxed group-hover:text-gray-700 transition-colors duration-300">
                Vendor-agnostic architecture that orchestrates multimodal data and various AI model outputs into a personalized evolving patient digital twin, improving resource allocation and patient outcomes across all domains.
                </p>
              </div>

              <div className="bg-white/50 backdrop-blur-sm rounded-xl p-4 sm:p-6 text-center vision-card-hover group relative overflow-hidden min-w-[280px] sm:min-w-[320px]">
                {/* Animated Background */}
                <div className="absolute inset-0 vision-bg-red opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                
                <div className="w-16 h-16 mx-auto mb-4 flex items-center justify-center relative z-10">
                  <svg className="w-12 h-12 text-gray-800 vision-red transition-colors duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                  </svg>
                </div>
                <h3 className="text-lg font-bold text-gray-800 mb-3 vision-red transition-colors duration-300">For Patients</h3>
                <p className="text-gray-700 text-xs sm:text-sm leading-relaxed group-hover:text-gray-700 transition-colors duration-300">
                A comprehensive and continuously evolving digital twin that is grounded in personalized physiology, unlocking unique insights and early interventions to improve health.
                 </p>
              </div>

              <div className="bg-white/50 backdrop-blur-sm rounded-xl p-4 sm:p-6 text-center vision-card-hover group relative overflow-hidden min-w-[280px] sm:min-w-[320px]">
                {/* Animated Background */}
                <div className="absolute inset-0 vision-bg-blue opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                
                <div className="w-16 h-16 mx-auto mb-4 flex items-center justify-center relative z-10">
                  <svg className="w-12 h-12 text-gray-800 vision-blue transition-colors duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                </div>
                <h3 className="text-lg font-bold text-gray-800 mb-3 vision-blue transition-colors duration-300">For Healthcare</h3>
                <p className="text-gray-700 text-xs sm:text-sm leading-relaxed group-hover:text-gray-700 transition-colors duration-300">
                  Revolutionary AI infrastructure that transforms how medicine is practiced and delivered globally.
                </p>
              </div>

              {/* Duplicate Set for Seamless Loop */}
              <div className="bg-white/50 backdrop-blur-sm rounded-xl p-4 sm:p-6 text-center vision-card-hover group relative overflow-hidden min-w-[280px] sm:min-w-[320px]">
                {/* Animated Background */}
                <div className="absolute inset-0 vision-bg-blue opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                
                <div className="w-16 h-16 mx-auto mb-4 flex items-center justify-center relative z-10">
                  <svg className="w-12 h-12 text-gray-800 vision-blue transition-colors duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                </div>
                <h3 className="text-lg font-bold text-gray-800 mb-3 vision-blue transition-colors duration-300">For Physicians</h3>
                <p className="text-gray-700 text-xs sm:text-sm leading-relaxed group-hover:text-gray-700 transition-colors duration-300">
                Continuously learning patient digital twin that leverages custom simulations to provide safer and smarter clinical decisions with predictive insights.
                  </p>
              </div>

              <div className="bg-white/50 backdrop-blur-sm rounded-xl p-4 sm:p-6 text-center vision-card-hover group relative overflow-hidden min-w-[280px] sm:min-w-[320px]">
                {/* Animated Background */}
                <div className="absolute inset-0 vision-bg-yellow opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                
                <div className="w-16 h-16 mx-auto mb-4 flex items-center justify-center relative z-10">
                  <svg className="w-12 h-12 text-gray-800 vision-yellow transition-colors duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                  </svg>
                </div>
                <h3 className="text-lg font-bold text-gray-800 mb-3 vision-yellow transition-colors duration-300">For Hospitals</h3>
                <p className="text-gray-700 text-xs sm:text-sm leading-relaxed group-hover:text-gray-700 transition-colors duration-300">
                Vendor-agnostic architecture that orchestrates multimodal data and various AI model outputs into a personalized evolving patient digital twin, improving resource allocation and patient outcomes across all domains.
                </p>
              </div>

              <div className="bg-white/50 backdrop-blur-sm rounded-xl p-4 sm:p-6 text-center vision-card-hover group relative overflow-hidden min-w-[280px] sm:min-w-[320px]">
                {/* Animated Background */}
                <div className="absolute inset-0 vision-bg-red opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                
                <div className="w-16 h-16 mx-auto mb-4 flex items-center justify-center relative z-10">
                  <svg className="w-12 h-12 text-gray-800 vision-red transition-colors duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                  </svg>
                </div>
                <h3 className="text-lg font-bold text-gray-800 mb-3 vision-red transition-colors duration-300">For Patients</h3>
                <p className="text-gray-700 text-xs sm:text-sm leading-relaxed group-hover:text-gray-700 transition-colors duration-300">
                A comprehensive and continuously evolving digital twin that is grounded in personalized physiology, unlocking unique insights and early interventions to improve health.
                 </p>
              </div>

              <div className="bg-white/50 backdrop-blur-sm rounded-xl p-4 sm:p-6 text-center vision-card-hover group relative overflow-hidden min-w-[280px] sm:min-w-[320px]">
                {/* Animated Background */}
                <div className="absolute inset-0 vision-bg-blue opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                
                <div className="w-16 h-16 mx-auto mb-4 flex items-center justify-center relative z-10">
                  <svg className="w-12 h-12 text-gray-800 vision-blue transition-colors duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                </div>
                <h3 className="text-lg font-bold text-gray-800 mb-3 vision-blue transition-colors duration-300">For Healthcare</h3>
                <p className="text-gray-700 text-xs sm:text-sm leading-relaxed group-hover:text-gray-700 transition-colors duration-300">
                  Revolutionary AI infrastructure that transforms how medicine is practiced and delivered globally.
                </p>
              </div>
            </div>
          </div>
          
          <div className="text-center mt-10">
            <div className="bg-gradient-to-r from-gray-600 to-gray-700 rounded-xl p-6 sm:p-8 text-white max-w-4xl mx-auto">
              <p className="font-bold text-base sm:text-lg lg:text-xl leading-relaxed">
              Somnium Biolabs unites foundational models, real-time data, and compute power into the next generation operating system for human physiology.
              </p>
            </div>
          </div>
        </div>
      </section>
      
      {/* Section Divider */}
      <div className="border-t border-gray-400"></div>

      {/* Contact Section */}
       <div id="contact" className="p-6 sm:p-8 text-center  sm:mx-0 animate-fadeIn" style={{ backgroundColor: '#F8F2EB' }}>
         <h6 className="text-xl sm:text-2xl font-semibold text-gray-900 mb-3 sm:mb-4 animate-fadeInUp">
           How can we help?
         </h6>
         <p className="text-gray-700 mb-3 sm:mb-4 text-sm sm:text-base animate-fadeInUp animation-delay-200">
           Email us at <a href="mailto:contact@somniumbio.com" className="text-blue-600 hover:text-blue-700 font-medium break-all sm:break-normal">contact@somniumbio.com</a>
         </p>
      </div>

      {/* Footer */}
      <Footer variant="home" />
    </div>
  );
}