/*
 * Card Components - Ito ang reusable card components para sa buong application
 * 
 * Mga Components:
 * 1. Card - Main container na may background, border, at shadow
 * 2. CardHeader - Header section na may title at description
 * 3. CardTitle - Title text na may proper typography
 * 4. CardDescription - Description text na may muted color
 * 5. CardAction - Action buttons na nasa top-right ng card
 * 6. CardContent - Main content area ng card
 * 7. CardFooter - Footer section na may actions o additional info
 * 
 * Paano gamitin:
 * <Card>
 *   <CardHeader>
 *     <CardTitle>Title</CardTitle>
 *     <CardDescription>Description</CardDescription>
 *     <CardAction>
 *       <Button>Action</Button>
 *     </CardAction>
 *   </CardHeader>
 *   <CardContent>
 *     Main content here
 *   </CardContent>
 *   <CardFooter>
 *     Footer content here
 *   </CardFooter>
 * </Card>
 */

import * as React from "react"

import { cn } from "@/lib/utils" // Utility function para sa class merging

// Main Card component - container ng lahat ng card content
function Card({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card" // Data attribute para sa styling
      className={cn(
        // Base styles: background, text color, flex layout, gap, border radius, border, padding, shadow
        "bg-card text-card-foreground flex flex-col gap-6 rounded-xl border py-6 shadow-sm",
        className // Custom classes na pwede i-add
      )}
      {...props} // Spread ang lahat ng props
    />
  )
}

// CardHeader - header section ng card
function CardHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-header" // Data attribute para sa styling
      className={cn(
        // Grid layout para sa responsive design
        "@container/card-header grid auto-rows-min grid-rows-[auto_auto] items-start gap-1.5 px-6 has-data-[slot=card-action]:grid-cols-[1fr_auto] [.border-b]:pb-6",
        className
      )}
      {...props}
    />
  )
}

// CardTitle - title text ng card
function CardTitle({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-title" // Data attribute para sa styling
      className={cn("leading-none font-semibold", className)} // Typography styles
      {...props}
    />
  )
}

// CardDescription - description text ng card
function CardDescription({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-description" // Data attribute para sa styling
      className={cn("text-muted-foreground text-sm", className)} // Muted text color at small size
      {...props}
    />
  )
}

// CardAction - action buttons na nasa top-right ng card
function CardAction({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-action" // Data attribute para sa styling
      className={cn(
        // Positioning: nasa column 2, row span 2, row start 1, self-start, justify-self-end
        "col-start-2 row-span-2 row-start-1 self-start justify-self-end",
        className
      )}
      {...props}
    />
  )
}

// CardContent - main content area ng card
function CardContent({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-content" // Data attribute para sa styling
      className={cn("px-6", className)} // Horizontal padding
      {...props}
    />
  )
}

// CardFooter - footer section ng card
function CardFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-footer" // Data attribute para sa styling
      className={cn("flex items-center px-6 [.border-t]:pt-6", className)} // Flex layout, padding, conditional top padding
      {...props}
    />
  )
}

// Export lahat ng card components
export {
  Card,
  CardHeader,
  CardFooter,
  CardTitle,
  CardAction,
  CardDescription,
  CardContent,
}
