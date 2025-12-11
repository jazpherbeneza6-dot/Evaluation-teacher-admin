"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Download, FileText, FileSpreadsheet, File } from "lucide-react"

interface ExportDropdownProps {
  onExportPDF: () => void
  onExportDOCS: () => void
  onExportCSV: () => void
  disabled?: boolean
}

export function ExportDropdown({ onExportPDF, onExportDOCS, onExportCSV, disabled = false }: ExportDropdownProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [isOpen, setIsOpen] = useState(false)

  const handleExport = async (exportFunction: () => Promise<void> | void) => {
    setIsLoading(true)
    try {
      await exportFunction()
      setIsOpen(false) // Close dropdown after export
    } catch (error) {
      console.error("Export error:", error)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" disabled={disabled || isLoading}>
          <Download className="h-4 w-4 mr-2" />
          {isLoading ? "Exporting..." : "Export"}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuItem 
          onClick={() => handleExport(onExportPDF)}
          className="cursor-pointer"
        >
          <FileText className="h-4 w-4 mr-2" />
          Export as PDF
        </DropdownMenuItem>
        <DropdownMenuItem 
          onClick={() => handleExport(onExportDOCS)}
          className="cursor-pointer"
        >
          <File className="h-4 w-4 mr-2" />
          Export as DOCX
        </DropdownMenuItem>
        <DropdownMenuItem 
          onClick={() => handleExport(onExportCSV)}
          className="cursor-pointer"
        >
          <FileSpreadsheet className="h-4 w-4 mr-2" />
          Export as CSV
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
