import React from 'react';
import { cn } from '@/lib/utils';

interface PixelButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger';
}

export const PixelButton = React.forwardRef<HTMLButtonElement, PixelButtonProps>(
  ({ className, variant = 'primary', ...props }, ref) => {
    const baseClasses =
      'relative px-6 py-3 font-terminal font-bold text-sm uppercase tracking-widest transition-all duration-150 active:translate-y-0.5 outline-none focus:outline-none cursor-pointer select-none';

    const variants = {
      primary: [
        'text-primary border border-primary/60',
        'hover:border-primary',
        'shadow-[0_0_12px_rgba(0,245,255,0.2)] hover:shadow-[0_0_20px_rgba(0,245,255,0.4)]',
        'active:shadow-[0_0_8px_rgba(0,245,255,0.15)]',
      ].join(' '),
      secondary: [
        'text-accent border border-accent/60',
        'hover:border-accent',
        'shadow-[0_0_12px_rgba(255,0,200,0.2)] hover:shadow-[0_0_20px_rgba(255,0,200,0.4)]',
      ].join(' '),
      danger: [
        'text-red-400 border border-red-600/60',
        'hover:border-red-500',
        'shadow-[0_0_12px_rgba(239,68,68,0.2)] hover:shadow-[0_0_20px_rgba(239,68,68,0.4)]',
      ].join(' '),
    };

    const gradients: Record<string, React.CSSProperties> = {
      primary: { background: 'linear-gradient(180deg, rgba(0,245,255,0.13) 0%, rgba(0,245,255,0.05) 100%)' },
      secondary: { background: 'linear-gradient(180deg, rgba(255,0,200,0.13) 0%, rgba(255,0,200,0.05) 100%)' },
      danger: { background: 'linear-gradient(180deg, rgba(239,68,68,0.16) 0%, rgba(239,68,68,0.06) 100%)' },
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
        'glass-panel rounded-sm relative p-6',
        variant === 'primary'
          ? 'shadow-[0_0_16px_rgba(0,245,255,0.08)]'
          : 'shadow-[0_0_16px_rgba(255,0,200,0.08)]',
        className
      )}
    >
      {title && (
        <div
          className={cn(
            'absolute -top-3 left-4 px-2 font-terminal text-xs font-bold uppercase tracking-widest',
            'bg-[#0a0414]',
            variant === 'primary' ? 'text-primary' : 'text-accent'
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
        color === 'primary' ? 'text-primary text-shadow-neon' : 'text-accent text-shadow-magenta',
        className
      )}
    >
      {children}
    </span>
  );
};
