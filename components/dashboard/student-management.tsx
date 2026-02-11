"use client"

/*
 * STUDENT MANAGEMENT SYSTEM:
 * 
 * This component is used for managing student accounts:
 * 1. Creating new student accounts
 * 2. Viewing student list
 * 3. Editing student information
 * 4. Deleting student accounts
 * 5. Managing student access to evaluations
 * 
 * IMPORTANT FEATURES:
 * - Real-time updates when students are added/edited/deleted
 * - Form validation for student data
 * - Integration with Firebase database (users collection)
 * - Error handling and success messages
 */

import { useState, useEffect, useMemo, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
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
} from "@/components/ui/alert-dialog"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Plus, Edit, Trash2, Users, UserPlus, Search, X, Upload, FileSpreadsheet, Eye, Trash, PlusCircle, ChevronLeft, ChevronRight, ClipboardList, CheckCircle2, Clock } from "lucide-react"
import { studentService, professorService } from "@/lib/database"
import { useToast } from "@/hooks/use-toast"
import { Toaster } from "@/components/ui/toaster"
import { sanitizeErrorMessage } from "@/lib/utils"
import React from "react"
import { parseExcelStudents, type ParsedStudent } from "@/lib/excel-parser"
import { evaluationResultsService } from "@/lib/evaluation-results-service"
import type { EvaluationResult } from "@/lib/types"


interface Student {
  id: string
  firstName: string
  lastName: string
  suffix: string
  studentId: string
  email: string
  yearLevel: string
  course: string
  section: string
  subject?: string // Legacy single subject field
  subjects?: string[] // Array of enrolled subjects (supports multiple subjects)
  status?: string
  accountStatus?: string
  role: string
  createdAt: Date
  updatedAt: Date
}

// Professor interface for evaluation progress tracking
interface Professor {
  id: string
  name: string
  email: string
  departmentName: string
  status?: "active" | "inactive" | "resigned"
  subjectSections?: Array<{ subject: string; sections: string[] }>
}

// Evaluation progress item for popup display
interface EvaluationProgressItem {
  subject: string
  professorId: string
  professorName: string
  isComplete: boolean
}

interface StudentManagementProps {
  onRefresh?: () => void
}


