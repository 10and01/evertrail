import { cn } from '@/lib/utils';

interface PixelButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary';
}

export function PixelButton({ children, className, variant = 'primary', ...props }: PixelButtonProps) {
  return (
    <button
      className={cn(
        'pixel-btn',
        variant === 'secondary' && 'pixel-btn-secondary',
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
}
