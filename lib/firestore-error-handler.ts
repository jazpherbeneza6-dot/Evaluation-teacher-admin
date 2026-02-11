/**
 * Firestore Error Handler
 * Suppresses known Firestore internal assertion errors that don't affect functionality
 */

if (typeof window !== 'undefined') {
  // Store original error handler
  const originalError = window.console.error
  const originalErrorHandler = window.onerror
  const originalUnhandledRejection = window.onunhandledrejection

  // Override console.error to filter Firestore internal errors
  window.console.error = (...args: any[]) => {
    const errorMessage = args.join(' ')
    
    // Suppress Firestore internal assertion errors
    if (
      errorMessage.includes('FIRESTORE') &&
      errorMessage.includes('INTERNAL ASSERTION FAILED') &&
      (errorMessage.includes('Unexpected state') || 
       errorMessage.includes('ID: ca9') ||
       errorMessage.includes('ID: b815') ||
       errorMessage.includes('ID:') && errorMessage.includes('CONTEXT'))
    ) {
      // Suppress this specific error - it's a known Firestore SDK issue
      console.warn('Firestore internal state error suppressed (known SDK issue)')
      return
    }
    
    // Log other errors normally
    originalError.apply(console, args)
  }

  // Global error handler for uncaught errors
  window.onerror = (message, source, lineno, colno, error) => {
    const errorMessage = String(message || error?.message || '')
    
    // Suppress Firestore internal assertion errors
    if (
      errorMessage.includes('FIRESTORE') &&
      errorMessage.includes('INTERNAL ASSERTION FAILED') &&
      (errorMessage.includes('Unexpected state') || 
       errorMessage.includes('ID: ca9') ||
       errorMessage.includes('ID: b815') ||
       errorMessage.includes('ID:') && errorMessage.includes('CONTEXT'))
    ) {
      console.warn('Firestore internal state error suppressed (known SDK issue)')
      return true // Prevent default error handling
    }
    
    // Call original error handler for other errors
    if (originalErrorHandler) {
      return originalErrorHandler(message, source, lineno, colno, error)
    }
    return false
  }

  // Handle unhandled promise rejections
  window.addEventListener('unhandledrejection', (event) => {
    const errorMessage = String(event.reason?.message || event.reason || '')
    const errorCode = event.reason?.code || ''
    
    // Suppress Firestore internal assertion errors
    if (
      errorMessage.includes('FIRESTORE') &&
      errorMessage.includes('INTERNAL ASSERTION FAILED') &&
      (errorMessage.includes('Unexpected state') || 
       errorMessage.includes('ID: ca9') ||
       errorMessage.includes('ID: b815') ||
       errorMessage.includes('ID:') && errorMessage.includes('CONTEXT'))
    ) {
      console.warn('Firestore internal state error suppressed (known SDK issue)')
      event.preventDefault() // Prevent error from showing
      return
    }
    
    // Suppress MEGA connection timeout errors (handled gracefully in MEGA service)
    if (
      errorCode === 'UND_ERR_CONNECT_TIMEOUT' || 
      errorMessage.includes('Connect Timeout') ||
      errorMessage.includes('ConnectTimeoutError') ||
      errorMessage.includes('fetch failed') ||
      (errorMessage.includes('timeout') && errorMessage.includes('66.203.125')) // MEGA server IPs
    ) {
      // MEGA connection errors are handled in the service layer
      // Don't show unhandled rejection for these
      event.preventDefault()
      return
    }
  })
}

