/*
 * FILTER HOOK - Ito ang hook para sa pag-manage ng mga filters sa system
 * 
 * SIMPLE EXPLANATION:
 * 1. Ginagamit ito para sa pag-filter at pag-sort ng mga data
 * 2. Pwede kang mag-search, mag-filter by department, at mag-sort
 * 3. May date range filter din para sa mga data na may dates
 * 4. Real-time na nag-a-apply ang filters sa mga data
 * 
 * MGA FEATURES:
 * - Search by name, email, department
 * - Filter by department
 * - Sort by different fields
 * - Date range filtering
 * - Completion rate filtering
 * - Reset all filters
 */

"use client"

// STEP 1: Import ng mga kailangan na React hooks
import { createContext, useContext, useState, type ReactNode } from "react"

// STEP 2: Define ang FilterState interface - lahat ng filter options
interface FilterState {
  searchTerm: string // Text para sa pag-search
  selectedDepartment: string // Napiling department
  completionRateRange: [number, number] // Range ng completion rate (0-100)
  dateRange: {
    from: Date | null // Start date
    to: Date | null // End date
  }
  sortBy: "name" | "department" | "completionRate" | "evaluations" // Field na i-sort
  sortOrder: "asc" | "desc" // Order ng sorting (ascending o descending)
  showOnlyActive: boolean // Kung i-show lang ang active items
}

// STEP 3: Define ang FilterContextType interface - lahat ng functions
interface FilterContextType {
  filters: FilterState // Current filter state
  setSearchTerm: (term: string) => void // Function para sa pag-set ng search term
  setSelectedDepartment: (departmentId: string) => void // Function para sa pag-set ng department
  setCompletionRateRange: (range: [number, number]) => void // Function para sa pag-set ng completion rate range
  setDateRange: (range: { from: Date | null; to: Date | null }) => void // Function para sa pag-set ng date range
  setSortBy: (sortBy: FilterState["sortBy"]) => void // Function para sa pag-set ng sort field
  setSortOrder: (order: FilterState["sortOrder"]) => void // Function para sa pag-set ng sort order
  setShowOnlyActive: (active: boolean) => void // Function para sa pag-set ng show only active
  resetFilters: () => void // Function para sa pag-reset ng lahat ng filters
  applyFilters: <T extends Record<string, any>>(data: T[]) => T[] // Function para sa pag-apply ng filters
}

// STEP 4: Default filter values - initial values ng mga filters
const defaultFilters: FilterState = {
  searchTerm: "", // Walang search term by default
  selectedDepartment: "all", // Lahat ng departments by default
  completionRateRange: [0, 100], // Full range ng completion rate
  dateRange: { from: null, to: null }, // Walang date range by default
  sortBy: "name", // Sort by name by default
  sortOrder: "asc", // Ascending order by default
  showOnlyActive: true, // Show only active items by default
}

// STEP 5: Create ang FilterContext
const FilterContext = createContext<FilterContextType | undefined>(undefined)

