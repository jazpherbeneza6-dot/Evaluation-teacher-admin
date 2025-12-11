"use client"

/*
 * DashboardHeader - Ito ang header ng admin dashboard
 * 
 * Mga Features:
 * 1. Logo at pangalan ng institusyon
 * 2. User avatar na may dropdown menu
 * 3. Logout functionality
 * 4. Sticky header (sumusunod sa scroll)
 * 5. Responsive design
 * 
 * Paano gumagana:
 * - May avatar sa kanan na kapag pinindot, magbubukas ang dropdown
 * - Sa dropdown, makikita ang user info at logout button
 * - Kapag nag-logout, i-clear ang lahat ng data at redirect sa login page
 */

import { useState } from "react"
import Image from "next/image"
import { useAuth } from "@/hooks/use-auth"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { LogOut, Menu } from "lucide-react"
import type { User as FirebaseUser } from "firebase/auth"

// Interface para sa props ng DashboardHeader
interface DashboardHeaderProps {
  user: FirebaseUser | null // User object mula sa Firebase Auth
  onMenuClick?: () => void // Function para i-open ang mobile menu
}

export function DashboardHeader({ user, onMenuClick }: DashboardHeaderProps) {
  const { logout } = useAuth() // Kunin ang logout function mula sa auth hook
  const [isDropdownOpen, setIsDropdownOpen] = useState(false) // State para sa dropdown menu

  // Function para sa pag-logout
  const handleLogout = async () => {
    try {
      await logout() // Tawagin ang logout function
      localStorage.removeItem("defaultAdmin") // I-clear ang admin state
      localStorage.clear() // I-clear ang lahat ng local storage
      window.location.href = "/" // Redirect sa home/login page
      window.location.reload() // Force reload para sa clean state
    } catch (error) {
      console.error("Error logging out:", error)
      // Fallback redirect kung may error
      window.location.href = "/"
      window.location.reload()
    }
  }

  return (
    <header className="sticky top-0 z-50 border-b border-border/50 bg-white/95 backdrop-blur-md supports-[backdrop-filter]:bg-white/90 shadow-sm">
      <div className="flex h-14 sm:h-16 md:h-20 items-center justify-between px-3 sm:px-4 md:px-6 lg:px-8">
        {/* Left side: Mobile menu button + Logo at pangalan ng institusyon */}
        <div className="flex items-center gap-1.5 sm:gap-2 md:gap-4">
          {/* Mobile Menu Button */}
          <Button
            variant="ghost"
            size="icon"
            onClick={onMenuClick}
            className="lg:hidden h-8 w-8 sm:h-9 sm:w-9"
            aria-label="Open menu"
          >
            <Menu className="h-4 w-4 sm:h-5 sm:w-5" />
          </Button>
          
          <div className="flex items-center gap-1.5 sm:gap-2 md:gap-3">
            {/* Logo ng institusyon */}
            <div className="w-8 h-8 sm:w-10 sm:h-10 md:w-12 md:h-12 relative flex-shrink-0">
              <Image
                src="/Logo.png"
                alt="La Concepcion College Logo"
                width={48}
                height={48}
                className="w-full h-full object-contain"
                priority
              />
            </div>
            {/* Pangalan at subtitle */}
            <div className="border-l border-border/50 pl-1.5 sm:pl-2 md:pl-4">
              <h1 className="text-sm sm:text-base md:text-xl font-bold text-primary">La Concepcion College</h1>
              <p className="text-xs sm:text-sm text-muted-foreground font-medium hidden sm:block">Teacher Evaluation System</p>
            </div>
          </div>
        </div>

        {/* Right side: User avatar at dropdown menu */}
        <div className="flex items-center gap-2 sm:gap-3 relative">
          {/* Avatar button na kapag pinindot, magbubukas ang dropdown */}
          <Button
            variant="ghost"
            className="relative h-8 w-8 sm:h-10 sm:w-10 rounded-full ring-2 ring-primary/20 hover:ring-primary/40 transition-colors cursor-pointer"
            onClick={() => setIsDropdownOpen(!isDropdownOpen)} // Toggle ang dropdown
          >
            <Avatar className="h-8 w-8 sm:h-10 sm:w-10">
              {/* Avatar fallback na nagpapakita ng unang letter ng email */}
              <AvatarFallback className="institutional-gradient text-white font-semibold text-xs sm:text-sm">
                {user?.email?.charAt(0).toUpperCase() || "A"}
              </AvatarFallback>
            </Avatar>
          </Button>

          {/* Dropdown menu na lumalabas kapag pinindot ang avatar */}
          {isDropdownOpen && (
            <>
              {/* Backdrop para sa mobile */}
              <div 
                className="fixed inset-0 z-40 lg:hidden" 
                onClick={() => setIsDropdownOpen(false)}
              />
              <div className="absolute right-0 top-10 sm:top-12 md:top-14 w-56 bg-white border border-gray-200 rounded-md shadow-lg z-50">
                {/* User info section */}
                <div className="p-3 border-b">
                  <p className="text-sm font-medium">Administrator</p>
                  <p className="text-xs text-gray-500 break-words">{user?.email}</p>
                </div>
                {/* Logout button */}
                <button
                  onClick={handleLogout}
                  className="w-full flex items-center px-3 py-2 text-sm hover:bg-gray-100 cursor-pointer"
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  <span>Sign out</span>
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  )
}
