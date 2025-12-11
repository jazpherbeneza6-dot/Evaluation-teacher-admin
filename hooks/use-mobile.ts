/*
 * MOBILE DETECTION HOOK - Ito ang hook para sa pag-detect kung mobile device ba
 * 
 * SIMPLE EXPLANATION:
 * 1. Ginagamit ito para sa pag-check kung mobile device ba ang gamit
 * 2. Base sa screen width - kung mas maliit sa 768px, mobile na
 * 3. Real-time na nag-uupdate kapag nag-change ang screen size
 * 4. Useful para sa responsive design
 * 
 * MGA FEATURES:
 * - Mobile breakpoint detection
 * - Real-time screen size monitoring
 * - Responsive design support
 */

import * as React from "react"

// STEP 1: Mobile breakpoint constant - 768px ang standard mobile breakpoint
const MOBILE_BREAKPOINT = 768

// STEP 2: useIsMobile hook - para sa pag-detect kung mobile device
export function useIsMobile() {
  const [isMobile, setIsMobile] = React.useState<boolean | undefined>(undefined) // State para sa mobile detection

  React.useEffect(() => {
    // I-create ang media query listener para sa mobile breakpoint
    const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`)
    
    // Function para sa pag-update ng mobile state
    const onChange = () => {
      setIsMobile(window.innerWidth < MOBILE_BREAKPOINT) // I-check kung mas maliit sa breakpoint
    }
    
    mql.addEventListener("change", onChange) // I-listen ang changes sa screen size
    setIsMobile(window.innerWidth < MOBILE_BREAKPOINT) // I-set ang initial value
    
    return () => mql.removeEventListener("change", onChange) // I-cleanup ang listener
  }, []) // I-run lang once kapag na-mount

  return !!isMobile // I-return ang boolean value (convert undefined to false)
}
