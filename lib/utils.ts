/*
 * UTILITY FUNCTIONS - Ito ang mga utility functions na ginagamit sa buong app
 * 
 * SIMPLE EXPLANATION:
 * 1. Dito naka-define ang mga helper functions na ginagamit sa buong application
 * 2. Mainly para sa CSS class management at Tailwind CSS
 * 3. Para sa pag-combine at pag-merge ng CSS classes
 * 4. Ginagamit sa lahat ng components para sa styling
 * 
 * MGA FEATURES:
 * - CSS class combination
 * - Tailwind CSS class merging
 * - Conditional class application
 */

// STEP 1: Import ng mga kailangan na libraries
import { clsx, type ClassValue } from "clsx" // Para sa pag-combine ng CSS classes
import { twMerge } from "tailwind-merge" // Para sa pag-merge ng Tailwind CSS classes

// STEP 2: cn function - para sa pag-combine at pag-merge ng CSS classes
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs)) // I-combine ang classes gamit ang clsx, tapos i-merge gamit ang twMerge
}
