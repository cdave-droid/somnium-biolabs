'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { useEffect, useState, useRef } from 'react';

const Navigation = () => {
  const pathname = usePathname();
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const mobileMenuRef = useRef<HTMLDivElement>(null);

  const navItems = [
    // { name: 'White Paper I', href: '/white-paper' },
    { name: 'Clinical Reasoning', href: '/clinical-reasoning' },
    { name: 'Technology', href: '/technology' },
    { name: 'Founder Letter', href: '/founder-letter' },
  ];

  useEffect(() => {
    const handleScroll = () => {
      const scrollPosition = window.scrollY;
      const blueSectionHeight = 400; // Changed to 300px for earlier color change
      setIsScrolled(scrollPosition > blueSectionHeight);
    };

    const handleClickOutside = (event: MouseEvent) => {
      if (mobileMenuRef.current && !mobileMenuRef.current.contains(event.target as Node)) {
        setIsMobileMenuOpen(false);
      }
    };

    window.addEventListener('scroll', handleScroll);
    document.addEventListener('mousedown', handleClickOutside);
    
    return () => {
      window.removeEventListener('scroll', handleScroll);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 px-2 sm:px-4 mt-2 sm:mt-4">
      <div className="max-w-7xl mx-auto">
        <div ref={mobileMenuRef} className={`backdrop-blur-xl px-2 sm:px-6 py-2 sm:py-3 shadow-lg border border-white/20 bg-gradient-to-r from-white/20 to-gray-300/20 overflow-hidden transition-all duration-200 ${
          isMobileMenuOpen ? 'rounded-2xl' : 'rounded-full'
        }`}>
          <div className="flex justify-between items-center">
            {/* Left side - Logo/Brand */}
            
              <div 
                className="w-6 h-6 sm:w-8 sm:h-8 mr-1 sm:mr-3 rounded-full overflow-hidden bg-white/10 p-1 cursor-pointer hover:bg-white/20 transition-colors duration-200"
                onClick={() => window.location.href = '/'}
              >
                <Image
                  src="/logo.jpg"
                  alt="Somnium Biolabs Logo"
                  width={32}
                  height={32}
                  className="w-full h-full object-cover rounded-full"
                />
              </div>
            
            {/* Center - Navigation Links (Desktop) */}
            <div className="hidden lg:flex items-center space-x-6 xl:space-x-8">
              {navItems.map((item) => (
                <Link
                  key={item.name}
                  href={item.href}
                  className={`text-sm font-medium transition-colors duration-200 ${
                    pathname === item.href
                      ? isScrolled
                        ? 'text-gray-900 bg-gray-200 px-3 py-1 rounded-full'
                        : 'text-white bg-white/20 px-3 py-1 rounded-full'
                      : isScrolled
                        ? 'text-gray-700 hover:text-gray-900'
                        : 'text-white/70 hover:text-white'
                  }`}
                >
                  {item.name}
                </Link>
              ))}
            </div>

            {/* Right side - CTA Button (Desktop) */}
            <div className="hidden md:flex items-center">
              <a href="/#contact" className={`px-4 xl:px-6 py-2 rounded-full text-sm font-medium transition-colors inline-block ${
                isScrolled
                  ? 'bg-gray-900 text-white hover:bg-black'
                  : 'bg-white text-black hover:bg-gray-100'
              }`}>
                Join Us
              </a>
            </div>

            {/* Mobile menu button */}
            <div className="md:hidden ml-1">
              <button
                type="button"
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                className={`focus:outline-none transition-colors ${
                  isScrolled
                    ? 'text-gray-700 hover:text-gray-900'
                    : 'text-white/70 hover:text-white'
                }`}
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>
            </div>
          </div>

          {/* Mobile Menu */}
          <div className={`md:hidden transition-all duration-300 ease-in-out ${
            isMobileMenuOpen ? 'max-h-96 opacity-100 mt-4 pt-4 border-t border-white/20' : 'max-h-0 opacity-0'
          }`}>
            <div className="flex flex-col space-y-2 pr-2">
                {navItems.map((item) => (
                  <Link
                    key={item.name}
                    href={item.href}
                    onClick={() => setIsMobileMenuOpen(false)}
                    className={`text-sm font-medium transition-colors duration-200 px-4 py-3 rounded-md border-l-4 whitespace-nowrap overflow-hidden text-ellipsis ${
                      pathname === item.href
                        ? isScrolled
                          ? 'text-gray-900 bg-gray-200/80 backdrop-blur-sm border-gray-400'
                          : 'text-white bg-white/20 backdrop-blur-sm border-white/40'
                        : isScrolled
                          ? 'text-gray-700 hover:text-gray-900 border-transparent'
                          : 'text-white/70 hover:text-white border-transparent'
                    }`}
                  >
                    {item.name}
                  </Link>
                ))}
                <a 
                  href="/#contact" 
                  onClick={() => setIsMobileMenuOpen(false)}
                  className={`px-4 py-3 rounded-md text-sm font-medium transition-colors text-left block border-l-4 ${
                    isScrolled
                      ? 'bg-gray-900 text-white hover:bg-black border-gray-600'
                      : 'bg-white text-black hover:bg-gray-100 border-gray-300'
                  }`}
                >
                  Join Us
                </a>
              </div>
            </div>
        </div>
      </div>
    </nav>
  );
};

export default Navigation;
