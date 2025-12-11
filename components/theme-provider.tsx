'use client'

/*
 * ThemeProvider - Ito ang component na nagma-manage ng dark/light mode ng buong application
 * 
 * Paano ito gumagana:
 * 1. Ginagamit namin ang next-themes library para sa theme switching
 * 2. Ito ay wrapper component na nagbibigay ng theme context sa lahat ng child components
 * 3. Automatic na nag-save ang theme preference sa localStorage
 * 4. Responsive sa system theme changes (kung nag-change ang OS theme)
 * 
 * Features:
 * - Dark mode / Light mode switching
 * - System theme detection
 * - Persistent theme storage
 * - Smooth transitions between themes
 */

import * as React from 'react'
import {
  ThemeProvider as NextThemesProvider, // Import ang actual theme provider mula sa next-themes
  type ThemeProviderProps, // Type definition para sa props
} from 'next-themes'

// Ito ang main ThemeProvider component
// Ginagamit namin ang NextThemesProvider at pinapasa lang ang lahat ng props
export function ThemeProvider({ children, ...props }: ThemeProviderProps) {
  // Ang children ay ang lahat ng components na nasa loob ng ThemeProvider
  // Ang ...props ay ang mga additional props na maaaring ipasa (like defaultTheme, storageKey, etc.)
  return <NextThemesProvider {...props}>{children}</NextThemesProvider>
}
