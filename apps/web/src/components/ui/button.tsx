import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 rounded-btn text-sm font-medium transition-[background-color,transform] active:scale-[0.97] disabled:opacity-50 disabled:pointer-events-none min-h-[44px] px-4',
  {
    variants: {
      variant: {
        primary: 'bg-brand text-white hover:bg-brand/90',
        secondary: 'bg-card border border-card-border text-text hover:bg-bg-elev',
        ghost: 'bg-transparent text-text-dim hover:text-text hover:bg-card',
        destructive: 'bg-bad text-white hover:bg-bad/90',
      },
      size: {
        default: 'h-11',
        sm: 'h-9 px-3 text-sm',
      },
    },
    defaultVariants: { variant: 'primary', size: 'default' },
  },
);

export interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => (
    <button ref={ref} className={cn(buttonVariants({ variant, size }), className)} {...props} />
  ),
);
Button.displayName = 'Button';
