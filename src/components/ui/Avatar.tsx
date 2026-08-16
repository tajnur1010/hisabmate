import { useMemo } from 'react';
import { cn } from '@/utils/cn';

interface AvatarProps {
  name: string;
  photoUrl?: string | null;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

const dims: Record<NonNullable<AvatarProps['size']>, string> = {
  sm: 'h-9 w-9 text-sm',
  md: 'h-11 w-11 text-base',
  lg: 'h-14 w-14 text-lg',
  xl: 'h-20 w-20 text-2xl',
};

// Deterministic, calm palette derived from the name.
const PALETTE = [
  'bg-brand-soft text-brand-strong',
  'bg-gold-soft text-gold',
  'bg-positive-soft text-positive',
  'bg-warning-soft text-warning',
  'bg-danger-soft text-danger',
];

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function hash(str: string): number {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) | 0;
  return Math.abs(h);
}

/** Circular avatar showing a photo when available, otherwise initials. */
export function Avatar({ name, photoUrl, size = 'md', className }: AvatarProps) {
  const color = useMemo(() => PALETTE[hash(name) % PALETTE.length], [name]);
  if (photoUrl) {
    return (
      <img
        src={photoUrl}
        alt={name}
        className={cn('shrink-0 rounded-full object-cover', dims[size], className)}
      />
    );
  }
  return (
    <span
      aria-hidden
      className={cn(
        'grid shrink-0 place-items-center rounded-full font-display font-semibold',
        dims[size],
        color,
        className,
      )}
    >
      {initials(name)}
    </span>
  );
}
