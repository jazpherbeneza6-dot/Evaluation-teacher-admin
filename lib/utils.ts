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

// STEP 3: sanitizeErrorMessage function - para sa pag-remove ng sensitive data sa error messages
export function sanitizeErrorMessage(error: unknown): string {
  if (!error) return "An error occurred. Please try again."
  
  const errorMessage = error instanceof Error ? error.message : String(error)
  
  // Remove sensitive patterns
  let sanitized = errorMessage
    // Remove email addresses
    .replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, "[email]")
    // Remove IDs (long alphanumeric strings)
    .replace(/[A-Za-z0-9]{20,}/g, "[id]")
    // Remove tokens and keys
    .replace(/token[=:]\s*[A-Za-z0-9_-]+/gi, "token=[hidden]")
    .replace(/key[=:]\s*[A-Za-z0-9_-]+/gi, "key=[hidden]")
    .replace(/password[=:]\s*[^\s]+/gi, "password=[hidden]")
    // Remove file paths that might reveal system structure
    .replace(/[A-Z]:\\[^\s]+|\\[^\s]+/g, "[path]")
    .replace(/\/[^\s]+/g, "[path]")
    // Remove IP addresses
    .replace(/\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/g, "[ip]")
    // Remove URLs that might contain sensitive data
    .replace(/https?:\/\/[^\s]+/g, "[url]")
  
  // If message contains too much technical detail, return generic message
  const technicalKeywords = ['firebase', 'firestore', 'permission', 'auth', 'database', 'internal', 'assertion']
  const hasTechnicalDetails = technicalKeywords.some(keyword => 
    sanitized.toLowerCase().includes(keyword)
  )
  
  if (hasTechnicalDetails && sanitized.length > 100) {
    return "An error occurred. Please try again or contact support if the problem persists."
  }
  
  return sanitized || "An error occurred. Please try again."
}
