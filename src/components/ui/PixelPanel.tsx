import { cn } from '@/lib/utils';

interface PixelPanelProps {
  children: React.ReactNode;
  className?: string;
}

export function PixelPanel({ children, className }: PixelPanelProps) {
  return <div className={cn('pixel-panel p-4', className)}>{children}</div>;
}
