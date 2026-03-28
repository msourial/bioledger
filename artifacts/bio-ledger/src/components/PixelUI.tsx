import React from 'react';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';

interface PixelButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger';
}

export const PixelButton = React.forwardRef<HTMLButtonElement, PixelButtonProps>(
  ({ className, variant = 'primary', ...props }, ref) => {
    const baseClasses = "relative px-6 py-3 font-pixel text-xs sm:text-sm uppercase transition-all duration-100 active:translate-y-1 active:shadow-none outline-none focus:outline-none";
    
    const variants = {
      primary: "bg-background text-primary border-4 border-primary hover:bg-primary/10 shadow-[4px_4px_0_0_hsl(var(--primary))]",
      secondary: "bg-background text-accent border-4 border-accent hover:bg-accent/10 shadow-[4px_4px_0_0_hsl(var(--accent))]",
      danger: "bg-background text-red-500 border-4 border-red-500 hover:bg-red-500/10 shadow-[4px_4px_0_0_#ef4444]",
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

export const PixelPanel = ({ children, className, variant = 'primary', title }: { children: React.ReactNode, className?: string, variant?: 'primary' | 'secondary', title?: string }) => {
  return (
    <div className={cn(
      "bg-card p-6 relative",
      variant === 'primary' ? 'pixel-borders' : 'pixel-borders-secondary',
      className
    )}>
      {title && (
        <div className={cn(
          "absolute -top-3 left-4 px-2 bg-background font-pixel text-xs",
          variant === 'primary' ? 'text-primary' : 'text-secondary'
        )}>
          {title}
        </div>
      )}
      {children}
    </div>
  );
};

export const NeonText = ({ children, className, color = 'primary' }: { children: React.ReactNode, className?: string, color?: 'primary' | 'magenta' }) => {
  return (
    <span className={cn(
      color === 'primary' ? 'text-primary text-shadow-neon' : 'text-accent text-shadow-magenta',
      className
    )}>
      {children}
    </span>
  );
};
