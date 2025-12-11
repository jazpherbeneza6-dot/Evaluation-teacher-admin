"use client"

/*
 * DashboardSidebar - Ito ang navigation sidebar ng admin dashboard
 * 
 * Mga Features:
 * 1. Navigation menu para sa iba't ibang sections
 * 2. Active state indicator (nagpapakita kung anong page ang currently selected)
 * 3. Icons at descriptions para sa bawat menu item
 * 4. Smooth transitions at hover effects
 * 5. Responsive design
 * 
 * Mga Menu Items:
 * - Dashboard: Overview at analytics
 * - Professors: Pag-manage ng faculty profiles
 * - Evaluations: Question management
 * - Students: Pag-manage ng student accounts
 * 
 * Paano gumagana:
 * - Kapag pinindot ang menu item, tatawagin ang onViewChange function
 * - Ang activeView prop ay nagpapakita kung anong page ang currently selected
 * - May visual feedback (colors, shadows) para sa active state
 */

import { cn } from "@/lib/utils" // Utility function para sa conditional CSS classes
import { Button } from "@/components/ui/button"
import { Users, HelpCircle, BarChart3, GraduationCap, TrendingUp, Clock, FileBarChart, X } from "lucide-react"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"

// Type definition para sa mga available views
export type ActiveView = "overview" | "professors" | "evaluation-questions" | "evaluation-results" | "students" | "evaluation-duration"

// Interface para sa props ng DashboardSidebar
interface DashboardSidebarProps {
  activeView: ActiveView // Current active view
  onViewChange: (view: ActiveView) => void // Function na tatawagin kapag nag-change ang view
  isMobileOpen?: boolean // Para sa mobile drawer state
  onMobileClose?: () => void // Function para i-close ang mobile drawer
}

// Array ng sidebar menu items
const sidebarItems = [
  {
    id: "overview" as const, // Dashboard overview
    label: "Dashboard",
    icon: BarChart3, // Chart icon para sa analytics
    description: "Overview and analytics",
  },
  {
    id: "professors" as const, // Professor management
    label: "Professors",
    icon: Users, // Users icon para sa faculty
    description: "Manage faculty profiles",
  },
  {
    id: "evaluation-questions" as const, // Evaluation questions
    label: "Question Management",
    icon: HelpCircle, // Question mark icon para sa questions
    description: "Question management",
  },
  {
    id: "evaluation-duration" as const, // Evaluation duration
    label: "Duration of evaluation",
    icon: Clock, // Clock icon para sa duration
    description: "Set time and deadline",
  },
  {
    id: "evaluation-results" as const, // Evaluation results
    label: "Evaluation Results",
    icon: FileBarChart, // Chart icon para sa results
    description: "View faculty results",
  },
  {
    id: "students" as const, // Student management
    label: "Students",
    icon: GraduationCap, // Graduation cap icon para sa students
    description: "Manage student accounts",
  },
]

// Sidebar Content Component - para ma-reuse sa desktop at mobile
const SidebarContent = ({ activeView, onViewChange, onItemClick }: { 
  activeView: ActiveView
  onViewChange: (view: ActiveView) => void
  onItemClick?: () => void
}) => {
  const handleClick = (view: ActiveView) => {
    onViewChange(view)
    if (onItemClick) {
      onItemClick() // Close mobile drawer kapag may item na pinindot
    }
  }

  return (
    <div className="p-4 sm:p-6">
      {/* Header section ng sidebar */}
      <div className="mb-6 sm:mb-8">
        <h2 className="text-base sm:text-lg font-semibold text-foreground mb-2">Navigation</h2>
        {/* Decorative line */}
        <div className="h-1 w-12 bg-gradient-to-r from-primary to-secondary rounded-full"></div>
      </div>

      {/* Navigation menu */}
      <nav className="space-y-2 sm:space-y-3">
        {/* Loop through sidebar items para i-render ang mga menu buttons */}
        {sidebarItems.map((item) => {
          const Icon = item.icon // Kunin ang icon component
          const isActive = activeView === item.id // Check kung active ang current item

          return (
            <Button
              key={item.id}
              variant={isActive ? "secondary" : "ghost"} // Different variant depende sa active state
              className={cn(
                "w-full justify-start gap-2 sm:gap-3 h-auto p-3 sm:p-4 rounded-lg sm:rounded-xl transition-all duration-200 overflow-hidden",
                isActive
                  ? "bg-emerald-700 text-white shadow-soft hover:shadow-glow hover:bg-emerald-600" // Active state styling
                  : "hover:bg-muted/50 hover:shadow-soft", // Inactive state styling
              )}
              onClick={() => handleClick(item.id)} // Tawagin ang onViewChange kapag pinindot
            >
              {/* Icon container */}
              <div className={cn("p-1.5 sm:p-2 rounded-lg transition-colors flex-shrink-0", isActive ? "bg-white/20" : "bg-muted")}>
                <Icon className="h-4 w-4 sm:h-5 sm:w-5" />
              </div>
              {/* Text content */}
              <div className="text-left flex-1 min-w-0">
                <div className="font-semibold text-xs sm:text-sm break-words">{item.label}</div>
                <div className={cn("text-xs mt-0.5 sm:mt-1 break-words leading-relaxed hidden sm:block", isActive ? "text-white" : "text-muted-foreground")}>
                  {item.description}
                </div>
              </div>
            </Button>
          )
        })}
      </nav>
    </div>
  )
}

export function DashboardSidebar({ activeView, onViewChange, isMobileOpen, onMobileClose }: DashboardSidebarProps) {
  return (
    <>
      {/* Desktop Sidebar - Hidden on mobile */}
      <aside className="hidden lg:flex w-72 border-r border-border/50 bg-card/50 backdrop-blur-sm flex-shrink-0">
        <SidebarContent activeView={activeView} onViewChange={onViewChange} />
      </aside>

      {/* Mobile Sidebar - Sheet/Drawer */}
      <Sheet open={isMobileOpen} onOpenChange={(open) => !open && onMobileClose?.()}>
        <SheetContent side="left" className="w-72 p-0">
          <div className="flex items-center justify-between p-4 border-b">
            <h2 className="text-lg font-semibold">Navigation</h2>
            <Button
              variant="ghost"
              size="icon"
              onClick={onMobileClose}
              className="lg:hidden"
            >
              <X className="h-5 w-5" />
            </Button>
          </div>
          <SidebarContent activeView={activeView} onViewChange={onViewChange} onItemClick={onMobileClose} />
        </SheetContent>
      </Sheet>
    </>
  )
}
