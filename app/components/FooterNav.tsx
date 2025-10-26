interface FooterNavProps {
  previousHref?: string;
  previousText?: string;
  nextHref?: string;
  nextText?: string;
  variant?: 'white-paper' | 'problem-statement' | 'technology' | 'founder-letter' | 'default' | 'home';
}

export default function FooterNav({
  previousHref,
  previousText,
  nextHref,
  nextText,
  variant = 'default'
}: FooterNavProps) {
  const getTextColorClass = () => {
    return 'text-black';
  };

  const getBorderColorClass = () => {
    return 'border-black/10';
  };

  return (
    <div className={`bg-transparent ${getTextColorClass()} relative overflow-hidden`}>
      <div className="max-w-7xl mx-auto px-2 sm:px-3 lg:px-4 relative z-10">
        <div className={`flex flex-col sm:flex-row justify-between items-center space-y-3 sm:space-y-0 py-4 sm:py-6 border-b ${getBorderColorClass()}`}>
          {/* Left - Previous */}
          <div className="flex items-center">
            {previousHref && (
              <>
                <a href={previousHref} className="opacity-80 hover:opacity-100 text-xs sm:text-sm underline">← PREVIOUS</a>
                <span className="mx-2 opacity-60 hidden sm:inline">•</span>
                <a href={previousHref} className="opacity-80 hover:opacity-100 text-xs sm:text-sm ml-2 sm:ml-0">{previousText}</a>
              </>
            )}
          </div>

          {/* Right - Next */}
          <div className="flex items-center">
            {nextHref && (
              <>
                <a href={nextHref} className="opacity-80 hover:opacity-100 text-xs sm:text-sm mr-2 sm:mr-0">{nextText}</a>
                <span className="mx-2 opacity-60 hidden sm:inline">•</span>
                <a href={nextHref} className="opacity-80 hover:opacity-100 text-xs sm:text-sm underline">NEXT →</a>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
