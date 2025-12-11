"use client"

import React, { Component, ErrorInfo, ReactNode } from "react"

interface Props {
  children: ReactNode
  fallback?: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): State {
    // Filter out Firestore internal assertion errors
    const errorMessage = error.message || ""
    if (
      errorMessage.includes("FIRESTORE") &&
      errorMessage.includes("INTERNAL ASSERTION FAILED") &&
      errorMessage.includes("Unexpected state")
    ) {
      // Suppress this specific error - it's a known Firestore SDK issue
      console.warn("Firestore internal state error caught and suppressed:", errorMessage)
      return { hasError: false, error: null }
    }
    
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Filter out Firestore internal assertion errors
    const errorMessage = error.message || ""
    if (
      errorMessage.includes("FIRESTORE") &&
      errorMessage.includes("INTERNAL ASSERTION FAILED") &&
      errorMessage.includes("Unexpected state")
    ) {
      // Suppress this specific error
      console.warn("Firestore internal state error caught and suppressed")
      this.setState({ hasError: false, error: null })
      return
    }

    console.error("Error caught by boundary:", error, errorInfo)
  }

  render() {
    if (this.state.hasError && this.state.error) {
      // Only show fallback for non-Firestore internal errors
      if (this.props.fallback) {
        return this.props.fallback
      }
      
      return (
        <div className="min-h-screen flex items-center justify-center p-4">
          <div className="text-center">
            <h2 className="text-2xl font-bold text-red-600 mb-4">Something went wrong</h2>
            <p className="text-gray-600 mb-4">{this.state.error.message}</p>
            <button
              onClick={() => this.setState({ hasError: false, error: null })}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              Try again
            </button>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}

