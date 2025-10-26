import React from "react";

interface LiquidButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode;
  className?: string;
  variant?: 'default' | 'landing' | 'problem-statement' | 'founder-letter' | 'technology';
  size?: 'sm' | 'md' | 'lg';
}

export function LiquidButton({ 
  children, 
  className = "", 
  variant = 'default',
  size = 'md',
  ...props 
}: LiquidButtonProps) {
  
  const getVariantStyles = () => {
    switch (variant) {
      case 'landing':
        return `
          bg-gradient-to-r from-white/20 via-white/10 to-white/20
          backdrop-blur-md border border-white/30
          hover:from-white/30 hover:via-white/20 hover:to-white/30
          text-white
        `;
      case 'problem-statement':
        return `
          bg-gradient-to-r from-red-500/30 via-red-400/20 to-red-600/30
          backdrop-blur-md border border-red-200/30
          hover:from-red-500/40 hover:via-red-400/30 hover:to-red-600/40
          text-red-100
        `;
      case 'founder-letter':
        return `
          bg-gradient-to-r from-yellow-500/30 via-yellow-400/20 to-yellow-600/30
          backdrop-blur-md border border-yellow-200/30
          hover:from-yellow-500/40 hover:via-yellow-400/30 hover:to-yellow-600/40
          text-yellow-100
        `;
      case 'technology':
        return `
          bg-gradient-to-r from-blue-500/30 via-blue-400/20 to-blue-600/30
          backdrop-blur-md border border-blue-200/30
          hover:from-blue-500/40 hover:via-blue-400/30 hover:to-blue-600/40
          text-blue-100
        `;
      default:
        return `
          bg-gradient-to-r from-blue-500/20 via-purple-500/20 to-pink-500/20
          backdrop-blur-md border border-white/20
          hover:from-blue-500/30 hover:via-purple-500/30 hover:to-pink-500/30
          text-white
        `;
    }
  };

  const getSizeStyles = () => {
    switch (size) {
      case 'sm':
        return 'px-3 py-1.5 text-sm';
      case 'lg':
        return 'px-8 py-4 text-lg';
      default:
        return 'px-4 py-2 text-base';
    }
  };

  const getLiquidEffect = () => {
    switch (variant) {
      case 'landing':
        return `
          <div className="absolute -top-1 -left-1 w-6 h-6 bg-white/30 rounded-full animate-pulse"></div>
          <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-white/20 rounded-full animate-pulse animation-delay-200"></div>
          <div className="absolute top-1/2 left-1/4 w-3 h-3 bg-white/15 rounded-full animate-pulse animation-delay-400"></div>
        `;
      case 'problem-statement':
        return `
          <div className="absolute -top-1 -left-1 w-6 h-6 bg-red-300/40 rounded-full animate-pulse"></div>
          <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-red-200/30 rounded-full animate-pulse animation-delay-200"></div>
          <div className="absolute top-1/2 left-1/4 w-3 h-3 bg-red-100/25 rounded-full animate-pulse animation-delay-400"></div>
        `;
      case 'founder-letter':
        return `
          <div className="absolute -top-1 -left-1 w-6 h-6 bg-yellow-300/40 rounded-full animate-pulse"></div>
          <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-yellow-200/30 rounded-full animate-pulse animation-delay-200"></div>
          <div className="absolute top-1/2 left-1/4 w-3 h-3 bg-yellow-100/25 rounded-full animate-pulse animation-delay-400"></div>
        `;
      case 'technology':
        return `
          <div className="absolute -top-1 -left-1 w-6 h-6 bg-blue-300/40 rounded-full animate-pulse"></div>
          <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-blue-200/30 rounded-full animate-pulse animation-delay-200"></div>
          <div className="absolute top-1/2 left-1/4 w-3 h-3 bg-blue-100/25 rounded-full animate-pulse animation-delay-400"></div>
        `;
      default:
        return `
          <div className="absolute -top-1 -left-1 w-8 h-8 bg-white/20 rounded-full animate-pulse"></div>
          <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-white/15 rounded-full animate-pulse animation-delay-200"></div>
          <div className="absolute top-1/2 left-1/4 w-4 h-4 bg-white/10 rounded-full animate-pulse animation-delay-400"></div>
        `;
    }
  };

  return (
    <button
      className={`
        relative overflow-hidden rounded-full font-medium
        transition-all duration-300 ease-out
        shadow-lg hover:shadow-xl
        before:absolute before:inset-0 before:rounded-full
        before:bg-gradient-to-r before:from-white/10 before:to-transparent
        before:opacity-0 hover:before:opacity-100 before:transition-opacity before:duration-300
        ${getVariantStyles()}
        ${getSizeStyles()}
        ${className}
      `}
      {...props}
    >
      <span className="relative z-10">{children}</span>
      
      {/* Animated liquid effect */}
      <div 
        className="absolute inset-0 rounded-full overflow-hidden"
        dangerouslySetInnerHTML={{ __html: getLiquidEffect() }}
      />
    </button>
  );
}
