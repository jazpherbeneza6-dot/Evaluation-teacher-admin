/*
 * AUTHENTICATION HOOK - Ito ang hook para sa pag-manage ng user authentication
 * 
 * SIMPLE EXPLANATION:
 * 1. Ginagamit ito para sa pag-check kung sino ang naka-login
 * 2. May default admin na automatic na naka-login
 * 3. Pwede ring mag-logout at mag-clear ng lahat ng data
 * 4. Real-time na nag-uupdate kapag may pagbabago sa authentication
 * 
 * MGA FEATURES:
 * - Default admin authentication
 * - Firebase authentication
 * - Logout functionality
 * - Real-time auth state updates
 */

"use client"

// STEP 1: Import ng mga kailangan na React hooks at Firebase functions
import type React from "react"
import { createContext, useContext, useEffect, useState } from "react" // React hooks
import { type User, onAuthStateChanged, signOut, signInAnonymously } from "firebase/auth" // Firebase auth functions
import { auth } from "@/lib/firebase" // Firebase configuration

// STEP 2: Define ang interface para sa AuthContext
interface AuthContextType {
  user: User | null // User object o null kung walang naka-login
  initializing: boolean // Kung nag-i-initialize pa ba ang auth
  logout: () => Promise<void> // Function para sa pag-logout
}

// STEP 3: Create ang AuthContext na may default values
const AuthContext = createContext<AuthContextType>({
  user: null, // Walang user by default
  initializing: true, // Nag-i-initialize by default
  logout: async () => {}, // Empty logout function by default
})

// STEP 4: AuthProvider component - main provider para sa authentication
export function AuthProvider({ children }: { children: React.ReactNode }) {
  // STEP 5: State variables para sa user at initialization
  const [user, setUser] = useState<User | null>(null) // Current user o null
  const [initializing, setInitializing] = useState(true) // Kung nag-i-initialize pa ba

  // STEP 6: useEffect para sa pag-check ng default admin at authentication
  useEffect(() => {
    // Function para sa pag-check kung may default admin
    const checkDefaultAdmin = async () => {
      const isDefaultAdmin = localStorage.getItem("defaultAdmin") // I-check sa localStorage
      if (isDefaultAdmin === "true") {
        try {
          // I-try ang anonymous sign-in para sa default admin
          const userCredential = await signInAnonymously(auth)
          const mockUser = {
            ...userCredential.user,
            email: "admin@system.local", // Set ang email
            displayName: "System Administrator", // Set ang display name
          } as User
          setUser(mockUser) // I-set ang user
          setInitializing(false) // Tapos na ang initialization
          return true
        } catch (error) {
          console.error("Failed to sign in anonymously for default admin:", error)
          // Fallback: gumawa ng mock user kung hindi gumana ang anonymous auth
          const mockUser = {
            uid: "default-admin",
            email: "admin@system.local",
            displayName: "System Administrator",
          } as User
          setUser(mockUser) // I-set ang mock user
          setInitializing(false) // Tapos na ang initialization
          return true
        }
      }
      return false // Hindi default admin
    }

    // I-run ang checkDefaultAdmin function
    checkDefaultAdmin().then((isDefaultAdmin) => {
      if (isDefaultAdmin) {
        return // Kung default admin, hindi na kailangan ng Firebase auth
      }

      // Kung hindi default admin, i-listen ang Firebase auth state changes
      const unsubscribe = onAuthStateChanged(auth, (user) => {
        setUser(user) // I-update ang user state
        setInitializing(false) // Tapos na ang initialization
      })

      return () => unsubscribe() // I-cleanup ang listener kapag mag-unmount
    })
  }, []) // I-run lang once kapag na-mount ang component

  // STEP 7: Logout function para sa pag-logout ng user
  const logout = async () => {
    try {
      // I-clear ang lahat ng auth states
      localStorage.removeItem("defaultAdmin") // I-remove ang default admin flag
      localStorage.clear() // I-clear ang lahat ng localStorage
      await signOut(auth) // I-sign out sa Firebase
      setUser(null) // I-set ang user sa null
      
      // I-force ang clean state
      window.location.href = "/" // I-redirect sa home page
      window.location.reload() // I-reload ang page
    } catch (error) {
      console.warn("Error during logout:", error)
      // Fallback cleanup kung may error
      localStorage.clear() // I-clear ang localStorage
      setUser(null) // I-set ang user sa null
      window.location.href = "/" // I-redirect sa home page
      window.location.reload() // I-reload ang page
    }
  }

  // STEP 8: I-return ang AuthContext.Provider na may mga values
  return <AuthContext.Provider value={{ user, initializing, logout }}>{children}</AuthContext.Provider>
}

// STEP 9: useAuth hook - para sa pag-access ng auth context
export const useAuth = () => {
  const context = useContext(AuthContext) // Kunin ang context
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider") // I-throw ang error kung walang provider
  }
  return context // I-return ang context
}
