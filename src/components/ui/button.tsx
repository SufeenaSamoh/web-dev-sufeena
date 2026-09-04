import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-medium cursor-pointer transition-all duration-150 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#555555] disabled:pointer-events-none disabled:opacity-50 disabled:cursor-not-allowed [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default:
          "bg-[#4A4A4A] text-white shadow-2xs hover:bg-[#2F2F2F] border-0 active:bg-[#222222]",
        destructive: "bg-red-600 text-white shadow-2xs hover:bg-red-700 active:bg-red-800 border-0",
        outline:
          "border border-[#E5E7EB] bg-white text-[#444444] shadow-2xs hover:bg-[#F7F7F7] hover:text-[#222222] active:bg-[#EFEFEF]",
        secondary:
          "border border-[#E5E7EB] bg-white text-[#444444] shadow-2xs hover:bg-[#F7F7F7] hover:text-[#222222] active:bg-[#EFEFEF]",
        ghost: "text-[#444444] hover:bg-[#F7F7F7] hover:text-[#222222]",
        link: "text-[#4A4A4A] underline-offset-4 hover:underline p-0 h-auto",
        success:
          "bg-emerald-600 text-white shadow-2xs hover:bg-emerald-700 active:bg-emerald-800 border-0",
      },
      size: {
        default: "h-9 px-4 py-2 text-sm",
        sm: "h-8 px-3 text-xs rounded-xl",
        lg: "h-10 px-6 text-sm rounded-xl",
        icon: "h-9 w-9 p-0",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />
    );
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
