import * as React from 'react';
import { cn } from '@/lib/utils';

type Props = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'default' | 'secondary' | 'ghost' | 'destructive';
  size?: 'default' | 'sm' | 'lg';
};

export function Button({ className, variant = 'default', size = 'default', ...props }: Props) {
  const base =
    'inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition will-change-transform active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none';

  const variants: Record<string, string> = {
    default:
      'bg-primary text-primary-foreground shadow-glow hover:brightness-110 border border-white/10',
    secondary:
      'bg-white/5 text-foreground hover:bg-white/8 border border-white/10',
    ghost:
      'bg-transparent text-foreground hover:bg-white/6 border border-transparent',
    destructive:
      'bg-red-500/12 text-red-200 hover:bg-red-500/16 border border-red-500/25',
  };

  const sizes: Record<string, string> = {
    default: 'h-10 px-4 text-sm',
    sm: 'h-9 px-3 text-sm',
    lg: 'h-11 px-5 text-sm',
  };

  return <button className={cn(base, variants[variant], sizes[size], className)} {...props} />;
}
