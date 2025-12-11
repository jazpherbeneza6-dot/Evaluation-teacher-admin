"use client"

import { useState, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Download, FileText, FileSpreadsheet, File } from "lucide-react"

interface SimpleExportDropdownProps {
  onExportPDF: () => void
  onExportDOCS: () => void
  onExportCSV: () => void
  disabled?: boolean
  size?: "default" | "sm" | "lg" | "icon"
}

export function SimpleExportDropdown({ onExportPDF, onExportDOCS, onExportCSV, disabled = false, size = "sm" }: SimpleExportDropdownProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [showOptions, setShowOptions] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowOptions(false)
      }
    }

    if (showOptions) {
      document.addEventListener('mousedown', handleClickOutside)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [showOptions])

  const handleExport = async (exportFunction: () => Promise<void> | void) => {
    setIsLoading(true)
    try {
      await exportFunction()
      setShowOptions(false) // Close dropdown after export
    } catch (error) {
      console.error("Export error:", error)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="relative" ref={dropdownRef}>
      <Button
        variant="outline"
        size={size}
        disabled={disabled || isLoading}
        onClick={() => setShowOptions(!showOptions)}
      >
        <Download className="h-4 w-4 mr-2" />
        {isLoading ? "Exporting..." : "Export"}
      </Button>

      {showOptions && (
        <div className="absolute right-0 top-full mt-1 w-48 bg-white border border-gray-200 rounded-md shadow-lg z-50">
          <div className="py-1">
            <button
              onClick={() => handleExport(onExportPDF)}
              className="w-full px-4 py-2 text-left text-sm hover:bg-gray-100 flex items-center"
            >
              <FileText className="h-4 w-4 mr-2" />
              Export as PDF
            </button>
            <button
              onClick={() => handleExport(onExportDOCS)}
              className="w-full px-4 py-2 text-left text-sm hover:bg-gray-100 flex items-center"
            >
              <File className="h-4 w-4 mr-2" />
              Export as DOCX
            </button>
            <button
              onClick={() => handleExport(onExportCSV)}
              className="w-full px-4 py-2 text-left text-sm hover:bg-gray-100 flex items-center"
            >
              <FileSpreadsheet className="h-4 w-4 mr-2" />
              Export as CSV
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
