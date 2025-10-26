import Image from 'next/image';

interface FooterProps {
  previousHref?: string;
  previousText?: string;
  nextHref?: string;
  nextText?: string;
  variant?: 'white-paper' | 'problem-statement' | 'technology' | 'founder-letter' | 'default' | 'home';
}

export default function Footer({ 
  previousHref, 
  previousText, 
  nextHref, 
  nextText,
  variant = 'default'
}: FooterProps) {
  const getBackgroundClass = () => {
    switch (variant) {
      case 'white-paper':
        return 'bg-gradient-to-b from-blue-600 via-blue-500 to-blue-400';
      case 'problem-statement':
        return '';
      case 'technology':
        return '';
      case 'founder-letter':
        return '';
      case 'home':
        return '';
      default:
        return 'bg-gradient-to-b from-blue-600 via-blue-500 to-blue-400';
    }
  };

  return (
    <footer 
      className={`${getBackgroundClass()} text-white  relative overflow-hidden`}
      style={variant === 'technology' || variant === 'founder-letter' ? {} : {}}
    >
      {/* Background image for technology variant */}
      {variant === 'technology' && (
        <div 
          className="absolute inset-0 bg-cover bg-center bg-no-repeat"
          style={{ backgroundImage: 'url(/b1.jpg)' }}
        ></div>
      )}
      {/* Background image for founder-letter variant */}
      {variant === 'founder-letter' && (
        <div 
          className="absolute inset-0 bg-cover bg-center bg-no-repeat"
          style={{ backgroundImage: 'url(/y1.jpg)' }}
        ></div>
      )}
      {/* Background image for problem-statement variant */}
      {variant === 'problem-statement' && (
        <div 
          className="absolute inset-0 bg-cover bg-center bg-no-repeat"
          style={{ backgroundImage: 'url(/r1.jpg)' }}
        ></div>
      )}
      {/* Background image for home variant */}
      {variant === 'home' && (
        <div 
          className="absolute inset-0 bg-cover bg-center bg-no-repeat"
          style={{ backgroundImage: 'url(/l2.jpeg)' }}
        ></div>
      )}
      {/* Dark overlay for readability */}
      {(variant === 'technology' || variant === 'founder-letter' || variant === 'problem-statement' || variant === 'home') && (
        <div className="absolute inset-0 bg-black/30"></div>
      )}
      {/* Blur Overlay for technology, founder-letter, problem-statement, and home variants */}
      {(variant === 'technology' || variant === 'founder-letter' || variant === 'problem-statement' || variant === 'home') && (
        <div className="absolute inset-0 backdrop-blur-sm bg-white/10"></div>
      )}
      
      {/* Noise/Texture overlay - only for gradient backgrounds */}
      {variant !== 'home' && variant !== 'technology' && variant !== 'founder-letter' && variant !== 'problem-statement' && (
        <div className="absolute inset-0 opacity-20" style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 400 400' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)' opacity='0.1'/%3E%3C/svg%3E")`
        }}></div>
      )}
      
      {/* Noise/Texture overlay for home variant */}
      {variant === 'home' && (
        <div className="absolute inset-0 opacity-10" style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 400 400' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)' opacity='0.1'/%3E%3C/svg%3E")`
        }}></div>
      )}
      
      <div className=" max-w-7xl mx-auto px-2 sm:px-3 lg:px-4 relative z-10">
        {/* Main Footer Content */}
        <div className="flex flex-col sm:flex-row justify-between items-center space-y-3 sm:space-y-0 py-4 sm:py-6">
          {/* Left - Logo */}
          <div className="flex items-center">
            <div className="w-6 h-6 sm:w-8 sm:h-8 mr-2 sm:mr-3 rounded-full overflow-hidden bg-white/10 p-1">
              <Image
                src="/logo.jpg"
                alt="Somnium Biolabs Logo"
                width={32}
                height={32}
                className="w-full h-full object-cover rounded-full"
              />
            </div>
            <span className="text-sm sm:text-lg font-semibold font-exo2">
              Somnium Biolabs
            </span>
          </div>
          
          {/* Right - Copyright */}
          <div className="text-xs sm:text-sm text-white/80 text-center sm:text-right">
            © 2025 Somnium Biolabs. All rights reserved.
          </div>
        </div>
      </div>
    </footer>
  );
}
