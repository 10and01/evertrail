import { cn } from '@/lib/utils';

interface BrandMarkProps {
  className?: string;
  variant?: 'compact' | 'hero';
}

export function BrandMark({ className, variant = 'compact' }: BrandMarkProps) {
  return (
    <span className={cn('brand-mark', variant === 'hero' && 'brand-mark-hero', className)} aria-label="Evertrail">
      <svg className="brand-mark-symbol" viewBox="0 0 96 96" aria-hidden="true">
        <path
          d="M26 78C18 65 18 43 27 29C37 13 59 10 74 20C80 24 84 30 85 36C75 28 65 24 54 25C42 26 34 33 31 43C28 53 30 66 36 73C46 84 63 85 77 76C70 88 54 93 40 88C34 86 29 83 26 78Z"
          fill="#355F50"
        />
        <path
          d="M72 20C58 16 40 19 32 30C23 42 25 62 35 74C45 84 62 84 75 75M30 48C40 43 51 43 62 47"
          fill="none"
          stroke="currentColor"
          strokeWidth="6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle cx="31" cy="48" r="2.5" fill="#F9E8C9" />
        <path d="M76 9L79.5 16.5L87 20L79.5 23.5L76 31L72.5 23.5L65 20L72.5 16.5L76 9Z" fill="#F7D69B" />
      </svg>
      <span className="brand-mark-word">
        Evertrail
        <small>memory shapes the world</small>
      </span>
    </span>
  );
}