// STEP 6: FilterProvider component - main provider para sa filters
export function FilterProvider({ children }: { children: ReactNode }) {
  const [filters, setFilters] = useState<FilterState>(defaultFilters) // State para sa filters

  // STEP 7: Setter functions para sa pag-update ng mga filters
  const setSearchTerm = (term: string) => {
    setFilters((prev) => ({ ...prev, searchTerm: term })) // I-update ang search term
  }

  const setSelectedDepartment = (departmentId: string) => {
    setFilters((prev) => ({ ...prev, selectedDepartment: departmentId })) // I-update ang selected department
  }

  const setCompletionRateRange = (range: [number, number]) => {
    setFilters((prev) => ({ ...prev, completionRateRange: range })) // I-update ang completion rate range
  }

  const setDateRange = (range: { from: Date | null; to: Date | null }) => {
    setFilters((prev) => ({ ...prev, dateRange: range })) // I-update ang date range
  }

  const setSortBy = (sortBy: FilterState["sortBy"]) => {
    setFilters((prev) => ({ ...prev, sortBy })) // I-update ang sort field
  }

  const setSortOrder = (order: FilterState["sortOrder"]) => {
    setFilters((prev) => ({ ...prev, sortOrder: order })) // I-update ang sort order
  }

  const setShowOnlyActive = (active: boolean) => {
    setFilters((prev) => ({ ...prev, showOnlyActive: active })) // I-update ang show only active
  }

  // STEP 8: Reset function para sa pag-reset ng lahat ng filters
  const resetFilters = () => {
    setFilters(defaultFilters) // I-reset sa default values
  }

  // STEP 9: applyFilters function - main function para sa pag-apply ng lahat ng filters
  const applyFilters = <T extends Record<string, any>>(data: T[]): T[] => {
    let filtered = [...data] // I-copy ang data para hindi ma-modify ang original

    // STEP 10: Apply search filter - i-filter base sa search term
    if (filters.searchTerm) {
      filtered = filtered.filter((item) => {
        const searchFields = [item.name, item.email, item.professorName, item.departmentName].filter(Boolean)
        return searchFields.some((field) => field.toLowerCase().includes(filters.searchTerm.toLowerCase()))
      })
    }

    // STEP 11: Apply department filter - i-filter base sa selected department
    if (filters.selectedDepartment !== "all") {
      filtered = filtered.filter(
        (item) => 
          item.departmentId === filters.selectedDepartment || 
          item.department === filters.selectedDepartment ||
          item.departmentName === filters.selectedDepartment
      )
      console.log("Department filter applied:", {
        selectedDepartment: filters.selectedDepartment,
        filteredCount: filtered.length,
        sampleItem: filtered[0]
      })
    }

    // STEP 12: Apply completion rate filter - i-filter base sa completion rate range
    if (filtered.length > 0 && filtered[0].completionRate !== undefined) {
      filtered = filtered.filter(
        (item) =>
          item.completionRate >= filters.completionRateRange[0] &&
          item.completionRate <= filters.completionRateRange[1],
      )
    }

    // STEP 13: Apply date range filter - i-filter base sa date range
    if (filters.dateRange.from || filters.dateRange.to) {
      filtered = filtered.filter((item) => {
        const itemDate = item.createdAt || item.submittedAt || item.updatedAt
        if (!itemDate) return true // Kung walang date, i-include

        const date = new Date(itemDate)
        if (filters.dateRange.from && date < filters.dateRange.from) return false
        if (filters.dateRange.to && date > filters.dateRange.to) return false
        return true
      })
    }

    // STEP 14: Apply sorting - i-sort ang data base sa sortBy at sortOrder
    filtered.sort((a, b) => {
      let aValue = a[filters.sortBy]
      let bValue = b[filters.sortBy]

      // Handle different data types - i-convert sa lowercase kung string
      if (typeof aValue === "string") {
        aValue = aValue.toLowerCase()
        bValue = bValue.toLowerCase()
      }

      if (aValue < bValue) return filters.sortOrder === "asc" ? -1 : 1
      if (aValue > bValue) return filters.sortOrder === "asc" ? 1 : -1
      return 0
    })

    return filtered // I-return ang filtered data
  }

  // STEP 15: I-return ang FilterContext.Provider na may lahat ng values
  return (
    <FilterContext.Provider
      value={{
        filters, // Current filter state
        setSearchTerm, // Function para sa search term
        setSelectedDepartment, // Function para sa department
        setCompletionRateRange, // Function para sa completion rate
        setDateRange, // Function para sa date range
        setSortBy, // Function para sa sort field
        setSortOrder, // Function para sa sort order
        setShowOnlyActive, // Function para sa show only active
        resetFilters, // Function para sa reset
        applyFilters, // Function para sa apply filters
      }}
    >
      {children}
    </FilterContext.Provider>
  )
}

// STEP 16: useFilters hook - para sa pag-access ng filter context
export const useFilters = () => {
  const context = useContext(FilterContext) // Kunin ang context
  if (!context) {
    throw new Error("useFilters must be used within a FilterProvider") // I-throw ang error kung walang provider
  }
  return context // I-return ang context
}
