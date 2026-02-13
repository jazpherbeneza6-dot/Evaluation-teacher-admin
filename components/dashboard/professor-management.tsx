"use client"

/*
 * PROFESSOR MANAGEMENT SYSTEM - Ito ang page para sa pag-manage ng mga professors
 * 
 * SIMPLE EXPLANATION:
 * 1. Dito mo ginagawa ang mga professors (teachers) sa system
 * 2. Pwede kang mag-add, edit, at delete ng mga professors
 * 3. Makikita mo rin dito ang evaluation results ng bawat professor
 * 4. May filtering at searching din para madaling hanapin ang professors
 * 5. Pwede mo ring i-export ang data sa PDF, CSV, o DOCX
 * 
 * MGA FEATURES:
 * - Add/Edit/Delete professors
 * - View evaluation results with charts
 * - Filter by department
 * - Search by name or email
 * - Export data
 * - Real-time updates
 */

// STEP 1: Import ng mga kailangan na components at functions
import React, { useState, useMemo, useEffect } from "react" // React hooks para sa state management
import { Button } from "@/components/ui/button" // Button component
import { Input } from "@/components/ui/input" // Input field component
import { Label } from "@/components/ui/label" // Label component
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog" // Modal dialog components
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select" // Select component
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog" // Confirmation dialog components
import { Card, CardContent } from "@/components/ui/card" // Card components
import { Badge } from "@/components/ui/badge" // Badge component
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar" // Avatar components
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table" // Table components
import { Plus, Edit, Trash2, Search, Users, Info, MapPin, Mail, Calendar, ArrowLeft, FileSpreadsheet, Eye, X, BookOpen, GraduationCap, CheckCircle2, Circle, Upload, Loader2, Pencil, PlusCircle, Trash } from "lucide-react" // Icons
import { Progress } from "@/components/ui/progress" // Progress bar component
import { professorService, departmentService } from "@/lib/database" // Database functions
import { evaluationResultsService } from "@/lib/evaluation-results-service" // Evaluation results service
import { parseExcelProfessors, type ParsedProfessor } from "@/lib/excel-parser" // Excel parser functions
import { useFilters } from "@/hooks/use-filters" // Filter hook
import { AdvancedFilters } from "@/components/filters/advanced-filters" // Filter component
import { exportToCSV, exportToPDF, exportToDOCX, type ExportData } from "@/lib/export-utils" // Export functions
import { useToast } from "@/hooks/use-toast" // Toast notification hook
import { Toaster } from "@/components/ui/toaster" // Toast component
import { sanitizeErrorMessage } from "@/lib/utils" // Helper function para sa pag-sanitize ng error messages
import type { Professor, Department } from "@/lib/types" // Type definitions


// STEP 3: Define ang props na kailangan ng component
interface ProfessorManagementProps {
  professors: Professor[] // Listahan ng mga professors
  departments: Department[] // Listahan ng mga departments
  onRefresh?: () => void // Function para i-refresh ang data
}

