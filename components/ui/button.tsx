/*
 * Button Component - Ito ang reusable button component ng buong application
 * 
 * Mga Features:
 * 1. Multiple variants - default, destructive, outline, secondary, ghost, link
 * 2. Different sizes - default, sm, lg, icon
 * 3. Accessibility support - focus states, disabled states
 * 4. Customizable styling - pwede mag-add ng custom classes
 * 5. Slot support - pwede gamitin as wrapper para sa ibang elements
 * 
 * Mga Variants:
 * - default: Primary button na may solid background
 * - destructive: Red button para sa delete/dangerous actions
 * - outline: Button na may border lang, walang background
 * - secondary: Secondary button na may different background color
 * - ghost: Transparent button na may hover effects
 * - link: Button na parang link na may underline
 * 
 * Mga Sizes:
 * - default: Standard size (h-9)
 * - sm: Small size (h-8)
 * - lg: Large size (h-10)
 * - icon: Square button para sa icons (size-9)
 */

import * as React from "react"
import { Slot } from "@radix-ui/react-slot" // Para sa asChild functionality
import { cva, type VariantProps } from "class-variance-authority" // Para sa variant management

import { cn } from "@/lib/utils" // Utility function para sa class merging

// Button variants configuration - dito naka-define ang lahat ng possible styles
const buttonVariants = cva(
  // Base styles na applicable sa lahat ng buttons
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-all disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive",
  {
    variants: {
      variant: {
        // Default variant - primary button
        default:
          "bg-primary text-primary-foreground shadow-xs hover:bg-primary/90",
        // Destructive variant - para sa dangerous actions
        destructive:
          "bg-destructive text-white shadow-xs hover:bg-destructive/90 focus-visible:ring-destructive/20 dark:focus-visible:ring-destructive/40 dark:bg-destructive/60",
        // Outline variant - border lang, walang background
        outline:
          "border bg-background shadow-xs hover:bg-accent hover:text-accent-foreground dark:bg-input/30 dark:border-input dark:hover:bg-input/50",
        // Secondary variant - different background color
        secondary:
          "bg-secondary text-secondary-foreground shadow-xs hover:bg-secondary/80",
        // Ghost variant - transparent na may hover effects
        ghost:
          "hover:bg-accent hover:text-accent-foreground dark:hover:bg-accent/50",
        // Link variant - parang link na may underline
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        // Default size - standard height at padding
        default: "h-9 px-4 py-2 has-[>svg]:px-3",
        // Small size - mas maliit na height at padding
        sm: "h-8 rounded-md gap-1.5 px-3 has-[>svg]:px-2.5",
        // Large size - mas malaki na height at padding
        lg: "h-10 rounded-md px-6 has-[>svg]:px-4",
        // Icon size - square button para sa icons
        icon: "size-9",
      },
    },
    // Default values kung hindi specified ang variant o size
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

// Main Button component function with forwardRef support
const Button = React.forwardRef<
  HTMLButtonElement,
  React.ComponentProps<"button"> &
    VariantProps<typeof buttonVariants> & {
      asChild?: boolean
    }
>(({
  className, // Custom CSS classes
  variant, // Button variant (default, destructive, etc.)
  size, // Button size (default, sm, lg, icon)
  asChild = false, // Kung true, gagamitin ang Slot component
  ...props // Lahat ng iba pang props (onClick, disabled, etc.)
}, ref) => {
  // Piliin kung Slot o regular button element ang gagamitin
  const Comp = asChild ? Slot : "button"

  return (
    <Comp
      ref={ref} // Forward the ref (Slot handles refs automatically when asChild is true)
      data-slot="button" // Data attribute para sa styling
      className={cn(buttonVariants({ variant, size, className }))} // Merge ang variant styles sa custom classes
      {...props} // Spread ang lahat ng props
    />
  )
})

Button.displayName = "Button"

export { Button, buttonVariants }