export function StudentManagement({ onRefresh }: StudentManagementProps) {
  // STATES FOR STUDENT MANAGEMENT:

  // List of students - main data displayed in table
  const [students, setStudents] = useState<Student[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const unsubscribeRef = useRef<(() => void) | null>(null)
  const isListenerActiveRef = useRef<boolean>(false)
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedSection, setSelectedSection] = useState<string>("all")
  const [selectedCourse, setSelectedCourse] = useState<string>("all")
  const [selectedYearLevel, setSelectedYearLevel] = useState<string>("all")
  const [selectedAccountStatus, setSelectedAccountStatus] = useState<string>("all")
  const [currentPage, setCurrentPage] = useState(1)
  const studentsPerPage = 10

  const filteredStudents = useMemo(() => {
    let filtered = students

    // Filter by section
    if (selectedSection !== "all") {
      filtered = filtered.filter((s) => s.section === selectedSection)
    }

    // Filter by course
    if (selectedCourse !== "all") {
      filtered = filtered.filter((s) => s.course === selectedCourse)
    }

    // Filter by year level
    if (selectedYearLevel !== "all") {
      filtered = filtered.filter((s) => s.yearLevel === selectedYearLevel)
    }

    // Filter by account status
    if (selectedAccountStatus !== "all") {
      filtered = filtered.filter((s) => (s.accountStatus || "active") === selectedAccountStatus)
    }

    // Filter by search term
    const term = searchTerm.trim().toLowerCase()
    if (term) {
      filtered = filtered.filter((s) => {
        const fullName = `${s.firstName ?? ""} ${s.lastName ?? ""} ${s.suffix ?? ""}`.toLowerCase()
        return (
          fullName.includes(term) ||
          (s.studentId ?? "").toLowerCase().includes(term) ||
          (s.email ?? "").toLowerCase().includes(term) ||
          (s.yearLevel ?? "").toLowerCase().includes(term) ||
          (s.course ?? "").toLowerCase().includes(term) ||
          (s.section ?? "").toLowerCase().includes(term) ||
          // Search in subjects array (join to string for search)
          (s.subjects ?? []).join(' ').toLowerCase().includes(term) ||
          (s.subject ?? "").toLowerCase().includes(term) || // Legacy single subject field
          (s.status ?? "").toLowerCase().includes(term) ||
          (s.accountStatus ?? "").toLowerCase().includes(term) ||
          (s.role ?? "").toLowerCase().includes(term)
        )
      })
    }

    return filtered
  }, [students, searchTerm, selectedSection, selectedCourse, selectedYearLevel, selectedAccountStatus])

  // Pagination calculations
  const totalPages = Math.ceil(filteredStudents.length / studentsPerPage)
  const paginatedStudents = useMemo(() => {
    const startIndex = (currentPage - 1) * studentsPerPage
    const endIndex = startIndex + studentsPerPage
    return filteredStudents.slice(startIndex, endIndex)
  }, [filteredStudents, currentPage, studentsPerPage])

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1)
  }, [searchTerm, selectedSection, selectedCourse, selectedYearLevel, selectedAccountStatus])

  // Get unique sections and year levels for filters
  const uniqueSections = useMemo(() => {
    const sections = new Set(students.map(s => s.section).filter(Boolean))
    return Array.from(sections).sort()
  }, [students])

  const uniqueCourses = useMemo(() => {
    const courses = new Set(students.map(s => s.course).filter(Boolean))
    return Array.from(courses).sort()
  }, [students])

  const uniqueYearLevels = useMemo(() => {
    const yearLevels = new Set(students.map(s => s.yearLevel).filter(Boolean))
    return Array.from(yearLevels).sort()
  }, [students])

  // States for add/edit dialogs
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [editingStudent, setEditingStudent] = useState<Student | null>(null)
  const [excelFile, setExcelFile] = useState<File | null>(null)
  const [isImporting, setIsImporting] = useState(false)
  const [isReading, setIsReading] = useState(false)
  const [previewData, setPreviewData] = useState<ParsedStudent[]>([])
  const [previewErrors, setPreviewErrors] = useState<string[]>([])
  const [newStudents, setNewStudents] = useState<ParsedStudent[]>([]) // New students (non-duplicates)
  const [duplicateStudents, setDuplicateStudents] = useState<ParsedStudent[]>([]) // Duplicate students
  const [editingSubjects, setEditingSubjects] = useState<string[]>(['']) // For dynamic subject editing

  // States for evaluation progress tracking (real-time)
  const [professors, setProfessors] = useState<Professor[]>([])
  const [evaluationResults, setEvaluationResults] = useState<EvaluationResult[]>([])
  const [isEvalProgressDialogOpen, setIsEvalProgressDialogOpen] = useState(false)
  const [selectedStudentForProgress, setSelectedStudentForProgress] = useState<Student | null>(null)
  const evalResultsUnsubscribeRef = useRef<(() => void) | null>(null)
  const professorsUnsubscribeRef = useRef<(() => void) | null>(null)


  // Toast for notifications
  const { toast } = useToast()

  // Form data for student creation/editing
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    suffix: "",
    studentId: "",
    email: "",
    password: "",
    yearLevel: "",
    course: "",
    section: "",
    subject: "",
    status: "",
    accountStatus: "",
  })

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

  // Set up real-time listener on component mount
  useEffect(() => {
    // Prevent duplicate listener creation
    if (isListenerActiveRef.current) {
      console.log("⚠️ Listener already active, skipping setup")
      return
    }

    console.log("🔄 Setting up real-time student listener...")
    setIsLoading(true)
    isListenerActiveRef.current = true

    let isMounted = true
    let unsubscribeFn: (() => void) | null = null
    let setupTimeout: NodeJS.Timeout | null = null

    // Cleanup any existing listener first (from ref)
    if (unsubscribeRef.current) {
      try {
        console.log("🧹 Cleaning up existing listener before setup...")
        unsubscribeRef.current()
      } catch (error: any) {
        // Suppress Firestore internal errors during cleanup
        const errorMessage = error?.message || String(error)
        if (!errorMessage.includes('FIRESTORE') || !errorMessage.includes('INTERNAL ASSERTION FAILED')) {
          console.error("Error cleaning up existing listener:", error)
        }
      }
      unsubscribeRef.current = null
    }

    // Wait a bit to ensure previous listener is fully cleaned up
    setupTimeout = setTimeout(() => {
      if (!isMounted || !isListenerActiveRef.current) return

      try {
        unsubscribeFn = studentService.onStudentsChange((studentsData) => {
          // Double check if still mounted and active
          if (!isMounted || !isListenerActiveRef.current) return

          try {
            console.log("📡 Real-time update received:", studentsData.length, "students")
            setStudents(studentsData)
            setIsLoading(false)

            if (studentsData.length === 0 && isMounted) {
              toast({
                title: "No Students Found",
                description: "No students found in the database. Create your first student account.",
                variant: "default",
              })
            }
          } catch (callbackError: any) {
            // Suppress Firestore internal errors in callback
            const errorMessage = callbackError?.message || String(callbackError)
            if (errorMessage.includes('FIRESTORE') && errorMessage.includes('INTERNAL ASSERTION FAILED')) {
              console.warn("Firestore internal error suppressed in callback")
              return
            }
            console.error("Error in student listener callback:", callbackError)
          }
        })

        // Store unsubscribe function in ref
        unsubscribeRef.current = unsubscribeFn
      } catch (error: any) {
        // Suppress Firestore internal errors during setup
        const errorMessage = error?.message || String(error)
        if (errorMessage.includes('FIRESTORE') && errorMessage.includes('INTERNAL ASSERTION FAILED')) {
          console.warn("Firestore internal error suppressed during setup")
          setIsLoading(false)
          isListenerActiveRef.current = false
          return
        }

        console.error("Error setting up student listener:", error)
        setIsLoading(false)
        isListenerActiveRef.current = false
        if (isMounted) {
          toast({
            title: "Connection Error",
            description: "Failed to connect to database. Please refresh the page.",
            variant: "destructive",
          })
        }
      }
    }, 150) // Increased delay to ensure proper cleanup

    // Cleanup on unmount
    return () => {
      console.log("🧹 Cleaning up real-time listener...")
      isMounted = false
      isListenerActiveRef.current = false

      // Clear timeout if still pending
      if (setupTimeout) {
        clearTimeout(setupTimeout)
        setupTimeout = null
      }

      // Cleanup listener from ref
      if (unsubscribeRef.current) {
        try {
          unsubscribeRef.current()
        } catch (error: any) {
          // Suppress Firestore internal errors during cleanup
          const errorMessage = error?.message || String(error)
          if (!errorMessage.includes('FIRESTORE') || !errorMessage.includes('INTERNAL ASSERTION FAILED')) {
            console.error("Error during listener cleanup:", error)
          }
        }
        unsubscribeRef.current = null
      }

      // Also cleanup the function we created
      if (unsubscribeFn) {
        try {
          unsubscribeFn()
        } catch (error: any) {
          // Suppress Firestore internal errors during cleanup
          const errorMessage = error?.message || String(error)
          if (!errorMessage.includes('FIRESTORE') || !errorMessage.includes('INTERNAL ASSERTION FAILED')) {
            console.error("Error during unsubscribeFn cleanup:", error)
          }
        }
        unsubscribeFn = null
      }
    }
  }, [])

  // Real-time listeners for professors and evaluation results (for Eval Progress feature)
  useEffect(() => {
    // Set up professors listener
    const profUnsubscribe = professorService.onProfessorsChange((profsData) => {
      setProfessors(profsData as Professor[])
    })
    professorsUnsubscribeRef.current = profUnsubscribe

    // Set up evaluation results listener
    const evalUnsubscribe = evaluationResultsService.onEvaluationResultsChange((results) => {
      setEvaluationResults(results)
    })
    evalResultsUnsubscribeRef.current = evalUnsubscribe

    return () => {
      if (professorsUnsubscribeRef.current) {
        professorsUnsubscribeRef.current()
        professorsUnsubscribeRef.current = null
      }
      if (evalResultsUnsubscribeRef.current) {
        evalResultsUnsubscribeRef.current()
        evalResultsUnsubscribeRef.current = null
      }
    }
  }, [])

  // Helper function to calculate evaluation progress for a student
  const getEvaluationProgressForStudent = useMemo(() => {
    return (student: Student): EvaluationProgressItem[] => {
      const progressItems: EvaluationProgressItem[] = []

      // Get student's enrolled subjects
      const studentSubjects = student.subjects && student.subjects.length > 0
        ? student.subjects
        : student.subject
          ? [student.subject]
          : []

      if (studentSubjects.length === 0) return progressItems

      const studentSection = student.section

      // Find professors who teach student's enrolled subjects AND handle student's section
      professors.forEach((prof) => {
        if (prof.status === 'resigned' || prof.status === 'inactive') return

        const profSubjectSections = prof.subjectSections || []

        profSubjectSections.forEach((ss) => {
          // Check if professor teaches a subject the student is enrolled in
          const subjectMatch = studentSubjects.some(
            (s) => s.toLowerCase().trim() === ss.subject.toLowerCase().trim()
          )

          // Check if professor handles the student's section for this subject
          const sectionMatch = ss.sections.some(
            (sec) => sec.toLowerCase().trim() === studentSection?.toLowerCase().trim()
          )

          if (subjectMatch && sectionMatch) {
            // Check if this student has already evaluated this professor
            const hasEvaluated = evaluationResults.some((er) => {
              const emailMatch = er.studentEmail?.toLowerCase() === student.email?.toLowerCase()
              const profMatch = er.professorId === prof.id
              const isComplete = er.isComplete || er.evaluationStatus === 'submitted'
              return emailMatch && profMatch && isComplete
            })

            progressItems.push({
              subject: ss.subject,
              professorId: prof.id,
              professorName: prof.name,
              isComplete: hasEvaluated
            })
          }
        })
      })

      return progressItems
    }
  }, [professors, evaluationResults])

  // FUNCTION PARA SA PAG-IMPORT NG STUDENTS MULA SA EXCEL

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
    }
  }

  // FUNCTION PARA BUMASA NG EXCEL AT IPAKITA ANG DATA
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
    setNewStudents([])
    setDuplicateStudents([])

    try {
      // Parse Excel file
      const parseResult = await parseExcelStudents(excelFile)

      if (parseResult.students.length === 0) {
        toast({
          title: "No Students Found",
          description: "The Excel file does not contain valid student data. Please check the file format.",
          variant: "destructive",
        })
        setIsReading(false)
        return
      }

      // Check for duplicates by comparing emails and studentIds with existing students
      const existingEmails = new Set<string>(
        students.map(s => s.email.toLowerCase().trim())
      )
      const existingStudentIds = new Set<string>(
        students.map(s => s.studentId.toLowerCase().trim())
      )

      const newStudentsList: ParsedStudent[] = []
      const duplicateStudentsList: ParsedStudent[] = []

      parseResult.students.forEach(student => {
        const emailLower = student.email.toLowerCase().trim()
        const studentId = student.email.split('@')[0] || ''
        const studentIdLower = studentId.toLowerCase().trim()

        // Check if email or studentId already exists
        if (existingEmails.has(emailLower) || existingStudentIds.has(studentIdLower)) {
          duplicateStudentsList.push(student)
        } else {
          newStudentsList.push(student)
          // Add to sets to prevent duplicates within the same Excel file
          existingEmails.add(emailLower)
          if (studentIdLower) {
            existingStudentIds.add(studentIdLower)
          }
        }
      })

      // Set preview data
      setPreviewData(parseResult.students)
      setPreviewErrors(parseResult.errors)
      setNewStudents(newStudentsList)
      setDuplicateStudents(duplicateStudentsList)

      // Close import dialog and show preview popup
      setIsImportDialogOpen(false)

      const message = duplicateStudentsList.length > 0
        ? `Found ${parseResult.students.length} students. ${newStudentsList.length} will be imported, ${duplicateStudentsList.length} already exist and will be skipped.`
        : `Found ${parseResult.students.length} students. All are new and will be imported.`

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
      // Use new students from preview (duplicates already filtered out)
      let studentsToImport: Array<{
        firstName: string
        lastName: string
        suffix: string
        studentId: string
        email: string
        password: string
        yearLevel: string
        course: string
        section: string
        subjects?: string[] // Array of enrolled subjects
        status?: string
      }> = []

      if (newStudents.length > 0) {
        // Use already filtered new students from preview
        studentsToImport = newStudents.map(student => ({
          firstName: student.firstName,
          lastName: student.lastName,
          suffix: student.suffix,
          studentId: student.email.split('@')[0] || `STU-${student.rowIndex || Math.random()}`,
          email: student.email,
          password: student.password,
          yearLevel: student.yearLevel,
          course: student.enrolledCourse,
          section: student.section,
          subjects: student.enrolledSubjects, // Use subjects array (supports multiple subjects)
          status: student.status,
          accountStatus: "active", // Default new students to active
        }))
      } else if (previewData.length > 0) {
        // Fallback: check for duplicates if newStudents is empty but previewData exists
        const existingEmails = new Set<string>(
          students.map(s => s.email.toLowerCase().trim())
        )
        const existingStudentIds = new Set<string>(
          students.map(s => s.studentId.toLowerCase().trim())
        )
        const filtered = previewData.filter(s => {
          const emailLower = s.email.toLowerCase().trim()
          const studentId = s.email.split('@')[0] || ''
          const studentIdLower = studentId.toLowerCase().trim()
          return !existingEmails.has(emailLower) && !existingStudentIds.has(studentIdLower)
        })
        studentsToImport = filtered.map(student => ({
          firstName: student.firstName,
          lastName: student.lastName,
          suffix: student.suffix,
          studentId: student.email.split('@')[0] || `STU-${student.rowIndex || Math.random()}`,
          email: student.email,
          password: student.password,
          yearLevel: student.yearLevel,
          course: student.enrolledCourse,
          section: student.section,
          subjects: student.enrolledSubjects, // Use subjects array (supports multiple subjects)
          status: student.status,
        }))
      } else {
        // Parse Excel file if no preview data
        const parseResult = await parseExcelStudents(excelFile)

        if (parseResult.students.length === 0) {
          toast({
            title: "No Students Found",
            description: "The Excel file does not contain valid student data. Please check the file format.",
            variant: "destructive",
          })
          setIsImporting(false)
          return
        }

        // Check for duplicates
        const existingEmails = new Set<string>(
          students.map(s => s.email.toLowerCase().trim())
        )
        const existingStudentIds = new Set<string>(
          students.map(s => s.studentId.toLowerCase().trim())
        )
        const filtered = parseResult.students.filter(s => {
          const emailLower = s.email.toLowerCase().trim()
          const studentId = s.email.split('@')[0] || ''
          const studentIdLower = studentId.toLowerCase().trim()
          return !existingEmails.has(emailLower) && !existingStudentIds.has(studentIdLower)
        })

        studentsToImport = filtered.map(student => ({
          firstName: student.firstName,
          lastName: student.lastName,
          suffix: student.suffix,
          studentId: student.email.split('@')[0] || `STU-${student.rowIndex || Math.random()}`,
          email: student.email,
          password: student.password,
          yearLevel: student.yearLevel,
          course: student.enrolledCourse,
          section: student.section,
          subjects: student.enrolledSubjects, // Use subjects array (supports multiple subjects)
          status: student.status,
          accountStatus: "active", // Default new students to active
        }))
      }

      // Check if there are students to import
      if (studentsToImport.length === 0) {
        toast({
          title: "No Students to Import",
          description: "All students in the Excel file already exist in the database.",
          variant: "default",
        })
        setIsImporting(false)
        return
      }

      // Import only new students (duplicates already filtered)
      const importResult = await studentService.importStudents(studentsToImport)

      // Close preview popup immediately to show updated data
      setPreviewData([])
      setPreviewErrors([])
      setNewStudents([])
      setDuplicateStudents([])
      setExcelFile(null)

      // Check if import was successful
      if (importResult.success === 0 && importResult.skipped > 0) {
        toast({
          title: "No New Students Added",
          description: `All ${importResult.skipped} students already exist in the database.`,
          variant: "default",
        })
      } else if (importResult.success > 0) {
        // Show success message with summary
        const message = `Import completed! ${importResult.success} student${importResult.success !== 1 ? "s" : ""} added${importResult.skipped > 0 ? `, ${importResult.skipped} skipped (duplicates)` : ""}.`
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

      // Real-time listener will automatically update the table
    } catch (error) {
      console.error("Error importing students:", error)
      toast({
        title: "Import Failed",
        description: `Failed to import students. ${sanitizeErrorMessage(error)}`,
        variant: "destructive",
      })
    } finally {
      setIsImporting(false)
    }
  }

  // FUNCTION PARA SA PAG-EDIT NG STUDENT
  const handleEditStudent = async () => {
    // Validation: Checking kung kumpleto ang datos
    if (!editingStudent || !formData.firstName || !formData.lastName || !formData.email || !formData.yearLevel) {
      toast({
        title: "Validation Error",
        description: "Please fill in all required fields",
        variant: "destructive",
      })
      return
    }

    // Password validation (only if password is provided)
    if (formData.password && formData.password.length < 6) {
      toast({
        title: "Password Error",
        description: "Password must be at least 6 characters long",
        variant: "destructive",
      })
      return
    }

    try {
      // I-update muna ang datos sa Firebase database
      // Use editingSubjects array directly
      const validSubjects = editingSubjects.filter(s => s.trim() !== '')

      await studentService.update(
        editingStudent.id,
        formData.firstName,
        formData.lastName,
        formData.suffix,
        formData.studentId,
        formData.email,
        formData.yearLevel,
        formData.course,
        formData.section,
        formData.password || undefined,
        validSubjects.length > 0 ? validSubjects.join(', ') : undefined, // Pass as comma-separated string for database
        formData.status || undefined,
        formData.accountStatus || undefined
      )

      // Clear form and close dialog
      setIsEditDialogOpen(false)
      setEditingStudent(null)
      setEditingSubjects(['']) // Reset editing subjects
      setFormData({ firstName: "", lastName: "", suffix: "", studentId: "", email: "", password: "", yearLevel: "", course: "", section: "", subject: "", status: "", accountStatus: "" })

      // Show success message
      toast({
        title: "Success!",
        description: "Student updated successfully!",
        variant: "default",
      })
    } catch (error) {
      console.error("Error updating student:", error)

      let errorTitle = "Failed to update student"
      let errorDescription = "Please try again or contact support."

      if ((error as any)?.message?.includes("Student ID already exists")) {
        errorTitle = "Duplicate Student ID"
        errorDescription = "A student with this ID already exists."
      } else if ((error as any)?.message?.includes("Email already exists")) {
        errorTitle = "Duplicate Email"
        errorDescription = "A student with this email already exists."
      } else if ((error as any)?.code === "permission-denied") {
        errorTitle = "Permission Denied"
        errorDescription = "Please check your authentication status."
      } else if ((error as any)?.code === "unavailable") {
        errorTitle = "Database Unavailable"
        errorDescription = "Please check your internet connection."
      } else {
        errorDescription = sanitizeErrorMessage(error)
      }

      toast({
        title: errorTitle,
        description: errorDescription,
        variant: "destructive",
      })
    }
  }

  // FUNCTION PARA SA PAGTANGGAL NG STUDENT
  const handleDeleteStudent = async (studentId: string) => {
    try {
      // Find student name for better feedback
      const student = students.find(s => s.id === studentId)
      const studentName = student ? `${student.firstName} ${student.lastName}` : "Unknown"

      // Show loading state
      console.log(`Starting deletion for student: ${studentName}`)

      // Delete student from database
      await studentService.delete(studentId)

      // Success message
      toast({
        title: "Student Deleted",
        description: `Student "${studentName}" has been permanently deleted.`,
        variant: "default",
      })

      // Real-time listener will automatically update the table
    } catch (error) {
      console.error("Error deleting student:", error)
      toast({
        title: "Delete Failed",
        description: `Failed to delete student. ${sanitizeErrorMessage(error)}`,
        variant: "destructive",
      })
    }
  }

  // FUNCTION PARA BUKSAN ANG EDIT DIALOG
  const openEditDialog = (student: Student) => {
    // I-save ang kasalukuyang datos ng student na ie-edit
    setEditingStudent(student)

    // Initialize editingSubjects array from student data
    let subjectsArray: string[] = []
    if (student.subjects && student.subjects.length > 0) {
      subjectsArray = [...student.subjects]
    } else if (student.subject) {
      // Parse legacy comma-separated subject field
      subjectsArray = student.subject.split(',').map(s => s.trim()).filter(s => s)
    }
    // Ensure at least one empty field if no subjects
    if (subjectsArray.length === 0) {
      subjectsArray = ['']
    }
    setEditingSubjects(subjectsArray)

    setFormData({
      firstName: student.firstName,
      lastName: student.lastName,
      suffix: student.suffix,
      studentId: "", // Start with empty Student ID for manual entry
      email: student.email,
      yearLevel: student.yearLevel,
      course: student.course,
      section: student.section,
      subject: '', // No longer used directly, use editingSubjects instead
      status: student.status || "Regular",
      accountStatus: student.accountStatus || "active",
      password: "", // Don't show current password for security
    })

    // Buksan ang edit dialog
    setIsEditDialogOpen(true)
  }

  // Reset form when dialog is closed
  useEffect(() => {
    if (!isEditDialogOpen) {
      setFormData({
        firstName: "",
        lastName: "",
        suffix: "",
        studentId: "",
        email: "",
        password: "",
        yearLevel: "",
        course: "",
        section: "",
        subject: "",
        status: "",
        accountStatus: "",
      })
      setEditingStudent(null)
    }
  }, [isEditDialogOpen])

  const resetForm = () => {
    setFormData({ firstName: "", lastName: "", suffix: "", studentId: "", email: "", password: "", yearLevel: "", course: "", section: "", subject: "", status: "", accountStatus: "" })
    setEditingStudent(null)
  }

  // Test function to create a sample student
  const createTestStudent = async () => {
    try {
      const testStudent = await studentService.create(
        "John",
        "Doe",
        "",
        "2024-001",
        "john.doe@student.lcc.edu",
        "password123",
        "1st Year",
        "Bachelor of Science in Computer Science",
        "A"
      )

      toast({
        title: "Test Student Created",
        description: "Sample student account created successfully!",
        variant: "default",
      })

      // Real-time listener will automatically update the table
    } catch (error) {
      console.error("Error creating test student:", error)
      toast({
        title: "Test Student Failed",
        description: "Failed to create test student. Check console for details.",
        variant: "destructive",
      })
    }
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4">
        <div>
          <h2 className="text-lg md:text-2xl lg:text-3xl font-bold text-foreground">Student Management</h2>
          <p className="text-xs sm:text-sm md:text-base text-muted-foreground">Manage student accounts and access to evaluations</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
          <Dialog open={isImportDialogOpen} onOpenChange={setIsImportDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={() => {
                setExcelFile(null)
                setPreviewData([])
                setPreviewErrors([])
              }} className="w-full sm:w-auto text-sm">
                <Upload className="mr-2 h-3.5 w-3.5 sm:h-4 sm:w-4" />
                Import Excel
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
              <DialogHeader>
                <DialogTitle>Import Students from Excel</DialogTitle>
                <DialogDescription>
                  Upload an Excel file with student data. The file should contain columns: NAME, SECTION, YEAR, ENROLLED COURSE, ENROLLED SUBJECT, GMAIL, PASSWORD, REGULAR OR IRREGULAR
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
                {previewData.length > 0 && (
                  <div className="p-3 bg-green-50 dark:bg-green-950 rounded-md border border-green-200 dark:border-green-800">
                    <div className="text-sm font-medium text-green-800 dark:text-green-200">
                      ✓ Excel file read successfully
                    </div>
                    <div className="text-xs text-green-600 dark:text-green-300 mt-1">
                      Found {previewData.length} students. Click "Import Students" to save to database.
                    </div>
                  </div>
                )}
                <div className="text-sm text-muted-foreground space-y-1">
                  <p className="font-medium">Excel Format Requirements:</p>
                  <ul className="list-disc list-inside space-y-1 ml-2">
                    <li>First row should contain headers: NAME, SECTION, YEAR, ENROLLED COURSE, ENROLLED SUBJECT, GMAIL, PASSWORD, REGULAR OR IRREGULAR</li>
                    <li>Each subsequent row represents one student</li>
                    <li>Duplicate emails will be automatically skipped</li>
                    <li>Student ID will be generated from email if not provided</li>
                  </ul>
                </div>
              </div>
              <DialogFooter className="mt-4 flex-shrink-0">
                <Button
                  variant="outline"
                  onClick={() => {
                    setIsImportDialogOpen(false)
                    setExcelFile(null)
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
                      Import Students
                    </>
                  )}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Preview Excel Data - Window Popup */}
      {previewData.length > 0 && (
        <>
          {/* Backdrop with blur */}
          <div
            className="fixed inset-0 bg-black/30 backdrop-blur-sm z-40"
            onClick={() => {
              setPreviewData([])
              setPreviewErrors([])
              setNewStudents([])
              setDuplicateStudents([])
              setExcelFile(null)
            }}
          />
          {/* Popup Window */}
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="w-full max-w-[75vw] max-h-[60vh] bg-card border rounded-lg shadow-lg flex flex-col">
              {/* Header */}
              <div className="flex items-center justify-between p-6 border-b flex-shrink-0">
                <div>
                  <h3 className="text-lg font-semibold">Preview Excel Data</h3>
                  <p className="text-sm text-muted-foreground">
                    Review the student data from Excel before importing. Total: {previewData.length} students
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex gap-2">
                    <Badge variant="secondary">
                      {previewData.length} total
                    </Badge>
                    <Badge variant="default" className="bg-green-600">
                      {newStudents.length} new
                    </Badge>
                    {duplicateStudents.length > 0 && (
                      <Badge variant="outline" className="text-blue-600 border-blue-600">
                        {duplicateStudents.length} existing
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
                      setNewStudents([])
                      setDuplicateStudents([])
                      setExcelFile(null)
                    }}
                    disabled={isImporting}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {/* Content */}
              <div className="flex-1 overflow-y-auto p-6">
                {/* Duplicate Information */}
                {duplicateStudents.length > 0 && (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
                    <div className="flex items-start gap-2">
                      <div className="w-4 h-4 bg-blue-500 rounded-full flex items-center justify-center mt-0.5">
                        <span className="text-white text-xs font-bold">i</span>
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-medium text-blue-800">
                          {duplicateStudents.length} student{duplicateStudents.length !== 1 ? 's' : ''} already exist
                        </p>
                        <p className="text-xs text-blue-700 mt-1">
                          These students are already in the database and will be skipped during import. Only new students will be added.
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                <div className="w-full overflow-x-auto">
                  <div className="min-w-full">
                    <Table className="w-full">
                      <TableHeader>
                        <TableRow>
                          <TableHead className="min-w-[160px]">Name</TableHead>
                          <TableHead className="min-w-[70px]">Section</TableHead>
                          <TableHead className="min-w-[100px]">Year Level</TableHead>
                          <TableHead className="min-w-[220px]">Enrolled Course</TableHead>
                          <TableHead className="min-w-[200px]">Enrolled Subject</TableHead>
                          <TableHead className="min-w-[200px]">Email</TableHead>
                          <TableHead className="min-w-[90px]">Status</TableHead>
                          <TableHead className="min-w-[120px]">Import Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {previewData.map((student, index) => {
                          const isNew = newStudents.some(s =>
                            s.email.toLowerCase().trim() === student.email.toLowerCase().trim() ||
                            s.email.split('@')[0] === student.email.split('@')[0]
                          )
                          const isDuplicate = duplicateStudents.some(s =>
                            s.email.toLowerCase().trim() === student.email.toLowerCase().trim() ||
                            s.email.split('@')[0] === student.email.split('@')[0]
                          )
                          return (
                            <TableRow key={index}>
                              <TableCell className="font-medium">
                                <div className="text-sm" title={`${student.firstName} ${student.lastName} ${student.suffix}`}>
                                  {student.firstName} {student.lastName} {student.suffix}
                                </div>
                              </TableCell>
                              <TableCell>
                                <Badge variant="outline" className="text-xs">{student.section}</Badge>
                              </TableCell>
                              <TableCell>
                                <Badge variant="outline" className="text-xs">{student.yearLevel}</Badge>
                              </TableCell>
                              <TableCell>
                                <div className="text-sm" title={student.enrolledCourse}>
                                  {student.enrolledCourse}
                                </div>
                              </TableCell>
                              <TableCell>
                                <div className="text-sm" title={student.enrolledSubjects.join(', ')}>
                                  {student.enrolledSubjects.length > 0 ? (
                                    <div className="flex flex-wrap gap-1">
                                      {student.enrolledSubjects.map((subject, idx) => (
                                        <Badge key={idx} variant="outline" className="text-xs">
                                          {subject}
                                        </Badge>
                                      ))}
                                    </div>
                                  ) : (
                                    <span className="text-muted-foreground">-</span>
                                  )}
                                </div>
                              </TableCell>
                              <TableCell>
                                <div className="text-sm" title={student.email}>
                                  {student.email}
                                </div>
                              </TableCell>
                              <TableCell>
                                <Badge
                                  variant={student.status === 'Regular' ? 'default' : student.status === 'Graduated' ? 'outline' : 'destructive'}
                                  className={
                                    student.status === 'Irregular' ? 'bg-red-500 text-white hover:bg-red-600' :
                                      student.status === 'Graduated' ? 'bg-yellow-400 text-yellow-900 hover:bg-yellow-500 border-yellow-500' :
                                        student.status === 'Drop' ? 'bg-gray-500 text-white hover:bg-gray-600' : ''
                                  }
                                >
                                  {student.status}
                                </Badge>
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
                    setExcelFile(null)
                  }}
                >
                  Cancel
                </Button>
                <Button
                  onClick={() => {
                    handleImportExcel()
                  }}
                >
                  Proceed to Import
                </Button>
              </div>
            </div>
          </div>
        </>
      )}

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between pb-2 border-b border-border mb-4">
              <div className="flex items-center gap-2">
                <div className="text-sm font-medium">Total Students</div>
                <Users className="h-4 w-4 text-muted-foreground" />
              </div>
            </div>
            <div className="text-2xl font-bold">{students.length}</div>
            <p className="text-xs text-muted-foreground">Registered student accounts</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between pb-2 border-b border-border mb-4">
              <div className="flex items-center gap-2">
                <div className="text-sm font-medium">Active Students</div>
                <Users className="h-4 w-4 text-green-600" />
              </div>
            </div>
            <div className="text-2xl font-bold text-green-600">
              {students.filter(s => (s.accountStatus || "active") === "active").length}
            </div>
            <p className="text-xs text-muted-foreground">Can access evaluations</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between pb-2 border-b border-border mb-4">
              <div className="flex items-center gap-2">
                <div className="text-sm font-medium">Inactive Students</div>
                <Users className="h-4 w-4 text-primary" />
              </div>
            </div>
            <div className="text-2xl font-bold text-primary">
              {students.filter(s => s.accountStatus === "inactive").length}
            </div>
            <p className="text-xs text-muted-foreground">Access suspended</p>
          </CardContent>
        </Card>
      </div>

      <Card className="w-full">
        <div className="pt-1 w-full p-6">
          <div className="pb-4 border-b border-border mb-6">
            <div className="flex items-center justify-between gap-4 mb-4">
              <div>
                <div className="text-lg font-medium">Students ({filteredStudents.length})</div>
                <p className="text-sm text-muted-foreground">Manage student accounts and evaluation access</p>
              </div>
            </div>
            <div className="flex flex-wrap items-end gap-4 overflow-x-auto">
              <div className="flex-1 min-w-[200px]">
                <label className="text-xs font-medium text-muted-foreground px-2 mb-1 block">Search</label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search by name, email, course..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-9 pr-10 rounded-full"
                  />
                  {searchTerm && (
                    <button
                      type="button"
                      onClick={() => setSearchTerm("")}
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-full hover:bg-accent"
                      aria-label="Clear search"
                    >
                      <X className="h-4 w-4 text-muted-foreground" />
                    </button>
                  )}
                </div>
              </div>
              <div className="w-[150px]">
                <label className="text-xs font-medium text-muted-foreground px-2 mb-1 block">Section</label>
                <Select value={selectedSection} onValueChange={setSelectedSection}>
                  <SelectTrigger className="rounded-full">
                    <SelectValue placeholder="All Sections" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Sections</SelectItem>
                    {uniqueSections.map((section) => (
                      <SelectItem key={section} value={section}>
                        {section}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="w-[200px] min-w-[180px] max-w-[250px]">
                <label className="text-xs font-medium text-muted-foreground px-2 mb-1 block">Course</label>
                <Select value={selectedCourse} onValueChange={setSelectedCourse}>
                  <SelectTrigger className="rounded-full w-full">
                    <SelectValue placeholder="All Courses" />
                  </SelectTrigger>
                  <SelectContent className="max-w-[350px]">
                    <SelectItem value="all">All Courses</SelectItem>
                    {uniqueCourses.map((course) => (
                      <SelectItem key={course} value={course}>
                        <span className="block truncate max-w-[320px]">{course}</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="w-[150px]">
                <label className="text-xs font-medium text-muted-foreground px-2 mb-1 block">Year Level</label>
                <Select value={selectedYearLevel} onValueChange={setSelectedYearLevel}>
                  <SelectTrigger className="rounded-full">
                    <SelectValue placeholder="All Year Levels" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Year Levels</SelectItem>
                    {uniqueYearLevels.map((yearLevel) => (
                      <SelectItem key={yearLevel} value={yearLevel}>
                        {yearLevel}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="w-[130px]">
                <label className="text-xs font-medium text-muted-foreground px-2 mb-1 block">Account</label>
                <Select value={selectedAccountStatus} onValueChange={setSelectedAccountStatus}>
                  <SelectTrigger className="rounded-full">
                    <SelectValue placeholder="All Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {(selectedSection !== "all" || selectedCourse !== "all" || selectedYearLevel !== "all" || selectedAccountStatus !== "all" || searchTerm) && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setSelectedSection("all")
                    setSelectedCourse("all")
                    setSelectedYearLevel("all")
                    setSelectedAccountStatus("all")
                    setSearchTerm("")
                  }}
                  className="rounded-full"
                >
                  <X className="h-4 w-4 mr-1" />
                  Clear Filters
                </Button>
              )}
            </div>
          </div>
          <div className="w-full">
            <Table className="w-full table-fixed">
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[140px]">Name</TableHead>
                  <TableHead className="w-[60px]">Section</TableHead>
                  <TableHead className="w-[90px]">Year Level</TableHead>
                  <TableHead className="w-[200px]">Enrolled Course</TableHead>
                  <TableHead className="w-[180px]">Enrolled Subject</TableHead>
                  <TableHead className="w-[180px]">Email</TableHead>
                  <TableHead className="w-[80px]">Status</TableHead>
                  <TableHead className="w-[90px]">Account</TableHead>
                  <TableHead className="w-[110px]">Eval Progress</TableHead>
                  <TableHead className="text-right w-[80px]">Actions</TableHead>

                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedStudents.map((student) => (
                  <TableRow key={student.id}>
                    <TableCell className="font-medium">
                      {/* Clickable name that shows all enrolled subjects */}
                      <Popover>
                        <PopoverTrigger asChild>
                          <button
                            className="truncate text-sm text-primary hover:underline cursor-pointer text-left max-w-[140px] block"
                            title={`Click to view subjects for ${student.firstName} ${student.lastName}`}
                          >
                            {student.firstName} {student.lastName} {student.suffix}
                          </button>
                        </PopoverTrigger>
                        <PopoverContent className="w-72 p-4" align="start">
                          <div className="space-y-3">
                            <div>
                              <h4 className="font-semibold text-base">{student.firstName} {student.lastName} {student.suffix}</h4>
                              <p className="text-xs text-muted-foreground">{student.email}</p>
                            </div>
                            <div className="border-t pt-3">
                              <h5 className="text-sm font-medium mb-2">Enrolled Subjects</h5>
                              {(() => {
                                const subjectsArray = student.subjects && student.subjects.length > 0
                                  ? student.subjects
                                  : student.subject
                                    ? [student.subject]
                                    : []

                                if (subjectsArray.length === 0) {
                                  return <span className="text-sm text-muted-foreground">No subjects enrolled</span>
                                }

                                return (
                                  <div className="flex flex-wrap gap-1.5">
                                    {subjectsArray.map((subj, idx) => (
                                      <Badge key={idx} variant="outline" className="text-xs">
                                        {subj}
                                      </Badge>
                                    ))}
                                  </div>
                                )
                              })()}
                            </div>
                          </div>
                        </PopoverContent>
                      </Popover>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs">{student.section}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs">{student.yearLevel}</Badge>
                    </TableCell>
                    <TableCell>
                      <div className="truncate text-sm" title={student.course}>
                        {student.course}
                      </div>
                    </TableCell>
                    <TableCell>
                      {/* Clickable subject display with popover */}
                      {(() => {
                        const subjectsArray = student.subjects && student.subjects.length > 0
                          ? student.subjects
                          : student.subject
                            ? [student.subject]
                            : []

                        if (subjectsArray.length === 0) {
                          return <span className="text-muted-foreground text-sm">-</span>
                        }

                        if (subjectsArray.length === 1) {
                          return (
                            <Badge variant="outline" className="text-xs max-w-[160px] truncate" title={subjectsArray[0]}>
                              {subjectsArray[0]}
                            </Badge>
                          )
                        }

                        // Multiple subjects - clickable badge with popover
                        return (
                          <Popover>
                            <PopoverTrigger asChild>
                              <button
                                type="button"
                                className="inline-flex items-center rounded-full border border-transparent bg-secondary px-2.5 py-0.5 text-xs font-semibold text-secondary-foreground transition-colors hover:bg-secondary/80 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 cursor-pointer"
                              >
                                {subjectsArray.length} subjects
                              </button>
                            </PopoverTrigger>
                            <PopoverContent className="w-64 p-3" align="start">
                              <div className="space-y-2">
                                <h4 className="font-medium text-sm">All Enrolled Subjects ({subjectsArray.length})</h4>
                                <div className="flex flex-wrap gap-1.5">
                                  {subjectsArray.map((subj, idx) => (
                                    <Badge key={idx} variant="outline" className="text-xs">
                                      {subj}
                                    </Badge>
                                  ))}
                                </div>
                              </div>
                            </PopoverContent>
                          </Popover>
                        )
                      })()}
                    </TableCell>
                    <TableCell>
                      <div className="truncate text-sm" title={student.email}>
                        {student.email}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={student.status === 'Regular' ? 'default' : student.status === 'Graduated' ? 'outline' : 'destructive'}
                        className={
                          student.status === 'Irregular' ? 'bg-red-500 text-white hover:bg-red-600' :
                            student.status === 'Graduated' ? 'bg-yellow-400 text-yellow-900 hover:bg-yellow-500 border-yellow-500' :
                              student.status === 'Drop' ? 'bg-gray-500 text-white hover:bg-gray-600' : ''
                        }
                      >
                        {student.status || 'Regular'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={student.accountStatus === 'active' ? 'default' : 'secondary'}
                        className={student.accountStatus === 'active' ? 'bg-green-600 text-white hover:bg-green-700' : 'bg-primary text-primary-foreground hover:bg-primary/90'}
                      >
                        {student.accountStatus === 'active' ? 'Active' : 'Inactive'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {(() => {
                        const progress = getEvaluationProgressForStudent(student)
                        const pendingCount = progress.filter(p => !p.isComplete).length
                        const totalCount = progress.length

                        if (totalCount === 0) {
                          return <span className="text-muted-foreground text-xs">N/A</span>
                        }

                        return (
                          <button
                            onClick={() => {
                              setSelectedStudentForProgress(student)
                              setIsEvalProgressDialogOpen(true)
                            }}
                            className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium cursor-pointer transition-colors ${pendingCount === 0
                              ? 'bg-green-100 text-green-800 hover:bg-green-200 dark:bg-green-900 dark:text-green-100'
                              : 'bg-amber-100 text-amber-800 hover:bg-amber-200 dark:bg-amber-900 dark:text-amber-100'
                              }`}
                            title={`Click to view evaluation progress`}
                          >
                            {pendingCount === 0 ? (
                              <>
                                <CheckCircle2 className="h-3 w-3" />
                                Complete
                              </>
                            ) : (
                              <>
                                <Clock className="h-3 w-3" />
                                {pendingCount} pending
                              </>
                            )}
                          </button>
                        )
                      })()}
                    </TableCell>
                    <TableCell className="text-right">

                      <div className="flex justify-end gap-1">
                        <Button variant="outline" size="sm" onClick={() => openEditDialog(student)} className="h-8 w-8 p-0">
                          <Edit className="h-3.5 w-3.5" />
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="outline" size="sm" className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200">
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Delete Student</AlertDialogTitle>
                              <AlertDialogDescription>
                                Are you sure you want to delete <strong>{student.firstName} {student.lastName}</strong>? This action cannot be undone and will permanently remove the student from the database.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => handleDeleteStudent(student.id)}
                                className="bg-red-600 hover:bg-red-700 text-white"
                              >
                                Delete
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          {isLoading ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground">Loading students...</p>
            </div>
          ) : filteredStudents.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground">No students found. Try adjusting your search.</p>
            </div>
          ) : null}

          {/* Pagination Controls */}
          {filteredStudents.length > 0 && (
            <div className="flex items-center justify-between px-4 py-3 border-t">
              <div className="text-sm text-muted-foreground">
                Showing {((currentPage - 1) * studentsPerPage) + 1} to {Math.min(currentPage * studentsPerPage, filteredStudents.length)} of {filteredStudents.length} students
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                  disabled={currentPage === 1}
                  className="h-8 px-3"
                >
                  <ChevronLeft className="h-4 w-4 mr-1" />
                  Previous
                </Button>
                <div className="flex items-center gap-1">
                  {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                    let pageNum: number
                    if (totalPages <= 5) {
                      pageNum = i + 1
                    } else if (currentPage <= 3) {
                      pageNum = i + 1
                    } else if (currentPage >= totalPages - 2) {
                      pageNum = totalPages - 4 + i
                    } else {
                      pageNum = currentPage - 2 + i
                    }
                    return (
                      <Button
                        key={pageNum}
                        variant={currentPage === pageNum ? "default" : "outline"}
                        size="sm"
                        onClick={() => setCurrentPage(pageNum)}
                        className="h-8 w-8 p-0"
                      >
                        {pageNum}
                      </Button>
                    )
                  })}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                  disabled={currentPage === totalPages || totalPages === 0}
                  className="h-8 px-3"
                >
                  Next
                  <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </div>
            </div>
          )}
        </div>
      </Card>

      {/* Edit Student Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Edit Student</DialogTitle>
            <DialogDescription>Update student information and access settings.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4 overflow-y-auto flex-1 min-h-0">
            <div className="grid gap-2">
              <Label htmlFor="edit-firstName">First Name</Label>
              <Input
                id="edit-firstName"
                value={formData.firstName}
                onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit-lastName">Last Name</Label>
              <Input
                id="edit-lastName"
                value={formData.lastName}
                onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit-suffix">Suffix (Optional)</Label>
              <Input
                id="edit-suffix"
                value={formData.suffix}
                onChange={(e) => setFormData({ ...formData, suffix: e.target.value })}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit-studentId">Student ID</Label>
              <Input
                id="edit-studentId"
                value={formData.studentId}
                onChange={(e) => setFormData({ ...formData, studentId: e.target.value })}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit-email">Email</Label>
              <Input
                id="edit-email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit-yearLevel">Year Level</Label>
              <Select value={formData.yearLevel} onValueChange={(value) => setFormData({ ...formData, yearLevel: value })}>
                <SelectTrigger>
                  <SelectValue placeholder="Select year level" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1st Year">1st Year</SelectItem>
                  <SelectItem value="2nd Year">2nd Year</SelectItem>
                  <SelectItem value="3rd Year">3rd Year</SelectItem>
                  <SelectItem value="4th Year">4th Year</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit-course">Course</Label>
              <Input
                id="edit-course"
                value={formData.course}
                onChange={(e) => setFormData({ ...formData, course: e.target.value })}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit-section">Section</Label>
              <Input
                id="edit-section"
                value={formData.section}
                onChange={(e) => setFormData({ ...formData, section: e.target.value })}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit-status">Academic Status</Label>
              <Select value={formData.status} onValueChange={(value) => setFormData({ ...formData, status: value })}>
                <SelectTrigger>
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Regular">Regular</SelectItem>
                  <SelectItem value="Irregular">Irregular</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit-accountStatus">Account Status</Label>
              <Select value={formData.accountStatus} onValueChange={(value) => setFormData({ ...formData, accountStatus: value })}>
                <SelectTrigger>
                  <SelectValue placeholder="Select account status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit-password">Change Password</Label>
              <Input
                id="edit-password"
                type="password"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                placeholder="Enter new password"
              />
            </div>
            {/* Enrolled Subjects - Multi-subject design */}
            <div className="grid gap-3 pt-4 border-t mt-2">
              <Label className="text-base font-semibold">Enrolled Subjects</Label>

              <div className="space-y-4">
                {editingSubjects.map((subject, idx) => (
                  <div key={idx} className="space-y-2 pb-3 border-b last:border-b-0">
                    <div className="flex items-center justify-between">
                      <Label className="text-sm font-medium text-gray-700">Subject {idx + 1}</Label>
                      {editingSubjects.length > 1 && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 px-3 text-red-600 hover:text-red-700 hover:bg-red-50"
                          onClick={() => {
                            setEditingSubjects(prev => prev.filter((_, i) => i !== idx))
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
                        value={subject}
                        onChange={(e) => {
                          setEditingSubjects(prev => prev.map((s, i) =>
                            i === idx ? e.target.value : s
                          ))
                        }}
                        placeholder="e.g., Database Management"
                      />
                    </div>
                  </div>
                ))}
              </div>

              <Button
                variant="outline"
                className="w-full mt-2"
                onClick={() => {
                  setEditingSubjects(prev => [...prev, ''])
                }}
              >
                <PlusCircle className="h-4 w-4 mr-2" />
                Add Another Subject
              </Button>
            </div>
          </div>
          <DialogFooter className="mt-4 flex-shrink-0">
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleEditStudent}>Update Student</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Evaluation Progress Dialog */}
      <Dialog open={isEvalProgressDialogOpen} onOpenChange={setIsEvalProgressDialogOpen}>
        <DialogContent style={{ width: 'calc(100vw - 40px)', maxWidth: 'calc(40vw - 40px)' }} className="max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ClipboardList className="h-5 w-5" />
              Evaluation Progress
            </DialogTitle>
            <DialogDescription>
              {selectedStudentForProgress && (
                <>
                  <span className="font-medium text-foreground">
                    {selectedStudentForProgress.firstName} {selectedStudentForProgress.lastName}
                  </span>
                  {' - '}Section {selectedStudentForProgress.section}
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            {selectedStudentForProgress && (() => {
              const progress = getEvaluationProgressForStudent(selectedStudentForProgress)
              const pendingCount = progress.filter(p => !p.isComplete).length
              const completedCount = progress.filter(p => p.isComplete).length

              if (progress.length === 0) {
                return (
                  <div className="text-center py-6 text-muted-foreground">
                    <ClipboardList className="h-12 w-12 mx-auto mb-2 opacity-50" />
                    <p>No professors assigned for this student's subjects and section.</p>
                  </div>
                )
              }

              return (
                <div className="space-y-4">
                  {/* Summary badges */}
                  <div className="flex gap-3">
                    <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 px-3 py-1">
                      <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" />
                      {completedCount} Completed
                    </Badge>
                    <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 px-3 py-1">
                      <Clock className="h-3.5 w-3.5 mr-1.5" />
                      {pendingCount} Pending
                    </Badge>
                  </div>

                  {/* Progress table with better spacing */}
                  <div className="border rounded-lg overflow-hidden max-h-[400px] overflow-y-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-muted/50">
                          <TableHead className="w-[50%] py-3 px-4">Subject</TableHead>
                          <TableHead className="w-[30%] py-3 px-4">Professor</TableHead>
                          <TableHead className="w-[20%] text-center py-3 px-4">Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {progress.map((item, idx) => (
                          <TableRow key={`${item.professorId}-${item.subject}-${idx}`}>
                            <TableCell className="font-medium text-sm py-3 px-4">{item.subject}</TableCell>
                            <TableCell className="text-sm py-3 px-4">{item.professorName}</TableCell>
                            <TableCell className="text-center py-3 px-4">
                              {item.isComplete ? (
                                <Badge className="bg-green-600 text-white px-2.5 py-0.5">
                                  <CheckCircle2 className="h-3 w-3 mr-1" />
                                  Complete
                                </Badge>
                              ) : (
                                <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-300 px-2.5 py-0.5">
                                  <Clock className="h-3 w-3 mr-1" />
                                  Pending
                                </Badge>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              )
            })()}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEvalProgressDialogOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>


      {/* Toast Notifications */}

      <Toaster />
    </div>
  )
}
