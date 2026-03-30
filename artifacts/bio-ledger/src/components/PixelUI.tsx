import React from 'react';
import { cn } from '@/lib/utils';

interface PixelButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger';
}

export const PixelButton = React.forwardRef<HTMLButtonElement, PixelButtonProps>(
  ({ className, variant = 'primary', ...props }, ref) => {
    const baseClasses =
      'relative px-6 py-3 font-terminal font-semibold text-sm rounded-xl transition-all duration-200 active:scale-[0.98] outline-none focus:outline-none cursor-pointer select-none';

    const variants = {
      primary: [
        'text-white border border-violet-400/50',
        'hover:border-violet-400/80 hover:scale-[1.02]',
        'shadow-[0_4px_20px_rgba(139,92,246,0.25)] hover:shadow-[0_4px_28px_rgba(139,92,246,0.4)]',
      ].join(' '),
      secondary: [
        'text-white border border-rose-400/50',
        'hover:border-rose-400/80 hover:scale-[1.02]',
        'shadow-[0_4px_20px_rgba(251,113,133,0.22)] hover:shadow-[0_4px_28px_rgba(251,113,133,0.38)]',
      ].join(' '),
      danger: [
        'text-red-300 border border-red-500/50',
        'hover:border-red-400/80 hover:scale-[1.02]',
        'shadow-[0_4px_20px_rgba(239,68,68,0.18)] hover:shadow-[0_4px_28px_rgba(239,68,68,0.32)]',
      ].join(' '),
    };

    const gradients: Record<string, React.CSSProperties> = {
      primary: {
        background: 'linear-gradient(135deg, rgba(139,92,246,0.28) 0%, rgba(99,102,241,0.20) 100%)',
      },
      secondary: {
        background: 'linear-gradient(135deg, rgba(251,113,133,0.25) 0%, rgba(244,114,182,0.18) 100%)',
      },
      danger: {
        background: 'linear-gradient(135deg, rgba(239,68,68,0.20) 0%, rgba(220,38,38,0.12) 100%)',
      },
    };

    return (
      <button
        ref={ref}
        className={cn(baseClasses, variants[variant], className)}
        style={gradients[variant]}
        {...props}
      />
    );
  }
);
PixelButton.displayName = 'PixelButton';

export const PixelPanel = ({
  children,
  className,
  variant = 'primary',
  title,
}: {
  children: React.ReactNode;
  className?: string;
  variant?: 'primary' | 'secondary';
  title?: string;
}) => {
  return (
    <div
      className={cn(
        'glass-panel rounded-2xl relative p-6',
        variant === 'primary'
          ? 'shadow-[0_8px_32px_rgba(139,92,246,0.12)]'
          : 'shadow-[0_8px_32px_rgba(251,113,133,0.10)]',
        className
      )}
    >
      {title && (
        <div
          className={cn(
            'absolute -top-3 left-5 px-3 py-0.5 rounded-full font-terminal text-xs font-semibold',
            'bg-card border',
            variant === 'primary'
              ? 'text-violet-300 border-violet-400/30'
              : 'text-rose-300 border-rose-400/30'
          )}
        >
          {title}
        </div>
      )}
      {children}
    </div>
  );
};

export const NeonText = ({
  children,
  className,
  color = 'primary',
}: {
  children: React.ReactNode;
  className?: string;
  color?: 'primary' | 'magenta';
}) => {
  return (
    <span
      className={cn(
        color === 'primary' ? 'text-primary text-shadow-violet' : 'text-accent text-shadow-coral',
        className
      )}
    >
      {children}
    </span>
  );
};

/** Glowing Aura Orb — replaces cyberpunk robot, warm and welcoming */
interface AuraOrbProps {
  state?: 'idle' | 'active' | 'signing' | 'warning' | 'demo';
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export const AuraOrb = ({ state = 'idle', size = 'lg', className }: AuraOrbProps) => {
  const sizes = { sm: 80, md: 128, lg: 192 };
  const px = sizes[size];

  const coreColors = {
    idle:    ['#8B5CF6', '#A78BFA', '#C4B5FD'],
    active:  ['#34D399', '#6EE7B7', '#8B5CF6'],
    signing: ['#F472B6', '#FB7185', '#8B5CF6'],
    warning: ['#FBBF24', '#FCD34D', '#FB7185'],
    demo:    ['#8B5CF6', '#FB7185', '#34D399'],
  };

  const [c1, c2, c3] = coreColors[state];

  return (
    <div
      className={cn('relative flex items-center justify-center', className)}
      style={{ width: px, height: px }}
    >
      {/* Outer glow halo */}
      <div
        className="absolute inset-0 rounded-full"
        style={{
          background: `radial-gradient(circle, ${c1}22 0%, transparent 70%)`,
          transform: 'scale(1.8)',
          filter: 'blur(20px)',
        }}
      />
      {/* Mid shimmer ring */}
      <div
        className="absolute inset-0 rounded-full"
        style={{
          background: `conic-gradient(from 0deg, ${c1}40, ${c2}20, ${c3}40, ${c1}40)`,
          filter: 'blur(8px)',
          animation: 'scan-ring 8s linear infinite',
        }}
      />
      {/* Core orb */}
      <div
        className="aura-orb relative rounded-full flex items-center justify-center"
        style={{
          width: px * 0.6,
          height: px * 0.6,
          background: `radial-gradient(circle at 35% 35%, ${c3}, ${c2} 50%, ${c1})`,
          boxShadow: `0 0 ${px * 0.2}px ${c1}60, 0 0 ${px * 0.4}px ${c1}20`,
        }}
      >
        {/* Inner sparkle */}
        <div
          className="rounded-full"
          style={{
            width: px * 0.18,
            height: px * 0.18,
            background: 'rgba(255,255,255,0.7)',
            filter: 'blur(6px)',
          }}
        />
      </div>
    </div>
  );
};
