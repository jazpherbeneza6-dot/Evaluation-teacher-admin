"use client"

// Import ng types mula sa React (para sa type annotations)
import type React from "react"

// Mga hook at utilities
import { useState } from "react"
import { signInWithEmailAndPassword } from "firebase/auth"
import { auth } from "@/lib/firebase"

// UI components mula sa proyekto
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Mail, Lock, Eye, Loader2 } from "lucide-react"

// Ang pangunahing component na nagre-render ng login form
export function LoginForm() {
  // State para sa email input
  // - `email` ang kasalukuyang value
  // - `setEmail` ang function para i-update ito
  const [email, setEmail] = useState("")

  // State para sa password input
  const [password, setPassword] = useState("")

  // State para sa error message na ipapakita sa UI kapag may mali
  const [error, setError] = useState("")

  // State para sa show/hide password toggle
  const [showPassword, setShowPassword] = useState(false)

  // State para sa loading state ng login
  const [isLoading, setIsLoading] = useState(false)

  // Handler kapag sinubmit ang form
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault() // Pinipigilan ang default na page reload ng form
    setError("") // I-clear ang dating error bago mag-try mag-sign in
    setIsLoading(true) // I-set ang loading state

    try {
      // Shortcut: support para sa default admin credentials
      // Kung `admin` at `admin123` ang ipinasok, itatabi sa localStorage
      // at ire-reload ang page para ma-trigger ang authenticated state
      if (email === "admin" && password === "admin123") {
        // Simulate successful authentication para sa default admin
        localStorage.setItem("defaultAdmin", "true")
        window.location.reload() // I-reload ang page para mag-update ang auth UI
        return
      }

      // Gumagamit ng Firebase Auth function para mag-sign in gamit ang email at password
      await signInWithEmailAndPassword(auth, email, password)
      // Kapag success, hindi na kailangang manual na i-reload ang page
      // dahil ang auth state listener ng app ang magpapalit ng view
    } catch (error: any) {
      // Kung may error mula sa Firebase, i-map ang mga error code
      // sa mas user-friendly na mensahe bago i-display
      const errorCode = (error as { code?: string }).code
      let errorMessage = "Failed to sign in"

      switch (errorCode) {
        case "auth/invalid-credential":
          // Mali ang credential format o hindi valid
          errorMessage = "Invalid email or password. Please check your credentials."
          break
        case "auth/user-not-found":
          // Walang account na tumutugma sa email
          errorMessage = "No account found with this email."
          break
        case "auth/wrong-password":
          // Password ay hindi tumutugma
          errorMessage = "Incorrect password."
          break
        case "auth/invalid-email":
          // Hindi valid ang email format
          errorMessage = "Please enter a valid email address."
          break
        case "auth/too-many-requests":
          // Sobra na ang failed attempts - rate limit
          errorMessage = "Too many failed login attempts. Please try again later."
          break
        default:
          // Fallback: gamitin ang original error.message kung meron
          errorMessage = error.message || "Failed to sign in"
      }

      // I-set ang napiling mensahe sa `error` state para i-render sa UI
      setError(errorMessage)
      setIsLoading(false) // I-stop ang loading state kapag may error
    }
  }

  // JSX return: struktura ng UI ng login form
  return (
    <div 
      className="min-h-screen flex bg-cover bg-center bg-no-repeat"
      style={{ backgroundImage: "url('/Background.png')" }}
    >
      {/* Left Side - Branding Section */}
      <div className="hidden lg:flex lg:w-1/2 items-center justify-center p-12 relative overflow-hidden">
        {/* Overlay para sa better text visibility */}
        <div className="absolute inset-0 bg-blue-900/20 backdrop-blur-[1px]"></div>
        
        {/* Branding Content */}
        <div className="relative z-10 text-center text-white max-w-md">
          <div className="flex justify-center mb-8">
            <div className="relative flex items-center justify-center">
              {/* White donut/ring background - same size as logo */}
              <div className="w-70 h-70 rounded-full border-8 border-white/40 shadow-2xl flex items-center justify-center bg-white/20 backdrop-blur-sm">
                {/* Logo ng institusyon - same size as white ring */}
                <img
                  src="/Logo.png"
                  alt="La Concepcion College Logo"
                  className="w-68 h-68 object-contain"
                />
              </div>
            </div>
          </div>
          <h1 className="text-4xl font-bold text-white mb-4 drop-shadow-lg" style={{ fontFamily: 'var(--font-geist-sans), system-ui, sans-serif' }}>
            La Concepcion College
          </h1>
          <p className="text-white/95 text-xl font-semibold mb-2 drop-shadow-md" style={{ fontFamily: 'var(--font-geist-sans), system-ui, sans-serif' }}>
            Admin for Teacher Evaluation System
          </p>
          <p className="text-white/90 text-base italic mt-4 drop-shadow-lg" style={{ fontFamily: 'var(--font-geist-sans), system-ui, sans-serif' }}>
            "Changing Lives for the Better"
          </p>
          <div className="mt-8 pt-8 border-t border-white/30">
            <p className="text-white/90 text-sm font-medium" style={{ fontFamily: 'var(--font-geist-sans), system-ui, sans-serif' }}>
              Admin for Teacher Evaluation System
            </p>
          </div>
        </div>
      </div>

      {/* Right Side - Login Form Section */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-4 sm:p-8">
        <div className="w-full max-w-md">
          {/* Mobile Logo - Only visible on small screens */}
          <div className="lg:hidden text-center mb-8">
            <div className="flex justify-center mb-6">
              <div className="relative flex items-center justify-center">
                {/* White donut/ring background - same size as logo */}
                <div className="w-28 h-28 rounded-full border-8 border-white shadow-lg flex items-center justify-center bg-transparent">
                  {/* Logo ng institusyon - same size as white ring */}
                  <img
                    src="/Logo.png"
                    alt="La Concepcion College Logo"
                    className="w-28 h-28 object-contain"
                  />
                </div>
              </div>
            </div>          
          </div>

          {/* Login form container with soft blue background */}
          <div className="rounded-3xl shadow-xl border-0 overflow-hidden bg-gradient-to-br from-blue-100 via-blue-50 to-blue-200">
            {/* Header section */}
            <div className="text-center pb-4 text-blue-900 pt-6 px-6">
              {/* Title at maliit na description */}
              <h2 className="text-3xl font-bold text-blue-900 mb-3 tracking-tight" style={{ fontFamily: 'var(--font-geist-sans), system-ui, sans-serif', letterSpacing: '-0.02em' }}>
                Admin Login
              </h2>
              <p className="text-sm text-blue-700/90 mb-4 font-medium" style={{ fontFamily: 'var(--font-geist-sans), system-ui, sans-serif' }}>
                Sign in to access the Admin Teacher Evaluation System
              </p>
              {/* Separator below Evaluation System - more visible */}
              <div className="flex items-center justify-center mt-1">
                <div className="h-px w-24 bg-blue-400/60"></div>
              </div>
            </div>
            {/* Content section */}
            <div className="space-y-5 pt-5 pb-6 px-6">
              {/* Form element: onSubmit tumatawag sa handleSubmit */}
              <form onSubmit={handleSubmit} className="space-y-5">
                <div className="space-y-2">
                  <Label htmlFor="email" className="text-sm font-semibold text-blue-900" style={{ fontFamily: 'var(--font-geist-sans), system-ui, sans-serif' }}>
                    Email
                  </Label>
                  {/* Input para sa email/username with icon */}
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-blue-600 z-10" />
                    <Input
                      id="email"
                      type="text"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)} // nag-uupdate ng state habang nagta-type
                      required
                      className="h-11 pl-10 border-2 border-blue-200 focus:border-blue-400 transition-colors bg-white text-gray-900 placeholder:text-gray-500 shadow-sm rounded-lg"
                      style={{ fontFamily: 'var(--font-geist-sans), system-ui, sans-serif' }}
                      placeholder="Enter your email or username"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password" className="text-sm font-semibold text-blue-900" style={{ fontFamily: 'var(--font-geist-sans), system-ui, sans-serif' }}>
                    Password
                  </Label>
                  {/* Input para sa password with icon and show/hide toggle */}
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-blue-600 z-10" />
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)} // nag-uupdate ng password state
                      required
                      className="h-11 pl-10 pr-10 border-2 border-blue-200 focus:border-blue-400 transition-colors bg-white text-gray-900 placeholder:text-gray-500 shadow-sm rounded-lg"
                      style={{ fontFamily: 'var(--font-geist-sans), system-ui, sans-serif' }}
                      placeholder="Enter your password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 text-blue-600 hover:text-blue-700 transition-all focus:outline-none z-10"
                      aria-label={showPassword ? "Hide password" : "Show password"}
                    >
                      <Eye className={`h-5 w-5 transition-opacity ${showPassword ? 'opacity-100' : 'opacity-60'}`} />
                    </button>
                  </div>
                </div>

                {/* Kung may error message, i-render ang Alert component */}
                {error && (
                  <Alert variant="destructive" className="border-red-300 bg-red-50">
                    <AlertDescription className="font-medium text-red-800">{error}</AlertDescription>
                  </Alert>
                )}

                {/* Submit button: kapag pinindot, magt-trigger ng handleSubmit */}
                <div className="pt-4">
                  <Button
                    type="submit"
                    disabled={isLoading}
                    className="w-full h-12 text-base font-semibold bg-blue-600 text-white hover:bg-blue-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg rounded-lg"
                    style={{ fontFamily: 'var(--font-geist-sans), system-ui, sans-serif', letterSpacing: '0.01em' }}
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Signing in...
                      </>
                    ) : (
                      "Sign In"
                    )}
                  </Button>
                </div>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
