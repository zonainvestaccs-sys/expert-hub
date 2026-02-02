import * as React from 'react';
import { cn } from '@/lib/utils';

export function Input({ className, ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        'h-10 w-full rounded-xl border border-white/10 bg-black/20 px-3 text-sm text-foreground outline-none ring-0 placeholder:text-white/40 focus:border-primary/40 focus:bg-white/3',
        className,
      )}
      {...props}
    />
  );
}
