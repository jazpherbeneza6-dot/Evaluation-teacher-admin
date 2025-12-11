"use client"

/*
 * AdvancedFilters - Ito ang component para sa filtering at searching ng data
 * 
 * Mga Features:
 * 1. Search functionality - maghanap ng professors/students by name o email
 * 2. Department filter - i-filter ang data by department
 * 3. Export functionality - mag-export ng data sa PDF, DOCS, o CSV
 * 4. Real-time filtering - instant na nag-uupdate ang results
 * 5. Responsive design - gumagana sa mobile at desktop
 * 
 * Paano gumagana:
 * - Ang search input ay nag-uupdate ng searchTerm sa filter context
 * - Ang department select ay nag-uupdate ng selectedDepartment
 * - Ang export buttons ay nag-trigger ng export functions
 * - Lahat ng changes ay real-time at nag-aaffect sa parent components
 */

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Filter, X, Plus } from "lucide-react"
import { useFilters } from "@/hooks/use-filters" // Custom hook para sa filter state management
import { ExportDropdown } from "@/components/ui/export-dropdown"
import { SimpleExportDropdown } from "@/components/ui/simple-export-dropdown"
import { departmentService } from "@/lib/database"
import { useToast } from "@/hooks/use-toast"
import type { Department } from "@/lib/types"

// Interface para sa props ng AdvancedFilters
interface AdvancedFiltersProps {
  departments: Department[] // Array ng departments para sa filter options
  onExportPDF?: () => void // Function para sa PDF export
  onExportDOCS?: () => void // Function para sa DOCS export
  onExportCSV?: () => void // Function para sa CSV export
  onDepartmentAdded?: () => void // Function para i-refresh ang departments after adding
}

export function AdvancedFilters({ departments, onExportPDF, onExportDOCS, onExportCSV, onDepartmentAdded }: AdvancedFiltersProps) {
  // Kunin ang filter state at functions mula sa useFilters hook
  const {
    filters, // Current filter values
    setSearchTerm, // Function para i-update ang search term
    setSelectedDepartment, // Function para i-update ang selected department
  } = useFilters()

  const { toast } = useToast()
  const [isAddDepartmentDialogOpen, setIsAddDepartmentDialogOpen] = useState(false)
  const [newDepartmentName, setNewDepartmentName] = useState("")
  const [isSaving, setIsSaving] = useState(false)

  // Function para mag-add ng bagong department
  const handleAddDepartment = async () => {
    if (!newDepartmentName.trim()) {
      toast({
        title: "Department name required",
        description: "Please enter a department name.",
        variant: "destructive",
      })
      return
    }

    // Check if department already exists
    const departmentExists = departments.some(
      (dept) => dept.name.toLowerCase().trim() === newDepartmentName.toLowerCase().trim()
    )

    if (departmentExists) {
      toast({
        title: "Department already exists",
        description: "A department with this name already exists.",
        variant: "destructive",
      })
      return
    }

    try {
      setIsSaving(true)
      await departmentService.create(newDepartmentName.trim())
      toast({
        title: "Department added",
        description: `Successfully added "${newDepartmentName.trim()}" department.`,
      })
      setNewDepartmentName("")
      setIsAddDepartmentDialogOpen(false)
      onDepartmentAdded?.()
    } catch (error) {
      console.error("Error adding department:", error)
      toast({
        title: "Failed to add department",
        description: (error as any)?.message || "Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsSaving(false)
    }
  }

  // Count ng active filters (para sa badge display)
  const activeFiltersCount = 0

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          {/* Search input - mas mahaba sa desktop */}
          <div className="w-full sm:flex-1 sm:max-w-xl">
            <div className="relative">
              <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name, email..."
                value={filters.searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          {/* Filters and Actions Row */}
          <div className="flex items-center gap-2 w-full sm:w-auto sm:justify-end">
            {/* Department filter dropdown */}
            <div className="w-full sm:w-auto">
              <Select value={filters.selectedDepartment} onValueChange={setSelectedDepartment}>
                <SelectTrigger className="h-9 text-xs sm:text-sm w-full sm:w-auto">
                  <SelectValue placeholder="All Faculties" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Faculties</SelectItem>
                  {departments.map((dept) => (
                    <SelectItem key={dept.id} value={dept.name}>
                      {dept.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Add Department Button */}
            <Dialog open={isAddDepartmentDialogOpen} onOpenChange={setIsAddDepartmentDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm" className="h-9 px-2 sm:px-3 text-xs sm:text-sm whitespace-nowrap">
                  <Plus className="h-3.5 w-3.5 sm:mr-2" />
                  <span className="hidden sm:inline">Add Department</span>
                  <span className="sm:hidden">Add</span>
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add New Department</DialogTitle>
                  <DialogDescription>
                    Enter the name of the new department to add it to the system.
                  </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="grid gap-2">
                    <Label htmlFor="department-name">Department Name</Label>
                    <Input
                      id="department-name"
                      value={newDepartmentName}
                      onChange={(e) => setNewDepartmentName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !isSaving) {
                          handleAddDepartment()
                        }
                      }}
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setIsAddDepartmentDialogOpen(false)
                      setNewDepartmentName("")
                    }}
                    disabled={isSaving}
                  >
                    Cancel
                  </Button>
                  <Button onClick={handleAddDepartment} disabled={isSaving || !newDepartmentName.trim()}>
                    {isSaving ? "Adding..." : "Add Department"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            {/* Export controls */}
            {(onExportPDF || onExportDOCS || onExportCSV) && (
              <SimpleExportDropdown
                onExportPDF={onExportPDF || (() => { })}
                onExportDOCS={onExportDOCS || (() => { })}
                onExportCSV={onExportCSV || (() => { })}
                size="sm"
              />
            )}
          </div>
        </div>
      </CardHeader>
    </Card>
  )
}