// STEP 4: Main component function - dito nagsisimula ang lahat
export function ProfessorManagement({
  professors: initialProfessors, // Initial data ng professors
  departments, // Listahan ng departments
  onRefresh, // Function para i-refresh ang data
}: ProfessorManagementProps) {

  // STEP 5: State variables para sa pag-control ng data at UI
  const [professors, setProfessors] = useState<Professor[]>(initialProfessors) // Listahan ng professors
  const [searchTerm, setSearchTerm] = useState("") // Text para sa pag-search
  const [selectedDepartment, setSelectedDepartment] = useState<string>("all") // Napiling department
  const [selectedDepartmentView, setSelectedDepartmentView] = useState<string | null>(null) // Department na pinipili para sa view
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false) // Para sa popup ng pag-import ng Excel
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false) // Para sa popup ng pag-edit ng professor
  const [editingProfessor, setEditingProfessor] = useState<Professor | null>(null) // Professor na ine-edit
  const [isInfoDialogOpen, setIsInfoDialogOpen] = useState(false) // Para sa popup ng professor info
  const [selectedProfessorInfo, setSelectedProfessorInfo] = useState<Professor | null>(null) // Professor info na pinipili
  const [excelFile, setExcelFile] = useState<File | null>(null) // Excel file na napili
  const [isImporting, setIsImporting] = useState(false) // Loading state para sa import
  const [isReading, setIsReading] = useState(false) // Loading state para sa read
  const [importProgress, setImportProgress] = useState({ current: 0, total: 0 }) // Progress tracking para sa import
  const [previewData, setPreviewData] = useState<ParsedProfessor[]>([]) // Preview data
  const [previewErrors, setPreviewErrors] = useState<string[]>([]) // Preview errors
  const [professorsBySection, setProfessorsBySection] = useState<{ [section: string]: ParsedProfessor[] }>({}) // Grouped by section
  const [newProfessors, setNewProfessors] = useState<ParsedProfessor[]>([]) // New professors (non-duplicates)
  const [duplicateProfessors, setDuplicateProfessors] = useState<ParsedProfessor[]>([]) // Duplicate professors
  const [uploadingDepartmentId, setUploadingDepartmentId] = useState<string | null>(null) // Department na nag-upload ng image
  const [uploadingProfessorId, setUploadingProfessorId] = useState<string | null>(null) // Professor na nag-upload ng image
  const [departmentsState, setDepartmentsState] = useState<Department[]>(departments) // Local state para sa departments
  const [professorsState, setProfessorsState] = useState<Professor[]>(initialProfessors) // Local state para sa professors
  const [professorImageUrls, setProfessorImageUrls] = useState<Record<string, string | null>>({}) // Cache ng professor images from MEGA
  const [departmentImageUrls, setDepartmentImageUrls] = useState<Record<string, string | null>>({}) // Cache ng department images from MEGA

  // State variables para sa pag-edit ng subjects & sections
  const [isEditSubjectsDialogOpen, setIsEditSubjectsDialogOpen] = useState(false) // Para sa popup ng pag-edit ng subjects
  const [editingSubjectSections, setEditingSubjectSections] = useState<Array<{ subject: string; sectionsText: string; courseText: string }>>([]) // Subjects, sections, and course handle na ine-edit
  const [newCourseInputs, setNewCourseInputs] = useState<Record<number, string>>({}) // Per-subject input for adding new courses
  const [isSavingSubjects, setIsSavingSubjects] = useState(false) // Loading state para sa save

  // State variables para sa evaluation statistics (student count by section)
  const [evaluationStats, setEvaluationStats] = useState<{
    totalStudents: number
    sectionBreakdown: { section: string; count: number }[]
  } | null>(null)
  const [isLoadingStats, setIsLoadingStats] = useState(false) // Loading state para sa stats

  // STEP 8: State variables para sa form ng pag-add/edit ng professor
  const [formData, setFormData] = useState({
    name: "", // Pangalan ng professor
    email: "", // Email ng professor
    department: "", // Department ng professor
    password: "", // Password ng professor
    status: "active" as "active" | "inactive" | "resigned" | "retired", // Status ng professor
  })

  const { applyFilters, filters } = useFilters() // Filter functions
  const { toast } = useToast() // Toast notification

  // Helper function para sa pagkuha ng image URL ng professor
  // Priority: profilePictureUrl > imageUrl > cached professorImageUrls > placeholder
  const getProfessorImageUrl = (professor: Professor): string => {
    // Check profilePictureUrl first (highest priority)
    if (professor.profilePictureUrl) {
      return professor.profilePictureUrl
    }
    // Check imageUrl second
    if (professor.imageUrl) {
      return professor.imageUrl
    }
    // Check cached image from MEGA third
    if (professorImageUrls[professor.id]) {
      return professorImageUrls[professor.id]
    }
    // Fallback to placeholder
    return "/placeholder-user.jpg"
  }

  // Update departments state when props change
  useEffect(() => {
    setDepartmentsState(departments)
  }, [departments])

  // Update professors state when props change (important for refresh)
  useEffect(() => {
    setProfessors(initialProfessors)
    setProfessorsState(initialProfessors)
  }, [initialProfessors])

  // Function para sa pag-upload ng department image
  const handleDepartmentImageUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
    departmentId: string,
    departmentName: string
  ) => {
    e.stopPropagation() // Prevent card click

    const file = e.target.files?.[0]
    if (!file) return

    // Validate file type
    const validImageTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp']
    if (!validImageTypes.includes(file.type)) {
      toast({
        title: "Invalid file type",
        description: "Please upload an image file (JPEG, PNG, GIF, or WebP).",
        variant: "destructive",
      })
      return
    }

    // Validate file size (max 5MB)
    const maxSize = 5 * 1024 * 1024 // 5MB
    if (file.size > maxSize) {
      toast({
        title: "File too large",
        description: "Maximum file size is 5MB.",
        variant: "destructive",
      })
      return
    }

    // Validate department exists
    const dept = departmentsState.find(d => d.id === departmentId) || departments.find(d => d.id === departmentId)
    if (!dept) {
      toast({
        title: "Department not found",
        description: "The selected department was not found. Please refresh the page.",
        variant: "destructive",
      })
      return
    }

    setUploadingDepartmentId(departmentId)

    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('departmentId', departmentId)
      formData.append('departmentName', departmentName)

      const response = await fetch('/api/upload-department-image', {
        method: 'POST',
        body: formData,
      })

      const data = await response.json()

      if (!response.ok) {
        // Show detailed error message from API
        const errorMsg = data.message || data.error || 'Failed to upload image'
        throw new Error(errorMsg)
      }

      // Also update local cache for immediate display
      if (data.imageUrl) {
        setDepartmentImageUrls(prev => ({
          ...prev,
          [departmentName]: data.imageUrl
        }))

        // Update local departments state
        setDepartmentsState(prev => prev.map(dept =>
          dept.id === departmentId
            ? { ...dept, imageUrl: data.imageUrl }
            : dept
        ))
      }

      toast({
        title: "Image uploaded successfully",
        description: `Profile picture for ${departmentName} has been saved to database.`,
      })

      // Refresh departments from server to ensure consistency
      if (onRefresh) {
        onRefresh()
      } else {
        // If no onRefresh, manually fetch updated departments
        try {
          const updatedDepts = await departmentService.getAll()
          setDepartmentsState(updatedDepts)
        } catch (error) {
          console.error('Failed to refresh departments:', error)
        }
      }
    } catch (error) {
      // Sanitize error message to remove sensitive data
      const errorMessage = sanitizeErrorMessage(error)

      // Show sanitized error to user
      toast({
        title: "Upload Failed",
        description: errorMessage,
        variant: "destructive",
        duration: 5000, // Show longer for important errors
      })
    } finally {
      setUploadingDepartmentId(null)
      // Reset file input
      e.target.value = ''
    }
  }

  // Function para sa pag-upload ng professor image
  const handleProfessorImageUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
    professorId: string,
    professorName: string
  ) => {
    e.stopPropagation() // Prevent card click

    const file = e.target.files?.[0]
    if (!file) return

    // Validate file type
    const validImageTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp']
    if (!validImageTypes.includes(file.type)) {
      toast({
        title: "Invalid file type",
        description: "Please upload an image file (JPEG, PNG, GIF, or WebP).",
        variant: "destructive",
      })
      return
    }

    // Validate file size (max 5MB)
    const maxSize = 5 * 1024 * 1024 // 5MB
    if (file.size > maxSize) {
      toast({
        title: "File too large",
        description: "Maximum file size is 5MB.",
        variant: "destructive",
      })
      return
    }

    // Validate professor exists
    const prof = professorsState.find(p => p.id === professorId) || professors.find(p => p.id === professorId)
    if (!prof) {
      toast({
        title: "Professor not found",
        description: "The selected professor was not found. Please refresh the page.",
        variant: "destructive",
      })
      return
    }

    setUploadingProfessorId(professorId)

    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('professorId', professorId)
      formData.append('professorName', professorName)

      const response = await fetch('/api/upload-professor-image', {
        method: 'POST',
        body: formData,
      })

      const data = await response.json()

      if (!response.ok) {
        // Show detailed error message from API
        const errorMsg = data.message || data.error || 'Failed to upload image'
        throw new Error(errorMsg)
      }

      // Also update local cache for immediate display
      if (data.imageUrl) {
        setProfessorImageUrls(prev => ({
          ...prev,
          [professorId]: data.imageUrl
        }))

        // Update local professors state with profilePictureUrl
        setProfessorsState(prev => prev.map(prof =>
          prof.id === professorId
            ? { ...prof, profilePictureUrl: data.imageUrl }
            : prof
        ))
        setProfessors(prev => prev.map(prof =>
          prof.id === professorId
            ? { ...prof, profilePictureUrl: data.imageUrl }
            : prof
        ))
      }

      toast({
        title: "Image uploaded successfully",
        description: `Profile picture for ${professorName} has been saved to database.`,
      })

      // Refresh professors from server to ensure consistency
      if (onRefresh) {
        onRefresh()
      } else {
        // If no onRefresh, manually fetch updated professors
        try {
          const updatedProfs = await professorService.getAll()
          setProfessorsState(updatedProfs)
          setProfessors(updatedProfs)
        } catch (error) {
          console.error('Failed to refresh professors:', error)
        }
      }
    } catch (error) {
      // Sanitize error message to remove sensitive data
      const errorMessage = sanitizeErrorMessage(error)

      // Show sanitized error to user
      toast({
        title: "Upload Failed",
        description: errorMessage,
        variant: "destructive",
        duration: 5000, // Show longer for important errors
      })
    } finally {
      setUploadingProfessorId(null)
      // Reset file input
      e.target.value = ''
    }
  }

  // Prevent body scroll when preview popup is open
  useEffect(() => {
    if (previewData.length > 0) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = 'unset'
    }

    return () => {
      document.body.style.overflow = 'unset'
    }
  }, [previewData.length])

  // STEP 12: Filter professors base sa search term at department
  const filteredProfessors = useMemo(() => {
    const result = applyFilters(professors) // I-apply ang filters
    return result // I-return ang filtered results
  }, [professors, applyFilters, filters.searchTerm, filters.selectedDepartment]) // I-run kapag mag-change ang dependencies

  // STEP 13: Group professors by department para sa display
  const professorsByDepartment = useMemo(() => {
    const professorsToGroup = selectedDepartmentView
      ? filteredProfessors.filter((p) => p.departmentName === selectedDepartmentView) // Kung may selected department, i-filter
      : filteredProfessors // Kung walang selected department, gamitin lahat

    const grouped: Record<string, Professor[]> = {} // Container para sa grouped professors
    professorsToGroup.forEach((professor) => {
      const departmentName = professor.departmentName || "No Department" // Department name o "No Department" kung walang department
      if (!grouped[departmentName]) {
        grouped[departmentName] = [] // Gumawa ng bagong array kung walang department na ito
      }
      grouped[departmentName].push(professor) // I-add ang professor sa department
    })
    return grouped // I-return ang grouped professors
  }, [filteredProfessors, selectedDepartmentView]) // I-run kapag mag-change ang dependencies

  // STEP 14: Get unique departments para sa filter dropdown
  const uniqueDepartments = useMemo(() => {
    // Combine departments from professors and from the departments list
    const departmentsSet = new Set<string>() // Set para sa unique departments

    // Add departments from professors
    filteredProfessors.forEach((professor) => {
      if (professor.departmentName) {
        departmentsSet.add(professor.departmentName) // I-add ang department name sa set
      }
    })

    // Also add all departments from the departments prop (even if they have no professors)
    departments.forEach((dept) => {
      departmentsSet.add(dept.name)
    })

    const result = Array.from(departmentsSet) // I-convert ang set sa array
    return result // I-return ang unique departments
  }, [filteredProfessors, departments, filters.searchTerm, filters.selectedDepartment]) // I-run kapag mag-change ang dependencies

  // STEP 15: Helper functions para sa UI interactions
  const handleDepartmentClick = (departmentName: string) => {
    setSelectedDepartmentView(departmentName) // I-set ang selected department para sa view
  }

  const handleBackToDepartments = () => {
    setSelectedDepartmentView(null) // I-reset ang selected department view
  }

  // Function para sa pag-get ng department ID mula sa department name
  const getDepartmentId = async (departmentName: string): Promise<string | null> => {
    try {
      const dept = departments.find(d => d.name === departmentName)
      if (dept) return dept.id

      // If not found in departments list, try to find in Firestore
      const allDepts = await departmentService.getAll()
      const found = allDepts.find(d => d.name === departmentName)
      return found?.id || null
    } catch (error) {
      console.error("Error getting department ID:", error)
      return null
    }
  }


  // STEP 16: Function para sa pag-get ng department image (fallback only - uploaded images take priority)
  const getDepartmentImage = (departmentName: string) => {
    if (!departmentName) return null

    const normalizedName = departmentName.toLowerCase().trim() // I-convert sa lowercase at i-trim

    // Computer Science / BSCS
    if (
      normalizedName.includes("bscs") ||
      normalizedName.includes("computer science") ||
      normalizedName.includes("cs") ||
      normalizedName.includes("computing")
    ) {
      return "/images/BSCS DEPT.png"
    }
    // Information Systems / BSIS
    else if (
      normalizedName.includes("bsis") ||
      normalizedName.includes("information systems") ||
      normalizedName.includes("information system") ||
      normalizedName.includes("is")
    ) {
      return "/images/BSIS DEPT.png"
    }
    // Education
    else if (
      normalizedName.includes("educ") ||
      normalizedName.includes("education") ||
      normalizedName.includes("teaching")
    ) {
      return "/images/EDUC DEPT.png"
    }

    // For other departments, return null to use default icon
    return null
  }

  // STEP 17: DepartmentIcon component para sa pag-display ng department logo
  const DepartmentIcon = ({
    departmentName,
    className = "h-4 w-4 text-gray-600",
    size = "small",
  }: { departmentName: string; className?: string; size?: "small" | "medium" | "large" }) => {
    const sizeClasses = {
      small: "text-sm", // Maliit na size
      medium: "text-lg", // Medium size
      large: "text-2xl sm:text-3xl", // Malaking size
    }

    const currentSize = sizeClasses[size] || sizeClasses.small

    // Show first letter of department name instead of icon
    const firstLetter = departmentName.charAt(0).toUpperCase()

    return (
      <span className={`${currentSize} ${className} font-bold text-blue-600`}>
        {firstLetter}
      </span>
    )
  }


  // STEP 18: Function para sa pag-show ng professor info
  const showProfessorInfo = async (professor: Professor) => {
    setSelectedProfessorInfo(professor) // I-set ang professor info
    setIsInfoDialogOpen(true) // I-open ang info dialog
    setEvaluationStats(null) // Reset previous stats

    // Fetch evaluation statistics for this professor
    setIsLoadingStats(true)
    try {
      const stats = await evaluationResultsService.getEvaluationStatsByProfessor(professor.id)
      setEvaluationStats(stats)
    } catch (error) {
      console.error("Error fetching evaluation stats:", error)
      setEvaluationStats({ totalStudents: 0, sectionBreakdown: [] })
    } finally {
      setIsLoadingStats(false)
    }
  }

  // STEP 21: Function para sa pag-add ng bagong professor
  const handleAddProfessor = async () => {
    if (!formData.name || !formData.email || !formData.department || !formData.password) {
      alert("Please fill in all required fields including password") // I-check kung complete ang form
      return
    }

    if (formData.password.length < 6) {
      alert("Password must be at least 6 characters long") // I-check ang password length
      return
    }

    try {
      // I-create ang professor sa database
      const result = await professorService.create(
        formData.name,
        formData.email,
        formData.department,
        formData.password,
      )

      // Gumawa ng bagong professor object
      const newProfessor: Professor = {
        id: result,
        name: formData.name,
        email: formData.email,
        departmentId: "",
        departmentName: formData.department,
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      setProfessors([...professors, newProfessor]) // I-add ang bagong professor sa list

      setFormData({ name: "", email: "", department: "", password: "", status: "active" }) // I-reset ang form
    } catch (error) {
      console.error("Error adding professor:", error)

      let errorMessage = "Failed to add professor. "
      if ((error as any)?.code === "permission-denied") {
        errorMessage += "Permission denied - please check your authentication status."
      } else if ((error as any)?.code === "unavailable") {
        errorMessage += "Database unavailable - please check your internet connection."
      } else if ((error as any)?.message) {
        errorMessage += `Error: ${(error as any).message}`
      } else {
        errorMessage += "Please try again or contact support."
      }

      alert(errorMessage) // I-show ang error message
    }
  }

  // STEP 22: Function para sa pag-edit ng professor
  const handleEditProfessor = async () => {
    if (!editingProfessor || !formData.name || !formData.email || !formData.department) {
      toast({
        title: "Validation Error",
        description: "Please fill in all required fields",
        variant: "destructive",
      })
      return
    }

    if (formData.password && formData.password.length < 6) {
      toast({
        title: "Validation Error",
        description: "Password must be at least 6 characters long",
        variant: "destructive",
      })
      return
    }

    try {
      // I-update ang professor sa database
      // Parameter order: id, name, email, departmentName, imageUrl, password, status
      // Pass current imageUrl to preserve it, only update password if provided
      await professorService.update(
        editingProfessor.id,
        formData.name,
        formData.email,
        formData.department,
        editingProfessor.imageUrl, // Preserve existing imageUrl (5th parameter)
        formData.password || undefined, // Password (6th parameter)
        formData.status, // Status (7th parameter)
      )

      // Also update subject sections if there are any valid entries
      // Convert sectionsText to sections array for saving
      const validSubjectSections = editingSubjectSections
        .filter(ss => ss.subject.trim() !== '')
        .map(ss => ({
          subject: ss.subject,
          sections: ss.sectionsText.split(',').map(s => s.trim()).filter(s => s),
          course: ss.courseText?.trim() || ''
        }))
      if (validSubjectSections.length > 0) {
        await professorService.updateSubjectSections(editingProfessor.id, validSubjectSections)
      }

      // Gumawa ng updated professor object
      const updatedProfessor = {
        ...editingProfessor,
        name: formData.name,
        email: formData.email,
        departmentName: formData.department,
        status: formData.status, // I-include ang status sa updated object
        subjectSections: validSubjectSections,
        subjects: validSubjectSections.map(ss => ss.subject),
        updatedAt: new Date(),
      }

      setProfessors(professors.map((p) => (p.id === editingProfessor.id ? updatedProfessor : p))) // I-update ang professor sa list

      setIsEditDialogOpen(false) // I-close ang edit dialog
      setEditingProfessor(null) // I-reset ang editing professor
      setFormData({ name: "", email: "", department: "", password: "", status: "active" }) // I-reset ang form
      setEditingSubjectSections([]) // Reset subject sections

      // I-show ang success toast message
      toast({
        title: "Professor Updated",
        description: `${formData.name} has been updated successfully!`,
        variant: "default",
      })
    } catch (error) {
      console.error("Error updating professor:", error)
      // Sanitize error message to remove sensitive data
      let errorMessage = "Failed to update professor. "
      if ((error as any)?.code === "permission-denied") {
        errorMessage += "Permission denied - please check your authentication status."
      } else if ((error as any)?.code === "unavailable") {
        errorMessage += "Database unavailable - please check your internet connection."
      } else {
        const sanitized = sanitizeErrorMessage(error)
        if (sanitized !== "An error occurred. Please try again.") {
          errorMessage += sanitized
        } else {
          errorMessage += "Please try again or contact support."
        }
      }
      toast({
        title: "Update Failed",
        description: errorMessage,
        variant: "destructive",
      })
    }
  }

  // STEP 23: Function para sa pag-delete ng professor
  const handleDeleteProfessor = async (professorId: string) => {
    const professor = professors.find((p) => p.id === professorId) // Hanapin ang professor
    const professorName = professor?.name || "Unknown" // Kunin ang pangalan

    // Save original list for potential revert
    const originalProfessors = [...professors]

    // Optimistic update - remove from UI immediately
    setProfessors(professors.filter((p) => p.id !== professorId))

    // Show success toast immediately (optimistic)
    toast({
      title: "Professor Deleted",
      description: `${professorName} and all associated data have been permanently deleted.`,
      variant: "default",
    })

    try {
      console.log(`Starting comprehensive deletion for professor: ${professorName}`)

      // Delete professor in background
      await professorService.delete(professorId)

      if (onRefresh) {
        onRefresh() // I-refresh ang data kung may onRefresh function
      }
    } catch (error) {
      console.error("Error deleting professor:", error)
      // Revert optimistic update on error
      setProfessors(originalProfessors)

      toast({
        title: "Delete Failed",
        description: `Failed to delete professor. ${sanitizeErrorMessage(error)}`,
        variant: "destructive",
      })
    }
  }

  // Function para sa pag-delete ng lahat ng professors
  const handleDeleteAllProfessors = async () => {
    if (professors.length === 0) {
      toast({
        title: "No Professors to Delete",
        description: "There are no professors in the system.",
        variant: "default",
      })
      return
    }

    const totalCount = professors.length // Save count before deletion

    try {
      // Delete all professors in parallel
      await Promise.all(professors.map((professor) => professorService.delete(professor.id)))

      // Clear the professors list
      setProfessors([])

      toast({
        title: "All Professors Deleted",
        description: `Successfully deleted ${totalCount} professor${totalCount !== 1 ? "s" : ""} and all associated data.`,
        variant: "default",
      })

      if (onRefresh) {
        onRefresh() // I-refresh ang data
      }
    } catch (error) {
      console.error("Error deleting all professors:", error)
      toast({
        title: "Delete Failed",
        description: `Failed to delete all professors. ${sanitizeErrorMessage(error)}`,
        variant: "destructive",
      })
    }
  }

  // STEP 24: Function para sa pag-open ng edit dialog
  const openEditDialog = (professor: Professor) => {
    setEditingProfessor(professor) // I-set ang professor na ie-edit

    // Get status from professor, default to "active" if not set
    const professorStatus = "status" in professor && professor.status
      ? professor.status
      : "active"

    setFormData({
      name: professor.name,
      email: professor.email,
      department: professor.departmentName,
      password: "", // Hindi i-fill ang password para sa security
      status: professorStatus as "active" | "inactive" | "resigned" | "retired", // I-set ang status o default sa "active"
    })

    // Initialize subject sections for editing (convert to sectionsText format)
    const prof = professor as any
    if (prof.subjectSections && prof.subjectSections.length > 0) {
      setEditingSubjectSections(prof.subjectSections.map((ss: any) => ({
        subject: ss.subject,
        sectionsText: Array.isArray(ss.sections) ? ss.sections.join(', ') : '',
        courseText: ss.course || ''
      })))
    } else {
      // Convert legacy format to new format
      const subjectsArray = prof.subjects && prof.subjects.length > 0
        ? prof.subjects
        : prof.subject
          ? [prof.subject]
          : []

      if (subjectsArray.length > 0) {
        const sectionsText = prof.handledSection || ''
        setEditingSubjectSections(subjectsArray.map((subj: string) => ({ subject: subj, sectionsText, courseText: '' })))
      } else {
        setEditingSubjectSections([{ subject: '', sectionsText: '', courseText: '' }])
      }
    }

    setIsEditDialogOpen(true) // I-open ang edit dialog
  }

  // STEP 25: Reset form kapag mag-close ang edit dialog
  useEffect(() => {
    if (!isEditDialogOpen) {
      setFormData({
        name: "",
        email: "",
        department: "",
        password: "",
        status: "active",
      })
      setEditingProfessor(null) // I-reset ang editing professor
    }
  }, [isEditDialogOpen])

  // STEP 26: Function para sa pag-reset ng form
  const resetForm = () => {
    setFormData({ name: "", email: "", department: "", password: "", status: "active" }) // I-reset ang form data
    setEditingProfessor(null) // I-reset ang editing professor
  }

  // FUNCTION PARA SA PAG-IMPORT NG PROFESSORS MULA SA EXCEL
  const handleExcelFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      // Validate file type
      const validTypes = [
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
        'application/vnd.ms-excel', // .xls
      ]
      const validExtensions = ['.xlsx', '.xls']
      const fileExtension = file.name.substring(file.name.lastIndexOf('.')).toLowerCase()

      if (!validTypes.includes(file.type) && !validExtensions.includes(fileExtension)) {
        toast({
          title: "Invalid File Type",
          description: "Please select an Excel file (.xlsx or .xls)",
          variant: "destructive",
        })
        return
      }

      setExcelFile(file)
      // Clear previous preview data when new file is selected
      setPreviewData([])
      setPreviewErrors([])
      setProfessorsBySection({})
    }
  }

  // FUNCTION PARA BUMASA NG EXCEL AT IPAKITA ANG DATA BY SECTION
  const handleReadExcel = async () => {
    if (!excelFile) {
      toast({
        title: "No File Selected",
        description: "Please select an Excel file first",
        variant: "destructive",
      })
      return
    }

    setIsReading(true)
    setPreviewData([])
    setPreviewErrors([])
    setProfessorsBySection({})
    setNewProfessors([])
    setDuplicateProfessors([])

    try {
      // Parse Excel file
      const parseResult = await parseExcelProfessors(excelFile)

      if (parseResult.professors.length === 0) {
        toast({
          title: "No Professors Found",
          description: "The Excel file does not contain valid professor data. Please check the file format.",
          variant: "destructive",
        })
        setIsReading(false)
        return
      }

      // Check for duplicates by comparing emails with existing professors
      const existingEmails = new Set<string>(
        professors.map(p => p.email.toLowerCase().trim())
      )

      const newProfessorsList: ParsedProfessor[] = []
      const duplicateProfessorsList: ParsedProfessor[] = []

      parseResult.professors.forEach(professor => {
        const emailLower = professor.email.toLowerCase().trim()
        if (existingEmails.has(emailLower)) {
          duplicateProfessorsList.push(professor)
        } else {
          newProfessorsList.push(professor)
          // Add to set to prevent duplicates within the same Excel file
          existingEmails.add(emailLower)
        }
      })

      // Set preview data
      setPreviewData(parseResult.professors)
      setPreviewErrors(parseResult.errors)
      setProfessorsBySection(parseResult.professorsBySection)
      setNewProfessors(newProfessorsList)
      setDuplicateProfessors(duplicateProfessorsList)

      // Close import dialog and show preview popup
      setIsImportDialogOpen(false)

      const message = duplicateProfessorsList.length > 0
        ? `Found ${parseResult.professors.length} professors. ${newProfessorsList.length} will be imported, ${duplicateProfessorsList.length} already exist and will be skipped.`
        : `Found ${parseResult.professors.length} professors. All are new and will be imported.`

      toast({
        title: "Excel Read Successfully",
        description: message,
        variant: "default",
      })
    } catch (error) {
      console.error("Error reading Excel:", error)
      toast({
        title: "Read Failed",
        description: `Failed to read Excel file. ${sanitizeErrorMessage(error)}`,
        variant: "destructive",
      })
    } finally {
      setIsReading(false)
    }
  }

  const handleImportExcel = async () => {
    if (!excelFile) {
      toast({
        title: "No File Selected",
        description: "Please select an Excel file to import",
        variant: "destructive",
      })
      return
    }

    setIsImporting(true)

    try {
      // Use new professors from preview (duplicates already filtered out)
      let professorsToImport: Array<{
        name: string
        email: string
        departmentName: string
        password: string
        subjects?: string[] // Array of subjects (supports multiple subjects)
        subjectSections?: Array<{ subject: string; sections: string[]; course?: string }> // Paired subjects with sections and course handle
        handledSection?: string
      }> = []

      if (newProfessors.length > 0) {
        // Use already filtered new professors from preview
        professorsToImport = newProfessors.map(professor => ({
          name: professor.name,
          email: professor.email,
          departmentName: professor.department,
          password: professor.password,
          subjects: professor.subjects, // Array of subjects
          subjectSections: professor.subjectSections, // Paired subjects with sections
          handledSection: professor.handledSection,
        }))
      } else if (previewData.length > 0) {
        // Fallback: check for duplicates if newProfessors is empty but previewData exists
        const existingEmails = new Set<string>(
          professors.map(p => p.email.toLowerCase().trim())
        )
        const filtered = previewData.filter(p => !existingEmails.has(p.email.toLowerCase().trim()))
        professorsToImport = filtered.map(professor => ({
          name: professor.name,
          email: professor.email,
          departmentName: professor.department,
          password: professor.password,
          subjects: professor.subjects, // Array of subjects
          subjectSections: professor.subjectSections, // Paired subjects with sections
          handledSection: professor.handledSection,
        }))
      } else {
        // Parse Excel file if no preview data
        const parseResult = await parseExcelProfessors(excelFile)

        if (parseResult.professors.length === 0) {
          toast({
            title: "No Professors Found",
            description: "The Excel file does not contain valid professor data. Please check the file format.",
            variant: "destructive",
          })
          setIsImporting(false)
          return
        }

        // Check for duplicates
        const existingEmails = new Set<string>(
          professors.map(p => p.email.toLowerCase().trim())
        )
        const filtered = parseResult.professors.filter(p => !existingEmails.has(p.email.toLowerCase().trim()))

        professorsToImport = filtered.map(professor => ({
          name: professor.name,
          email: professor.email,
          departmentName: professor.department,
          password: professor.password,
          subjects: professor.subjects, // Array of subjects
          subjectSections: professor.subjectSections, // Paired subjects with sections
          handledSection: professor.handledSection,
        }))
      }

      // Check if there are professors to import
      if (professorsToImport.length === 0) {
        toast({
          title: "No Professors to Import",
          description: "All professors in the Excel file already exist in the database.",
          variant: "default",
        })
        setIsImporting(false)
        return
      }

      console.log(`Importing ${professorsToImport.length} professors...`)

      // Import only new professors (duplicates already filtered)
      // Pass progress callback to track import progress
      const importResult = await professorService.importProfessors(
        professorsToImport,
        (current, total) => {
          setImportProgress({ current, total })
        }
      )

      console.log("Import result:", importResult)

      // Check if import was successful
      if (importResult.success === 0 && importResult.skipped > 0) {
        toast({
          title: "No New Professors Added",
          description: `All ${importResult.skipped} professors already exist in the database.`,
          variant: "default",
        })
      } else if (importResult.success > 0) {
        // Close preview popup immediately to show updated data
        setPreviewData([])
        setPreviewErrors([])
        setProfessorsBySection({})
        setNewProfessors([])
        setDuplicateProfessors([])
        setExcelFile(null)

        // Refresh data immediately to show imported professors (no delay)
        if (onRefresh) {
          onRefresh() // I-refresh ang data immediately
        }

        // Show success message with summary
        const message = `Import completed! ${importResult.success} professor${importResult.success !== 1 ? "s" : ""} added${importResult.skipped > 0 ? `, ${importResult.skipped} skipped (duplicates)` : ""}.`
        toast({
          title: "Import Successful",
          description: message,
          variant: "default",
        })
      }

      // Show errors if any
      if (importResult.errors.length > 0) {
        console.warn("Import errors:", importResult.errors)
        if (importResult.errors.length <= 10) {
          toast({
            title: "Import Warnings",
            description: `${importResult.errors.length} error(s) occurred during import. Check console for details.`,
            variant: "default",
          })
        }
      }
    } catch (error) {
      console.error("Error importing professors:", error)
      toast({
        title: "Import Failed",
        description: `Failed to import professors. ${sanitizeErrorMessage(error)}`,
        variant: "destructive",
      })
    } finally {
      setIsImporting(false)
      setImportProgress({ current: 0, total: 0 }) // Reset progress
    }
  }

  // STEP 27: Export data para sa pag-export ng reports
  const exportData: ExportData = {
    professors: filteredProfessors, // I-export ang filtered professors
    title: "Professor Management Report", // Title ng report
    generatedAt: new Date(), // Date kung kailan ginawa ang report
  }

  // STEP 28: Export functions para sa different formats
  const handleExportCSV = () => {
    exportToCSV(exportData) // I-export sa CSV format
  }

  const handleExportPDF = () => {
    exportToPDF(exportData) // I-export sa PDF format
  }

  const handleExportDOCS = () => {
    exportToDOCX(exportData) // I-export sa DOCX format
  }

  // STEP 29: Main return statement - dito nagsisimula ang UI
  return (
    <div className="space-y-6">
      {/* STEP 30: Header section - title at add button */}
      <div className="flex items-center justify-between gap-2 sm:gap-4">
        <div className="min-w-0 flex-1">
          <h2 className="text-lg md:text-xl lg:text-3xl font-bold text-gray-900 truncate">
            {selectedDepartmentView ? `${selectedDepartmentView} Professors` : "Professor Management"}
          </h2>
          <p className="text-xs md:text-sm lg:text-base text-gray-600 mt-0.5 sm:mt-1 truncate">
            {selectedDepartmentView
              ? `Manage professors in ${selectedDepartmentView} faculty`
              : "Select a faculty to view professors"}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {/* Import Excel Dialog */}
          <Dialog open={isImportDialogOpen} onOpenChange={setIsImportDialogOpen}>
            <DialogTrigger asChild>
              <Button
                onClick={() => {
                  setExcelFile(null)
                  setPreviewData([])
                  setPreviewErrors([])
                  setProfessorsBySection({})
                }}
                size="sm"
                className="flex-1 sm:flex-none h-8 px-2 sm:px-3 text-[10px] sm:text-xs whitespace-nowrap"
              >
                <Upload className="mr-1.5 h-3 w-3 sm:mr-2 sm:h-3.5 sm:w-3.5" />
                Import Excel
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
              <DialogHeader>
                <DialogTitle>Import Professors from Excel</DialogTitle>
                <DialogDescription>
                  Upload an Excel file with professor data. The file should contain columns: NAME, DEPARTMENT, SUBJECTS, HANDLED SECTION, COURSE HANDLE, GMAIL, PASSWORD
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4 overflow-y-auto flex-1 min-h-0">
                <div className="grid gap-2">
                  <Label htmlFor="excel-file">Select Excel File (.xlsx or .xls)</Label>
                  <div className="flex items-center gap-4">
                    <Input
                      id="excel-file"
                      type="file"
                      accept=".xlsx,.xls"
                      onChange={handleExcelFileSelect}
                      className="flex-1"
                      disabled={isImporting}
                    />
                    {excelFile && (
                      <Button
                        type="button"
                        variant="outline"
                        onClick={handleReadExcel}
                        disabled={isReading || isImporting}
                        className="min-w-[140px]"
                      >
                        {isReading ? (
                          <>
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current mr-2"></div>
                            Reading...
                          </>
                        ) : (
                          <>
                            <Eye className="mr-2 h-4 w-4" />
                            Read Excel
                          </>
                        )}
                      </Button>
                    )}
                  </div>
                  {excelFile && (
                    <div className="flex items-center gap-2 p-3 bg-muted rounded-md">
                      <FileSpreadsheet className="h-4 w-4 text-primary" />
                      <div className="flex-1">
                        <div className="text-sm font-medium">{excelFile.name}</div>
                        <div className="text-xs text-muted-foreground">
                          {(excelFile.size / 1024 / 1024).toFixed(2)} MB
                        </div>
                      </div>
                    </div>
                  )}
                  {previewData.length > 0 && (
                    <div className="p-3 bg-green-50 dark:bg-green-950 rounded-md border border-green-200 dark:border-green-800">
                      <div className="text-sm font-medium text-green-800 dark:text-green-200">
                        ✓ Excel file read successfully
                      </div>
                      <div className="text-xs text-green-600 dark:text-green-300 mt-1">
                        Found {previewData.length} professors. Click "Import Professors" to save to database.
                      </div>
                    </div>
                  )}
                </div>
                <div className="text-sm text-muted-foreground space-y-1">
                  <p className="font-medium">Excel Format Requirements:</p>
                  <ul className="list-disc list-inside space-y-1 ml-2">
                    <li>First row should contain headers: NAME, DEPARTMENT, SUBJECTS, HANDLED SECTION, COURSE HANDLE, GMAIL, PASSWORD</li>
                    <li>Each subsequent row represents one professor</li>
                    <li>Duplicate emails will be automatically skipped</li>
                  </ul>
                </div>
              </div>
              <DialogFooter className="mt-4 flex-shrink-0">
                <Button
                  variant="outline"
                  onClick={() => {
                    setIsImportDialogOpen(false)
                    setExcelFile(null)
                    setPreviewData([])
                    setPreviewErrors([])
                    setProfessorsBySection({})
                  }}
                  disabled={isImporting}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleImportExcel}
                  disabled={!excelFile || isImporting || isReading}
                >
                  {isImporting ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Importing...
                    </>
                  ) : (
                    <>
                      <Upload className="mr-2 h-4 w-4" />
                      Import Professors
                    </>
                  )}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* STEP 31: Statistics cards - summary ng data */}
      <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
        {/* Total Professors Card */}
        <Card>
          <CardContent className="pt-4 sm:pt-6">
            <div className="flex items-center justify-between pb-2 border-b border-border mb-3 sm:mb-4">
              <div className="flex items-center gap-2">
                <div className="text-xs sm:text-sm font-medium">Total Professors</div>
                <Users className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-muted-foreground" />
              </div>
            </div>
            <div className="text-xl sm:text-2xl font-bold">{professors.length}</div>
            <p className="text-[10px] sm:text-xs text-muted-foreground">Across all departments</p>
          </CardContent>
        </Card>
        {/* Filtered Results Card */}
        <Card>
          <CardContent className="pt-4 sm:pt-6">
            <div className="flex items-center justify-between pb-2 border-b border-border mb-3 sm:mb-4">
              <div className="flex items-center gap-2">
                <div className="text-xs sm:text-sm font-medium">Filtered Results</div>
                <Search className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-muted-foreground" />
              </div>
            </div>
            <div className="text-xl sm:text-2xl font-bold">{filteredProfessors.length}</div>
            <p className="text-[10px] sm:text-xs text-muted-foreground">Matching current filters</p>
          </CardContent>
        </Card>
        {/* Faculties Card */}
        <Card>
          <CardContent className="pt-4 sm:pt-6">
            <div className="flex items-center justify-between pb-2 border-b border-border mb-3 sm:mb-4">
              <div className="flex items-center gap-2">
                <div className="text-xs sm:text-sm font-medium">Faculties</div>
                <Users className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-muted-foreground" />
              </div>
            </div>
            <div className="text-xl sm:text-2xl font-bold">{departments.length}</div>
            <p className="text-[10px] sm:text-xs text-muted-foreground">Active faculties</p>
          </CardContent>
        </Card>
      </div>

      {/* STEP 32: Advanced Filters component */}
      <AdvancedFilters
        departments={departments}
        onExportPDF={handleExportPDF}
        onExportDOCS={handleExportDOCS}
        onExportCSV={handleExportCSV}
        onDepartmentAdded={onRefresh}
      />

      {/* STEP 33: Main content - department view o faculty list */}
      {selectedDepartmentView ? (
        <div className="space-y-6">
          {/* Back button */}
          <div className="flex justify-start">
            <Button
              variant="outline"
              onClick={handleBackToDepartments}
              className="flex items-center gap-1.5 sm:gap-2 bg-blue-50 border-blue-300 text-blue-700 hover:bg-blue-100 hover:border-blue-400 transition-all duration-200 font-semibold px-4 py-2 sm:px-6 sm:py-3 shadow-md border-2 text-sm sm:text-base"
            >
              <ArrowLeft className="w-4 h-4 sm:w-5 sm:h-5" />
              Back to All Faculties
            </Button>
          </div>


          {/* STEP 34: Professor cards - display ng mga professors sa selected department */}
          {professorsByDepartment[selectedDepartmentView] &&
            professorsByDepartment[selectedDepartmentView].length > 0 ? (
            <div className="space-y-4">
              <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
                {professorsByDepartment[selectedDepartmentView].map((professor, index) => {
                  // Different border colors para sa bawat professor card
                  const borderColors = [
                    "border-l-blue-500",
                    "border-l-green-500",
                    "border-l-purple-500",
                    "border-l-orange-500",
                    "border-l-pink-500",
                    "border-l-indigo-500",
                  ]
                  const borderColor = borderColors[index % borderColors.length]

                  return (
                    <Card
                      key={professor.id}
                      className={`relative bg-white border-2 ${borderColor} rounded-lg overflow-hidden hover:shadow-lg transition-all duration-300`}
                    >
                      {/* Department header */}
                      <div className="bg-gray-50 border-b border-gray-200 px-4 py-3">
                        <div className="flex items-center gap-2">
                          <MapPin className="h-4 w-4 text-gray-600" />
                          <span className="text-gray-800 font-bold text-sm uppercase tracking-wide">
                            {professor.departmentName}
                          </span>
                        </div>
                      </div>

                      <CardContent className="p-3 sm:p-4 lg:p-6">
                        {/* Professor info section */}
                        <div className="flex items-start gap-2 sm:gap-3 lg:gap-4 mb-3 sm:mb-4 lg:mb-6">
                          <div className="relative group">
                            <Avatar className="h-8 w-8 sm:h-10 sm:w-10 lg:h-14 lg:w-14 ring-2 ring-gray-300 flex-shrink-0 cursor-pointer" key={`prof-avatar-${professor.id}-${getProfessorImageUrl(professor)}`}>
                              <AvatarImage
                                src={getProfessorImageUrl(professor)}
                                alt={professor.name}
                                key={`prof-img-${professor.id}-${getProfessorImageUrl(professor)}`}
                                onError={(e) => {
                                  // If image fails to load, hide it and show fallback
                                  console.warn(`Failed to load professor image for ${professor.name}:`, getProfessorImageUrl(professor))
                                  e.currentTarget.style.display = 'none'
                                  // Fallback will show automatically
                                }}
                                onLoad={() => {
                                  // Image loaded successfully
                                  console.log(`Professor image loaded for ${professor.name}`)
                                }}
                              />
                              <AvatarFallback className="bg-gray-100 text-gray-800 text-xs sm:text-sm lg:text-lg font-bold">
                                {professor.name
                                  .split(" ")
                                  .map((n) => n[0])
                                  .join("")
                                  .toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                            {uploadingProfessorId === professor.id ? (
                              <div className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-full z-20">
                                <Loader2 className="h-4 w-4 sm:h-5 sm:w-5 lg:h-6 lg:w-6 text-white animate-spin" />
                              </div>
                            ) : (
                              <>
                                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors rounded-full flex items-center justify-center z-10 pointer-events-none">
                                  <Upload className="h-3 w-3 sm:h-4 sm:w-4 lg:h-5 lg:w-5 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                                </div>
                                <input
                                  type="file"
                                  accept="image/jpeg,image/jpg,image/png,image/gif,image/webp"
                                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-20 rounded-full"
                                  aria-label={`Upload profile picture for ${professor.name}`}
                                  title={`Upload profile picture for ${professor.name}`}
                                  onChange={(e) => {
                                    const prof = professorsState.find(p => p.id === professor.id) || professors.find(p => p.id === professor.id)
                                    if (prof) {
                                      handleProfessorImageUpload(e, prof.id, professor.name)
                                    } else {
                                      toast({
                                        title: "Professor not found",
                                        description: "The selected professor was not found. Please refresh the page.",
                                        variant: "destructive",
                                      })
                                    }
                                  }}
                                  onClick={(e) => e.stopPropagation()}
                                />
                              </>
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex flex-wrap items-center gap-1 sm:gap-1.5 lg:gap-2 mb-1">
                              <h3 className="font-bold text-gray-900 text-sm sm:text-base lg:text-xl break-words">{professor.name}</h3>
                              {/* Status Badge */}
                              {(() => {
                                const professorStatus = (professor as any).status || "active"
                                const isActive = professorStatus === "active"
                                const isResigned = professorStatus === "resigned"
                                const isInactive = professorStatus === "inactive"
                                const isRetired = professorStatus === "retired"

                                // Determine badge color based on status
                                let badgeColorClass = "bg-green-600 text-white hover:bg-green-700" // Active (default)
                                if (isInactive) {
                                  badgeColorClass = "bg-red-600 text-white hover:bg-red-700"
                                } else if (isResigned) {
                                  badgeColorClass = "bg-amber-600 text-white hover:bg-amber-700"
                                } else if (isRetired) {
                                  badgeColorClass = "bg-gray-600 text-white hover:bg-gray-700"
                                }

                                return (
                                  <Badge
                                    variant={isActive ? "default" : "secondary"}
                                    className={`text-[10px] sm:text-xs ${badgeColorClass}`}
                                  >
                                    {isActive ? (
                                      <>
                                        <CheckCircle2 className="h-2.5 w-2.5 sm:h-3 sm:w-3 mr-1" />
                                        Active
                                      </>
                                    ) : isResigned ? (
                                      <>
                                        <Circle className="h-2.5 w-2.5 sm:h-3 sm:w-3 mr-1" />
                                        Resigned
                                      </>
                                    ) : isRetired ? (
                                      <>
                                        <Circle className="h-2.5 w-2.5 sm:h-3 sm:w-3 mr-1" />
                                        Retired
                                      </>
                                    ) : (
                                      <>
                                        <Circle className="h-2.5 w-2.5 sm:h-3 sm:w-3 mr-1" />
                                        Inactive
                                      </>
                                    )}
                                  </Badge>
                                )
                              })()}
                            </div>
                            <p className="text-gray-600 text-xs sm:text-sm font-medium">Professor</p>
                          </div>
                        </div>

                        {/* Professor details */}
                        <div className="space-y-2 sm:space-y-3 md:space-y-4 mb-3 sm:mb-4 md:mb-6">
                          <div className="flex items-center gap-2 sm:gap-3 text-gray-700">
                            <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-blue-500 rounded-full flex-shrink-0"></div>
                            <Mail className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-blue-500 flex-shrink-0" />
                            <span className="text-xs sm:text-sm font-medium break-all">{professor.email}</span>
                          </div>
                          <div className="flex items-center gap-2 sm:gap-3 text-gray-600">
                            <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-gray-400 rounded-full flex-shrink-0"></div>
                            <Calendar className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-gray-500 flex-shrink-0" />
                            <span className="text-xs sm:text-sm">Joined {professor.createdAt.toLocaleDateString()}</span>
                          </div>
                        </div>

                        {/* Action buttons */}
                        <div className="flex flex-col sm:flex-row gap-1.5 sm:gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => showProfessorInfo(professor)}
                            className="flex-1 border-gray-300 text-gray-700 hover:bg-gray-50 hover:border-gray-400 transition-all duration-200 text-[11px] sm:text-xs md:text-sm min-h-[36px] sm:min-h-[40px]"
                          >
                            <Info className="h-3 w-3 sm:h-3.5 sm:w-3.5 md:h-4 md:w-4 sm:mr-2" />
                            <span className="hidden sm:inline">View Info</span>
                            <span className="sm:hidden">Info</span>
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openEditDialog(professor)}
                            className="flex-1 border-gray-300 text-gray-700 hover:bg-gray-50 hover:border-gray-400 transition-all duration-200 text-[11px] sm:text-xs md:text-sm min-h-[36px] sm:min-h-[40px]"
                          >
                            <Edit className="h-3 w-3 sm:h-3.5 sm:w-3.5 md:h-4 md:w-4 sm:mr-2" />
                            Edit
                          </Button>

                        </div>
                      </CardContent>
                    </Card>
                  )
                })}
              </div>
            </div>
          ) : (
            <Card className="bg-white border-2 border-gray-200">
              <CardContent className="pt-6">
                <div className="text-center py-12">
                  <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Users className="h-8 w-8 text-gray-400" />
                  </div>
                  <p className="text-gray-700 font-medium">No professors found in {selectedDepartmentView}</p>
                  <p className="text-gray-500 text-sm mt-2">Add professors to this faculty to get started</p>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      ) : (
        <div className="grid gap-3 sm:gap-4 md:gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          {/* STEP 35: Faculty list - display ng mga departments */}
          {uniqueDepartments.map((departmentName) => {
            const professorCount = professorsByDepartment[departmentName]?.length || 0
            return (
              <Card
                key={departmentName}
                className="cursor-pointer hover:shadow-xl hover:scale-[1.02] transition-all duration-300 border-l-4 border-l-blue-500 bg-white border-gray-200 hover:border-blue-400 h-full flex flex-col"
                onClick={() => handleDepartmentClick(departmentName)}
              >
                <CardContent className="p-4 sm:p-6 flex flex-col h-full">
                  {/* Faculty header */}
                  <div className="flex items-center justify-between mb-3 sm:mb-4 flex-shrink-0">
                    <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0">
                      <div
                        className="w-12 h-12 sm:w-16 sm:h-16 bg-blue-300 rounded-xl flex items-center justify-center shadow-lg border border-gray-200 flex-shrink-0 relative overflow-hidden group cursor-pointer"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {(() => {
                          const dept = departmentsState.find(d => d.name === departmentName)
                          // Priority: database imageUrl first, then cached (for immediate display after upload)
                          const cachedImageUrl = departmentImageUrls[departmentName]
                          const imageUrl = dept?.imageUrl || cachedImageUrl
                          const isUploading = uploadingDepartmentId === dept?.id

                          if (isUploading) {
                            return (
                              <div className="absolute inset-0 w-full h-full flex items-center justify-center bg-blue-200 z-20">
                                <Loader2 className="h-6 w-6 sm:h-8 sm:w-8 text-blue-600 animate-spin" />
                              </div>
                            )
                          }

                          if (imageUrl) {
                            return (
                              <img
                                key={`dept-img-${departmentName}-${imageUrl}`}
                                src={imageUrl}
                                alt={departmentName}
                                className="absolute inset-0 w-full h-full object-cover z-0"
                                loading="lazy"
                                onError={(e) => {
                                  // If uploaded image fails to load, fallback to default icon
                                  console.warn(`Failed to load department image for ${departmentName}:`, imageUrl)
                                  e.currentTarget.style.display = 'none'
                                  // Fallback icon will show automatically
                                }}
                                onLoad={() => {
                                  // Image loaded successfully
                                  console.log(`Department image loaded for ${departmentName}`)
                                }}
                              />
                            )
                          }

                          return (
                            <div className="absolute inset-0 w-full h-full flex items-center justify-center z-0">
                              <DepartmentIcon departmentName={departmentName} size="large" className="" />
                            </div>
                          )
                        })()}

                        {/* Upload overlay - only visible on hover */}
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center z-10 pointer-events-none">
                          <Upload className="h-4 w-4 sm:h-5 sm:w-5 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                        </div>

                        {/* File input - on top for clicking */}
                        <input
                          type="file"
                          accept="image/jpeg,image/jpg,image/png,image/gif,image/webp"
                          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-20"
                          aria-label={`Upload profile picture for ${departmentName}`}
                          title={`Upload profile picture for ${departmentName}`}
                          onChange={(e) => {
                            // Try to find department in departmentsState first
                            let dept = departmentsState.find(d => d.name === departmentName)

                            // If not found, try in props departments
                            if (!dept) {
                              dept = departments.find(d => d.name === departmentName)
                            }

                            if (dept) {
                              handleDepartmentImageUpload(e, dept.id, departmentName)
                            } else {
                              toast({
                                title: "Department not found",
                                description: "The selected department was not found. Please refresh the page.",
                                variant: "destructive",
                              })
                            }
                          }}
                          onClick={(e) => e.stopPropagation()}
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-bold text-gray-900 text-base sm:text-lg md:text-xl line-clamp-2 break-words">{departmentName}</h3>
                        <p className="text-blue-600 text-xs sm:text-sm font-medium">Faculty</p>
                      </div>
                    </div>
                    {/* Professor count badge */}
                    <Badge
                      variant="secondary"
                      className="bg-blue-500 text-white border-0 px-2 py-0.5 sm:px-3 sm:py-1 text-xs sm:text-sm font-semibold flex-shrink-0 ml-2"
                    >
                      {professorCount} Professor{professorCount !== 1 ? "s" : ""}
                    </Badge>
                  </div>

                  {/* Faculty details */}
                  <div className="space-y-2 sm:space-y-3 text-xs sm:text-sm mt-auto">
                    <div className="flex items-center gap-2 sm:gap-3 text-gray-700">
                      <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-green-500 rounded-full flex-shrink-0"></div>
                      <Users className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-green-500 flex-shrink-0" />
                      <span className="font-medium">{professorCount} active professors</span>
                    </div>
                    <div className="flex items-center gap-2 sm:gap-3 text-gray-600">
                      <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-blue-400 rounded-full flex-shrink-0"></div>
                      <Mail className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-blue-400 flex-shrink-0" />
                      <span>Click to view details</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })}

          {uniqueDepartments.length === 0 && (
            <Card className="col-span-full bg-white border-2 border-gray-200">
              <CardContent className="pt-6">
                <div className="text-center py-12">
                  <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4 overflow-hidden">
                    <DepartmentIcon departmentName="Default" size="large" className="text-gray-400" />
                  </div>
                  <p className="text-gray-700 font-medium">No faculties found</p>
                  <p className="text-gray-500 text-sm mt-2">Add professors to automatically create faculties</p>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* STEP 36: Professor Info Dialog - para sa pag-display ng professor information */}
      <Dialog open={isInfoDialogOpen} onOpenChange={setIsInfoDialogOpen}>
        <DialogContent className="max-w-2xl mx-4 max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Professor Information</DialogTitle>
            <DialogDescription>
              Detailed information about the selected professor
            </DialogDescription>
          </DialogHeader>

          {selectedProfessorInfo && (
            <div className="space-y-6 py-4">
              {/* Professor Avatar and Basic Info */}
              <div className="flex items-center gap-6">
                <div className="relative group">
                  <Avatar className="h-20 w-20 ring-4 ring-gray-200 cursor-pointer" key={`info-avatar-${selectedProfessorInfo.id}-${getProfessorImageUrl(selectedProfessorInfo)}`}>
                    <AvatarImage
                      src={getProfessorImageUrl(selectedProfessorInfo)}
                      alt={selectedProfessorInfo.name}
                      key={`info-img-${selectedProfessorInfo.id}-${getProfessorImageUrl(selectedProfessorInfo)}`}
                      onError={(e) => {
                        // If image fails to load, hide it and show fallback
                        console.warn(`Failed to load professor info image for ${selectedProfessorInfo.name}:`, getProfessorImageUrl(selectedProfessorInfo))
                        e.currentTarget.style.display = 'none'
                        // Fallback will show automatically
                      }}
                      onLoad={() => {
                        // Image loaded successfully
                        console.log(`Professor info image loaded for ${selectedProfessorInfo.name}`)
                      }}
                    />
                    <AvatarFallback className="bg-gray-100 text-gray-800 text-2xl font-bold">
                      {selectedProfessorInfo.name
                        .split(" ")
                        .map((n) => n[0])
                        .join("")
                        .toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  {uploadingProfessorId === selectedProfessorInfo.id ? (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-full z-20">
                      <Loader2 className="h-6 w-6 text-white animate-spin" />
                    </div>
                  ) : (
                    <>
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors rounded-full flex items-center justify-center z-10 pointer-events-none">
                        <Upload className="h-5 w-5 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                      <input
                        type="file"
                        accept="image/jpeg,image/jpg,image/png,image/gif,image/webp"
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-20 rounded-full"
                        aria-label={`Upload profile picture for ${selectedProfessorInfo.name}`}
                        title={`Upload profile picture for ${selectedProfessorInfo.name}`}
                        onChange={(e) => {
                          const prof = professorsState.find(p => p.id === selectedProfessorInfo.id) || professors.find(p => p.id === selectedProfessorInfo.id)
                          if (prof) {
                            handleProfessorImageUpload(e, prof.id, selectedProfessorInfo.name)
                          } else {
                            toast({
                              title: "Professor not found",
                              description: "The selected professor was not found. Please refresh the page.",
                              variant: "destructive",
                            })
                          }
                        }}
                        onClick={(e) => e.stopPropagation()}
                      />
                    </>
                  )}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-2xl font-bold text-gray-900">{selectedProfessorInfo.name}</h3>
                    {/* Status Badge - Prominently displayed next to name */}
                    {(() => {
                      const professorStatus = (selectedProfessorInfo as any).status || "active"
                      const isActive = professorStatus === "active"
                      const isResigned = professorStatus === "resigned"
                      const isInactive = professorStatus === "inactive"
                      const isRetired = professorStatus === "retired"

                      // Determine badge color based on status
                      let badgeColorClass = "bg-green-600 text-white hover:bg-green-700" // Active (default)
                      if (isInactive) {
                        badgeColorClass = "bg-red-600 text-white hover:bg-red-700"
                      } else if (isResigned) {
                        badgeColorClass = "bg-amber-600 text-white hover:bg-amber-700"
                      } else if (isRetired) {
                        badgeColorClass = "bg-gray-600 text-white hover:bg-gray-700"
                      }

                      return (
                        <Badge
                          variant={isActive ? "default" : "secondary"}
                          className={badgeColorClass}
                        >
                          {isActive ? (
                            <>
                              <CheckCircle2 className="h-3 w-3 mr-1" />
                              Active
                            </>
                          ) : isResigned ? (
                            <>
                              <Circle className="h-3 w-3 mr-1" />
                              Resigned
                            </>
                          ) : isRetired ? (
                            <>
                              <Circle className="h-3 w-3 mr-1" />
                              Retired
                            </>
                          ) : (
                            <>
                              <Circle className="h-3 w-3 mr-1" />
                              Inactive
                            </>
                          )}
                        </Badge>
                      )
                    })()}
                  </div>
                  <p className="text-lg text-gray-600 mb-1">Professor</p>
                  <p className="text-sm text-gray-500">{selectedProfessorInfo.departmentName}</p>
                </div>
              </div>

              {/* Detailed Information */}
              <div className="grid gap-4">
                <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-lg">
                  <Mail className="h-5 w-5 text-blue-500" />
                  <div>
                    <p className="text-sm font-medium text-gray-700">Email Address</p>
                    <p className="text-gray-900">{selectedProfessorInfo.email}</p>
                  </div>
                </div>

                <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-lg">
                  <MapPin className="h-5 w-5 text-green-500" />
                  <div>
                    <p className="text-sm font-medium text-gray-700">Department</p>
                    <p className="text-gray-900">{selectedProfessorInfo.departmentName}</p>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-4 bg-gray-50 rounded-lg">
                  <BookOpen className="h-5 w-5 text-indigo-500 mt-0.5" />
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-3">
                      <p className="text-sm font-medium text-gray-700">Subjects Handled, Course Handled, Handled Year & Sections</p>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50"
                        onClick={() => {
                          const prof = selectedProfessorInfo as any
                          // Initialize with existing subjectSections or create from legacy data (using sectionsText format)
                          if (prof.subjectSections && prof.subjectSections.length > 0) {
                            setEditingSubjectSections(prof.subjectSections.map((ss: any) => ({
                              subject: ss.subject,
                              sectionsText: Array.isArray(ss.sections) ? ss.sections.join(', ') : '',
                              courseText: ss.course || ''
                            })))
                          } else {
                            // Convert legacy format to new format
                            const subjectsArray = prof.subjects && prof.subjects.length > 0
                              ? prof.subjects
                              : prof.subject
                                ? [prof.subject]
                                : []

                            if (subjectsArray.length > 0) {
                              // Create subject sections from legacy data
                              const sectionsText = prof.handledSection || ''
                              setEditingSubjectSections(subjectsArray.map((subj: string) => ({ subject: subj, sectionsText, courseText: '' })))
                            } else {
                              // Start with empty subject section
                              setEditingSubjectSections([{ subject: '', sectionsText: '', courseText: '' }])
                            }
                          }
                          setIsEditSubjectsDialogOpen(true)
                        }}
                      >
                        <Pencil className="h-3.5 w-3.5 mr-1" />
                        Edit
                      </Button>
                    </div>
                    {(() => {
                      // Check if there are subject-section pairs
                      const prof = selectedProfessorInfo as any

                      // Prefer subjectSections if available (new format)
                      if (prof.subjectSections && prof.subjectSections.length > 0) {
                        return (
                          <div className="space-y-3">
                            {prof.subjectSections.map((ss: { subject: string; sections: string[]; course?: string }, idx: number) => (
                              <div key={idx} className="bg-white p-3 rounded-md border border-gray-200">
                                <div className="flex items-center gap-2 mb-2">
                                  <Badge variant="default" className="text-xs">
                                    {ss.subject}
                                  </Badge>
                                </div>
                                {ss.course && (
                                  <div className="mb-2">
                                    <span className="text-xs text-gray-500">Course: </span>
                                    {ss.course.includes(',') ? (
                                      <div className="flex flex-wrap gap-1 mt-1">
                                        {ss.course.split(',').map((c: string, cIdx: number) => c.trim()).filter((c: string) => c).map((c: string, cIdx: number) => (
                                          <Badge key={cIdx} variant="outline" className="text-xs text-indigo-700 border-indigo-300">
                                            {c}
                                          </Badge>
                                        ))}
                                      </div>
                                    ) : (
                                      <span className="text-xs font-medium text-indigo-700">{ss.course}</span>
                                    )}
                                  </div>
                                )}
                                {ss.sections && ss.sections.length > 0 ? (
                                  <div className="flex flex-wrap gap-1.5">
                                    {ss.sections.map((section: string, sIdx: number) => (
                                      <Badge key={sIdx} variant="outline" className="text-xs">
                                        {section}
                                      </Badge>
                                    ))}
                                  </div>
                                ) : (
                                  <span className="text-gray-500 text-xs">No sections assigned</span>
                                )}
                              </div>
                            ))}
                          </div>
                        )
                      }

                      // Fallback to legacy format (separate subjects and handledSection)
                      const subjectsArray = prof.subjects && prof.subjects.length > 0
                        ? prof.subjects
                        : prof.subject
                          ? [prof.subject]
                          : []

                      if (subjectsArray.length === 0) {
                        return <p className="text-gray-500 text-sm">No subjects assigned</p>
                      }

                      return (
                        <div className="space-y-2">
                          <div className="flex flex-wrap gap-2">
                            {subjectsArray.map((subj: string, idx: number) => (
                              <Badge key={idx} variant="outline" className="text-sm">
                                {subj}
                              </Badge>
                            ))}
                          </div>
                          {prof.handledSection && (
                            <div className="mt-3 pt-3 border-t">
                              <p className="text-xs text-gray-500 mb-1">Handled Sections:</p>
                              <p className="text-sm text-gray-900">{prof.handledSection}</p>
                            </div>
                          )}
                        </div>
                      )
                    })()}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Evaluation Statistics Section - Shows student count by section (anonymous) */}
          {selectedProfessorInfo && (
            <div className="mt-6 pt-4 border-t">
              <div className="flex items-center gap-2 mb-4">
                <Users className="h-5 w-5 text-purple-500" />
                <h3 className="font-semibold text-gray-800">Evaluation Statistics</h3>
              </div>

              {isLoadingStats ? (
                <div className="flex items-center justify-center py-6">
                  <Loader2 className="h-6 w-6 animate-spin text-purple-500" />
                  <span className="ml-2 text-gray-500">Loading statistics...</span>
                </div>
              ) : evaluationStats ? (
                <div className="space-y-4">
                  {/* Total Students Card */}
                  <div className="p-4 bg-purple-50 rounded-lg border border-purple-100">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-purple-700">Total Students Evaluated</p>
                        <p className="text-2xl font-bold text-purple-900">{evaluationStats.totalStudents}</p>
                      </div>
                      <GraduationCap className="h-10 w-10 text-purple-400" />
                    </div>
                  </div>

                  {/* Section Breakdown */}
                  {evaluationStats.sectionBreakdown.length > 0 ? (
                    <div className="space-y-2">
                      <p className="text-sm font-medium text-gray-700">Breakdown by Section:</p>
                      <div className="grid gap-2">
                        {evaluationStats.sectionBreakdown.map((item, idx) => (
                          <div key={idx} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                            <span className="text-sm font-medium text-gray-800">{item.section}</span>
                            <Badge variant="secondary" className="bg-blue-100 text-blue-700">
                              {item.count} student{item.count !== 1 ? 's' : ''}
                            </Badge>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm text-gray-500 italic">No evaluations yet</p>
                  )}

                  <p className="text-xs text-gray-400 mt-3">
                    * Student names are kept anonymous for privacy
                  </p>
                </div>
              ) : (
                <p className="text-sm text-gray-500 italic">Unable to load statistics</p>
              )}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsInfoDialogOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* STEP 37: Edit Professor Dialog - para sa pag-edit ng professor */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="mx-4 max-w-[calc(100vw-2rem)] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Professor</DialogTitle>
            <DialogDescription>Update professor information and department assignment.</DialogDescription>
          </DialogHeader>
          {/* Edit form */}
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="edit-name">Full Name</Label>
              <Input
                id="edit-name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit-email">Email Address</Label>
              <Input
                id="edit-email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit-department">Department</Label>
              <Input
                id="edit-department"
                value={formData.department}
                onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                placeholder="Computer Science"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit-password">Password (Leave blank to keep current)</Label>
              <Input
                id="edit-password"
                type="password"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                placeholder="Enter new password or leave blank"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit-status">Status</Label>
              <Select
                value={formData.status}
                onValueChange={(value: "active" | "inactive" | "resigned" | "retired") => setFormData({ ...formData, status: value })}
              >
                <SelectTrigger id="edit-status" className="w-full">
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                  <SelectItem value="resigned">Resigned</SelectItem>
                  <SelectItem value="retired">Retired</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Subjects & Handled Sections */}
            <div className="grid gap-3 pt-4 border-t mt-2">
              <Label className="text-base font-semibold">Subjects & Handled Sections</Label>

              <div className="space-y-6">
                {editingSubjectSections.map((ss, idx) => (
                  <div key={idx} className="space-y-3 pb-4 border-b last:border-b-0">
                    <div className="flex items-center justify-between">
                      <Label className="text-sm font-medium text-gray-700">Subject {idx + 1}</Label>
                      {editingSubjectSections.length > 1 && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 px-3 text-red-600 hover:text-red-700 hover:bg-red-50"
                          onClick={() => {
                            setEditingSubjectSections(prev => prev.filter((_, i) => i !== idx))
                          }}
                        >
                          <Trash className="h-4 w-4 mr-1" />
                          Remove
                        </Button>
                      )}
                    </div>

                    <div className="grid gap-2">
                      <Label className="text-sm text-gray-600">Subject Name</Label>
                      <Input
                        value={ss.subject}
                        onChange={(e) => {
                          setEditingSubjectSections(prev => prev.map((item, i) =>
                            i === idx ? { ...item, subject: e.target.value } : item
                          ))
                        }}
                        placeholder="e.g., Database Management"
                      />
                    </div>

                    <div className="grid gap-2">
                      <Label className="text-sm text-gray-600">Handled Courses</Label>
                      {/* Display existing courses as removable tags */}
                      {ss.courseText && ss.courseText.trim() && (
                        <div className="flex flex-wrap gap-1.5">
                          {ss.courseText.split(',').map((c: string) => c.trim()).filter((c: string) => c).map((course: string, cIdx: number) => (
                            <Badge key={cIdx} variant="outline" className="text-xs text-indigo-700 border-indigo-300 pr-1 flex items-center gap-1">
                              {course}
                              <button
                                type="button"
                                title="Remove course"
                                className="ml-1 hover:bg-indigo-100 rounded-full p-0.5"
                                onClick={() => {
                                  const courses = ss.courseText.split(',').map((c: string) => c.trim()).filter((c: string) => c)
                                  const updated = courses.filter((_: string, i: number) => i !== cIdx).join(', ')
                                  setEditingSubjectSections(prev => prev.map((item, i) =>
                                    i === idx ? { ...item, courseText: updated } : item
                                  ))
                                }}
                              >
                                <X className="h-3 w-3" />
                              </button>
                            </Badge>
                          ))}
                        </div>
                      )}
                      {/* Input + Add button for new course */}
                      <div className="flex gap-2">
                        <Input
                          value={newCourseInputs[idx] || ''}
                          onChange={(e) => setNewCourseInputs(prev => ({ ...prev, [idx]: e.target.value }))}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && (newCourseInputs[idx] || '').trim()) {
                              e.preventDefault()
                              const newCourse = (newCourseInputs[idx] || '').trim()
                              const existing = ss.courseText ? ss.courseText.split(',').map((c: string) => c.trim()).filter((c: string) => c) : []
                              const updated = [...existing, newCourse].join(', ')
                              setEditingSubjectSections(prev => prev.map((item, i) =>
                                i === idx ? { ...item, courseText: updated } : item
                              ))
                              setNewCourseInputs(prev => ({ ...prev, [idx]: '' }))
                            }
                          }}
                          placeholder="e.g., BS Accounting Information System"
                          className="flex-1"
                        />
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="shrink-0"
                          disabled={!(newCourseInputs[idx] || '').trim()}
                          onClick={() => {
                            const newCourse = (newCourseInputs[idx] || '').trim()
                            if (!newCourse) return
                            const existing = ss.courseText ? ss.courseText.split(',').map((c: string) => c.trim()).filter((c: string) => c) : []
                            const updated = [...existing, newCourse].join(', ')
                            setEditingSubjectSections(prev => prev.map((item, i) =>
                              i === idx ? { ...item, courseText: updated } : item
                            ))
                            setNewCourseInputs(prev => ({ ...prev, [idx]: '' }))
                          }}
                        >
                          <PlusCircle className="h-4 w-4 mr-1" />
                          Add
                        </Button>
                      </div>
                    </div>

                    <div className="grid gap-2">
                      <Label className="text-sm text-gray-600">Handled Sections (comma-separated)</Label>
                      <Input
                        value={ss.sectionsText}
                        onChange={(e) => {
                          setEditingSubjectSections(prev => prev.map((item, i) =>
                            i === idx ? { ...item, sectionsText: e.target.value } : item
                          ))
                        }}
                        placeholder="e.g., 1A, 1B, 2C, 3A"
                      />
                    </div>
                  </div>
                ))}
              </div>

              <Button
                variant="outline"
                className="w-full mt-2"
                onClick={() => {
                  setEditingSubjectSections(prev => [...prev, { subject: '', sectionsText: '', courseText: '' }])
                }}
              >
                <PlusCircle className="h-4 w-4 mr-2" />
                Add Another Subject
              </Button>
            </div>
          </div>
          {/* Dialog footer */}
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleEditProfessor}>Update Professor</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Subjects & Sections Dialog */}
      <Dialog open={isEditSubjectsDialogOpen} onOpenChange={setIsEditSubjectsDialogOpen}>
        <DialogContent className="mx-4 max-w-[calc(100vw-2rem)] max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Subjects & Handled Sections</DialogTitle>
            <DialogDescription>
              Update the subjects and their handled sections for {selectedProfessorInfo?.name}
            </DialogDescription>
          </DialogHeader>

          <div className="py-4 space-y-4">
            {editingSubjectSections.map((ss, idx) => (
              <div key={idx} className="p-4 border rounded-lg bg-gray-50 space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-medium">Subject {idx + 1}</Label>
                  {editingSubjectSections.length > 1 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-red-600 hover:text-red-700 hover:bg-red-50"
                      onClick={() => {
                        setEditingSubjectSections(prev => prev.filter((_, i) => i !== idx))
                      }}
                    >
                      <Trash className="h-3.5 w-3.5 mr-1" />
                      Remove
                    </Button>
                  )}
                </div>

                <Input
                  value={ss.subject}
                  onChange={(e) => {
                    setEditingSubjectSections(prev => prev.map((item, i) =>
                      i === idx ? { ...item, subject: e.target.value } : item
                    ))
                  }}
                  placeholder="Enter subject name (e.g., Database Management)"
                />

                <div>
                  <Label className="text-xs text-gray-500 mb-2 block">
                    Handled Courses
                  </Label>
                  {/* Display existing courses as removable tags */}
                  {ss.courseText && ss.courseText.trim() && (
                    <div className="flex flex-wrap gap-1.5 mb-2">
                      {ss.courseText.split(',').map((c: string) => c.trim()).filter((c: string) => c).map((course: string, cIdx: number) => (
                        <Badge key={cIdx} variant="outline" className="text-xs text-indigo-700 border-indigo-300 pr-1 flex items-center gap-1">
                          {course}
                          <button
                            type="button"
                            title="Remove course"
                            className="ml-1 hover:bg-indigo-100 rounded-full p-0.5"
                            onClick={() => {
                              const courses = ss.courseText.split(',').map((c: string) => c.trim()).filter((c: string) => c)
                              const updated = courses.filter((_: string, i: number) => i !== cIdx).join(', ')
                              setEditingSubjectSections(prev => prev.map((item, i) =>
                                i === idx ? { ...item, courseText: updated } : item
                              ))
                            }}
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </Badge>
                      ))}
                    </div>
                  )}
                  {/* Input + Add button for new course */}
                  <div className="flex gap-2">
                    <Input
                      value={newCourseInputs[idx] || ''}
                      onChange={(e) => setNewCourseInputs(prev => ({ ...prev, [idx]: e.target.value }))}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && (newCourseInputs[idx] || '').trim()) {
                          e.preventDefault()
                          const newCourse = (newCourseInputs[idx] || '').trim()
                          const existing = ss.courseText ? ss.courseText.split(',').map((c: string) => c.trim()).filter((c: string) => c) : []
                          const updated = [...existing, newCourse].join(', ')
                          setEditingSubjectSections(prev => prev.map((item, i) =>
                            i === idx ? { ...item, courseText: updated } : item
                          ))
                          setNewCourseInputs(prev => ({ ...prev, [idx]: '' }))
                        }
                      }}
                      placeholder="e.g., BS Accounting Information System"
                      className="flex-1"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="shrink-0"
                      disabled={!(newCourseInputs[idx] || '').trim()}
                      onClick={() => {
                        const newCourse = (newCourseInputs[idx] || '').trim()
                        if (!newCourse) return
                        const existing = ss.courseText ? ss.courseText.split(',').map((c: string) => c.trim()).filter((c: string) => c) : []
                        const updated = [...existing, newCourse].join(', ')
                        setEditingSubjectSections(prev => prev.map((item, i) =>
                          i === idx ? { ...item, courseText: updated } : item
                        ))
                        setNewCourseInputs(prev => ({ ...prev, [idx]: '' }))
                      }}
                    >
                      <PlusCircle className="h-4 w-4 mr-1" />
                      Add
                    </Button>
                  </div>
                </div>

                <div>
                  <Label className="text-xs text-gray-500 mb-2 block">
                    Sections (comma-separated, e.g., 1A, 1B, 2C)
                  </Label>
                  <Input
                    value={ss.sectionsText}
                    onChange={(e) => {
                      setEditingSubjectSections(prev => prev.map((item, i) =>
                        i === idx ? { ...item, sectionsText: e.target.value } : item
                      ))
                    }}
                    placeholder="1A, 1B, 2C"
                  />
                </div>
              </div>
            ))}

            <Button
              variant="outline"
              className="w-full"
              onClick={() => {
                setEditingSubjectSections(prev => [...prev, { subject: '', sectionsText: '', courseText: '' }])
              }}
            >
              <PlusCircle className="h-4 w-4 mr-2" />
              Add Another Subject
            </Button>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsEditSubjectsDialogOpen(false)}
              disabled={isSavingSubjects}
            >
              Cancel
            </Button>
            <Button
              onClick={async () => {
                if (!selectedProfessorInfo) return

                // Filter out empty subjects and convert sectionsText to sections array
                const validSubjectSections = editingSubjectSections
                  .filter(ss => ss.subject.trim() !== '')
                  .map(ss => ({
                    subject: ss.subject,
                    sections: ss.sectionsText.split(',').map(s => s.trim()).filter(s => s),
                    course: ss.courseText?.trim() || ''
                  }))

                setIsSavingSubjects(true)
                try {
                  await professorService.updateSubjectSections(selectedProfessorInfo.id, validSubjectSections)

                  // Update local state
                  const updatedProfessor = {
                    ...selectedProfessorInfo,
                    subjectSections: validSubjectSections,
                    subjects: validSubjectSections.map(ss => ss.subject),
                  }

                  setProfessors(prev => prev.map(p =>
                    p.id === selectedProfessorInfo.id ? updatedProfessor : p
                  ))
                  setProfessorsState(prev => prev.map(p =>
                    p.id === selectedProfessorInfo.id ? updatedProfessor : p
                  ))
                  setSelectedProfessorInfo(updatedProfessor)

                  toast({
                    title: "Subjects Updated",
                    description: `Successfully updated subjects and sections for ${selectedProfessorInfo.name}`,
                  })

                  setIsEditSubjectsDialogOpen(false)

                  if (onRefresh) {
                    onRefresh()
                  }
                } catch (error) {
                  console.error("Error updating subjects:", error)
                  toast({
                    title: "Update Failed",
                    description: `Failed to update subjects. ${sanitizeErrorMessage(error)}`,
                    variant: "destructive",
                  })
                } finally {
                  setIsSavingSubjects(false)
                }
              }}
              disabled={isSavingSubjects}
            >
              {isSavingSubjects ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                "Save Changes"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {previewData.length > 0 && (
        <>
          {/* Backdrop with blur */}
          <div
            className="fixed inset-0 bg-black/30 backdrop-blur-sm z-40"
            onClick={() => {
              setPreviewData([])
              setPreviewErrors([])
              setProfessorsBySection({})
              setNewProfessors([])
              setDuplicateProfessors([])
              setExcelFile(null)
            }}
          />
          {/* Popup Window */}
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="w-full max-w-[90vw] max-h-[68vh] bg-card border rounded-lg shadow-lg flex flex-col">
              {/* Header */}
              <div className="flex items-center justify-between p-6 border-b flex-shrink-0">
                <div>
                  <h3 className="text-lg font-semibold">Preview Excel Data</h3>
                  <p className="text-sm text-muted-foreground">
                    Review the professor data from Excel before importing. Total: {previewData.length} professors
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex gap-2">
                    <Badge variant="secondary">
                      {previewData.length} total
                    </Badge>
                    <Badge variant="default" className="bg-green-600">
                      {newProfessors.length} new
                    </Badge>
                    {duplicateProfessors.length > 0 && (
                      <Badge variant="outline" className="text-blue-600 border-blue-600">
                        {duplicateProfessors.length} existing
                      </Badge>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0"
                    onClick={() => {
                      setPreviewData([])
                      setPreviewErrors([])
                      setProfessorsBySection({})
                      setNewProfessors([])
                      setDuplicateProfessors([])
                      setExcelFile(null)
                    }}
                    disabled={isImporting}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {/* Loading Overlay with Progress Bar */}
              {isImporting && (
                <div className="absolute inset-0 bg-background/80 backdrop-blur-sm z-10 flex items-center justify-center rounded-lg">
                  <div className="flex flex-col items-center gap-4 w-full max-w-md px-6">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
                    <div className="text-center w-full">
                      <p className="font-semibold text-lg mb-2">Importing Professors...</p>
                      {importProgress.total > 0 ? (
                        <>
                          <div className="flex items-center justify-between text-sm text-muted-foreground mb-2">
                            <span>Processing professors...</span>
                            <span className="font-medium">
                              {importProgress.current} / {importProgress.total}
                            </span>
                          </div>
                          <Progress
                            value={(importProgress.current / importProgress.total) * 100}
                            className="h-2 w-full"
                          />
                          <p className="text-xs text-muted-foreground mt-2">
                            {Math.round((importProgress.current / importProgress.total) * 100)}% complete
                          </p>
                        </>
                      ) : (
                        <p className="text-sm text-muted-foreground">Please wait while we save the data</p>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Content */}
              <div className="flex-1 overflow-y-auto p-6">
                {/* Duplicate Information */}
                {duplicateProfessors.length > 0 && (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
                    <div className="flex items-start gap-2">
                      <div className="w-4 h-4 bg-blue-500 rounded-full flex items-center justify-center mt-0.5">
                        <span className="text-white text-xs font-bold">i</span>
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-medium text-blue-800">
                          {duplicateProfessors.length} professor{duplicateProfessors.length !== 1 ? 's' : ''} already exist
                        </p>
                        <p className="text-xs text-blue-700 mt-1">
                          These professors are already in the database and will be skipped during import. Only new professors will be added.
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                <div className="w-full overflow-x-auto">
                  <div className="min-w-full">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="min-w-[180px]">Name</TableHead>
                          <TableHead className="min-w-[200px]">Department</TableHead>
                          <TableHead className="min-w-[200px]">Subject</TableHead>
                          <TableHead className="min-w-[120px]">Handled Section</TableHead>
                          <TableHead className="min-w-[180px]">Course Handle</TableHead>
                          <TableHead className="min-w-[200px]">Email</TableHead>
                          <TableHead className="min-w-[120px]">Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {previewData.map((professor, index) => {
                          const isNew = newProfessors.some(p => p.email.toLowerCase().trim() === professor.email.toLowerCase().trim())
                          const isDuplicate = duplicateProfessors.some(p => p.email.toLowerCase().trim() === professor.email.toLowerCase().trim())
                          return (
                            <TableRow key={index}>
                              <TableCell className="font-medium">
                                <div className="text-sm">{professor.name}</div>
                              </TableCell>
                              <TableCell>
                                <div className="text-sm">{professor.department}</div>
                              </TableCell>
                              <TableCell>
                                {/* Display subjects as badges */}
                                {professor.subjects && professor.subjects.length > 0 ? (
                                  <div className="flex flex-wrap gap-1">
                                    {professor.subjects.slice(0, 2).map((subj, idx) => (
                                      <Badge key={idx} variant="outline" className="text-xs">
                                        {subj}
                                      </Badge>
                                    ))}
                                    {professor.subjects.length > 2 && (
                                      <Badge variant="secondary" className="text-xs">
                                        +{professor.subjects.length - 2} more
                                      </Badge>
                                    )}
                                  </div>
                                ) : (
                                  <span className="text-muted-foreground text-sm">-</span>
                                )}
                              </TableCell>
                              <TableCell>
                                {/* Display handled sections with subject pairing */}
                                {professor.subjectSections && professor.subjectSections.length > 0 ? (
                                  <div className="flex flex-wrap gap-1">
                                    {professor.subjectSections.slice(0, 2).map((ss, idx) => (
                                      <Badge key={idx} variant="outline" className="text-xs" title={`${ss.subject}: ${ss.sections.join(', ')}`}>
                                        {ss.sections.slice(0, 2).join(', ')}{ss.sections.length > 2 ? '...' : ''}
                                      </Badge>
                                    ))}
                                    {professor.subjectSections.length > 2 && (
                                      <Badge variant="secondary" className="text-xs">
                                        +{professor.subjectSections.length - 2} more
                                      </Badge>
                                    )}
                                  </div>
                                ) : professor.handledSection ? (
                                  <Badge variant="outline">{professor.handledSection}</Badge>
                                ) : (
                                  <span className="text-muted-foreground text-sm">-</span>
                                )}
                              </TableCell>
                              <TableCell>
                                {/* Display course handle */}
                                {professor.subjectSections && professor.subjectSections.length > 0 ? (
                                  <div className="flex flex-wrap gap-1">
                                    {(() => {
                                      // Collect all individual courses from all subjects (split comma-separated)
                                      const allCourses: string[] = []
                                      professor.subjectSections.forEach((ss: any) => {
                                        if (ss.course) {
                                          ss.course.split(',').map((c: string) => c.trim()).filter((c: string) => c).forEach((c: string) => {
                                            if (!allCourses.includes(c)) allCourses.push(c)
                                          })
                                        }
                                      })
                                      if (allCourses.length === 0) {
                                        return <span className="text-muted-foreground text-sm">-</span>
                                      }
                                      return (
                                        <>
                                          {allCourses.slice(0, 2).map((c, idx) => (
                                            <Badge key={idx} variant="outline" className="text-xs text-indigo-700 border-indigo-300">
                                              {c}
                                            </Badge>
                                          ))}
                                          {allCourses.length > 2 && (
                                            <Badge variant="secondary" className="text-xs">
                                              +{allCourses.length - 2} more
                                            </Badge>
                                          )}
                                        </>
                                      )
                                    })()}
                                  </div>
                                ) : (
                                  <span className="text-muted-foreground text-sm">-</span>
                                )}
                              </TableCell>
                              <TableCell>
                                <div className="text-sm">{professor.email}</div>
                              </TableCell>
                              <TableCell>
                                {isNew ? (
                                  <Badge variant="default" className="bg-green-600 text-xs">
                                    New
                                  </Badge>
                                ) : isDuplicate ? (
                                  <Badge variant="outline" className="text-blue-600 border-blue-600 text-xs">
                                    Existing
                                  </Badge>
                                ) : (
                                  <Badge variant="secondary" className="text-xs">
                                    Unknown
                                  </Badge>
                                )}
                              </TableCell>
                            </TableRow>
                          )
                        })}
                      </TableBody>
                    </Table>
                  </div>
                </div>
                {previewErrors.length > 0 && (
                  <div className="mt-4 p-3 bg-yellow-50 dark:bg-yellow-950 rounded-md border border-yellow-200 dark:border-yellow-800">
                    <div className="text-sm font-medium text-yellow-800 dark:text-yellow-200 mb-2">
                      ⚠️ Warnings ({previewErrors.length}):
                    </div>
                    <div className="text-xs text-yellow-600 dark:text-yellow-300 max-h-32 overflow-auto">
                      <ul className="list-disc list-inside space-y-1">
                        {previewErrors.slice(0, 10).map((error, index) => (
                          <li key={index}>{error}</li>
                        ))}
                        {previewErrors.length > 10 && (
                          <li>... and {previewErrors.length - 10} more warnings</li>
                        )}
                      </ul>
                    </div>
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="flex justify-end gap-2 p-6 border-t">
                <Button
                  variant="outline"
                  onClick={() => {
                    setPreviewData([])
                    setPreviewErrors([])
                    setProfessorsBySection({})
                    setNewProfessors([])
                    setDuplicateProfessors([])
                    setExcelFile(null)
                  }}
                  disabled={isImporting}
                >
                  Cancel
                </Button>
                <Button
                  onClick={() => {
                    handleImportExcel()
                  }}
                  disabled={isImporting}
                >
                  {isImporting ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Importing...
                    </>
                  ) : (
                    "Proceed to Import"
                  )}
                </Button>
              </div>
            </div>
          </div>
        </>
      )}


      {/* Toast notifications */}
      <Toaster />
    </div>
  )
}
