import React from 'react';
import { cn } from '@/lib/utils';

interface PixelButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger';
}

export const PixelButton = React.forwardRef<HTMLButtonElement, PixelButtonProps>(
  ({ className, variant = 'primary', ...props }, ref) => {
    const baseClasses =
      'relative px-6 py-3 font-pixel text-xs sm:text-sm uppercase transition-all duration-150 active:translate-y-0.5 outline-none focus:outline-none cursor-pointer select-none';

    const variants = {
      primary: [
        'bg-primary/10 text-primary border border-primary/60',
        'hover:bg-primary/20 hover:border-primary',
        'shadow-[0_0_12px_rgba(0,245,255,0.2)] hover:shadow-[0_0_20px_rgba(0,245,255,0.4)]',
        'active:shadow-[0_0_8px_rgba(0,245,255,0.15)]',
      ].join(' '),
      secondary: [
        'bg-accent/10 text-accent border border-accent/60',
        'hover:bg-accent/20 hover:border-accent',
        'shadow-[0_0_12px_rgba(255,0,200,0.2)] hover:shadow-[0_0_20px_rgba(255,0,200,0.4)]',
      ].join(' '),
      danger: [
        'bg-red-900/20 text-red-400 border border-red-600/60',
        'hover:bg-red-900/40 hover:border-red-500',
        'shadow-[0_0_12px_rgba(239,68,68,0.2)] hover:shadow-[0_0_20px_rgba(239,68,68,0.4)]',
      ].join(' '),
    };

    return (
      <button
        ref={ref}
        className={cn(baseClasses, variants[variant], className)}
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
