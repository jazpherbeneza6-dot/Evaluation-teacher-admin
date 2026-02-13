"use client"

/*
 * EVALUATION QUESTION MANAGEMENT - Ito ang page para sa pag-manage ng mga tanong sa evaluation
 * 
 * SIMPLE EXPLANATION:
 * 1. Dito mo ginagawa ang mga tanong para sa evaluation ng teachers
 * 2. Pwede kang mag-add, edit, at delete ng mga tanong
 * 3. Makikita mo rin dito ang mga sagot ng students sa mga tanong
 * 4. May charts din para makita mo ang results ng evaluation
 */

// STEP 1: Import ng mga kailangan na components at functions
import { useState, useMemo, useEffect } from "react" // React hooks para sa state management
import { Button } from "@/components/ui/button" // Button component
import { Input } from "@/components/ui/input" // Input field component
import { Label } from "@/components/ui/label" // Label component
import { Textarea } from "@/components/ui/textarea" // Textarea component
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select" // Dropdown component
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu" // Dropdown menu component
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table" // Table components
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
import { Card, CardContent, CardDescription, CardTitle } from "@/components/ui/card" // Card components
import { Badge } from "@/components/ui/badge" // Badge component
import { Plus, Edit, Trash2, HelpCircle, X, Search, List, BarChart3, ArrowLeft, Download, FileText, Upload, Maximize2, Users, MoreVertical } from "lucide-react" // Icons
import { evaluationQuestionService, questionTypeService } from "@/lib/database" // Database functions
import type { EvaluationQuestion, Professor } from "@/lib/types" // Type definitions
import { useToast } from "@/hooks/use-toast" // Toast notification hook
import { sanitizeErrorMessage } from "@/lib/utils" // Helper function para sa pag-sanitize ng error messages
import { parseExcelQuestions, type ParsedQuestion, type ExcelQuestionParseResult } from "@/lib/excel-parser" // Excel parsing functions

// STEP 2: Declare global variables para sa Google Charts
declare global {
  interface Window {
    google: any // Google Charts library
  }
}

// STEP 3: Define ang props na kailangan ng component
interface EvaluationQuestionManagementProps {
  questions: EvaluationQuestion[] // Listahan ng mga tanong
  professors: Professor[] // Listahan ng mga teachers
  onRefresh?: () => void // Function para i-refresh ang data
}

/*
 * Hi! Ito ang evaluation system natin para sa mga teachers. 
 * Para maintindihan mo kung paano siya gamitin:
 * 
 * 1. Ano ang pwede mong gawin dito?
 *    - Pwede kang gumawa ng mga tanong para i-rate ang teachers
 *    - Pwede mong baguhin ang mga tanong kung may mali
 *    - Pwede mong burahin ang mga tanong na hindi na kailangan
 *    - Makikita mo rin dito kung ilang tanong meron sa bawat teacher
 * 
 * 2. Paano gumawa ng bagong tanong?
 *    - Una, pipili ka muna kung para kanino ang tanong (anong teacher)
 *    - Tapos, isusulat mo ang tanong mo
 *    - Pipili ka kung anong klaseng sagot ang gusto mo:
 *      * Multiple choice (may choices ka)
 *      * Rating (1-5 stars)
 *      * Text (pwedeng magsulat ng sagot)
 * 
 * 3. Paano mag-edit ng tanong?
 *    - I-click mo lang yung edit button sa tabi ng tanong
 *    - Pwede mong baguhin lahat - yung tanong, teacher, at tipo ng sagot
 * 
 * 4. Paano magdelete?
 *    - May delete button sa tabi ng bawat tanong
 *    - Pero mag-iingat ka! May double check muna bago totally mabura
 *    - Pwede mo ring burahin lahat ng tanong ng isang teacher kung kailangan
 */

// STEP 4: Main component function - dito nagsisimula ang lahat
export function EvaluationQuestionManagement({ questions, professors, onRefresh }: EvaluationQuestionManagementProps) {
  const { toast } = useToast() // Toast notification para sa messages

  // STEP 5: State variables para sa pag-control ng mga popup/modal
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)        // Para sa popup ng pag-add ng tanong
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)      // Para sa popup ng pag-edit ng tanong
  const [isProfessorQuestionsDialogOpen, setIsProfessorQuestionsDialogOpen] = useState(false) // Para sa popup ng tanong ng isang teacher
  const [isExcelImportDialogOpen, setIsExcelImportDialogOpen] = useState(false) // Para sa popup ng Excel import
  const [selectedProfessorForView, setSelectedProfessorForView] = useState<Professor | null>(null) // Napiling teacher para sa view
  const [editingQuestion, setEditingQuestion] = useState<EvaluationQuestion | null>(null) // Tanong na ine-edit
  const [searchQuery, setSearchQuery] = useState("") // Text para sa pag-search
  const [selectedSection, setSelectedSection] = useState<string>("all") // Selected section filter

  // Excel import state variables
  const [excelFile, setExcelFile] = useState<File | null>(null) // Selected Excel file
  const [parsedQuestions, setParsedQuestions] = useState<ParsedQuestion[]>([]) // Parsed questions from Excel
  const [newQuestions, setNewQuestions] = useState<ParsedQuestion[]>([]) // New questions (non-duplicates)
  const [duplicateQuestions, setDuplicateQuestions] = useState<ParsedQuestion[]>([]) // Duplicate questions
  const [isParsingExcel, setIsParsingExcel] = useState(false) // Loading state for parsing
  const [isImportingQuestions, setIsImportingQuestions] = useState(false) // Loading state for importing
  const [importProgress, setImportProgress] = useState(0) // Progress counter
  const [importedCount, setImportedCount] = useState(0) // Number of questions imported
  const [skippedCount, setSkippedCount] = useState(0) // Number of questions skipped (duplicates)
  const [isPreviewOpen, setIsPreviewOpen] = useState(false) // Preview popup state

  // STEP 9: State variables para sa form ng pag-add/edit ng tanong
  const [selectedProfessorId, setSelectedProfessorId] = useState("") // Napiling teacher
  const [questionText, setQuestionText] = useState("") // Text ng tanong
  const [questionType, setQuestionType] = useState<"Likert Scale" | "text">("text") // Tipo ng tanong
  const [options, setOptions] = useState<string[]>([""]) // Mga choices
  const [isSaving, setIsSaving] = useState(false) // Kung nagse-save pa ba

  // Delete All password protection state
  const [isDeleteAllPasswordDialogOpen, setIsDeleteAllPasswordDialogOpen] = useState(false)
  const [deleteAllPassword, setDeleteAllPassword] = useState("")
  const [deleteAllPasswordError, setDeleteAllPasswordError] = useState("")
  const [isDeleteAllConfirmOpen, setIsDeleteAllConfirmOpen] = useState(false)

  // STEP 10: Function para i-normalize ang question type (i-convert sa standard format)
  const normalizeQuestionType = (value: any): "Likert Scale" | "text" => {
    const v = String(value || "").toLowerCase().trim() // I-convert sa lowercase at i-trim
    if (v === "text" || v === "text response" || v === "text_response") return "text" // Kung text type
    if (v === "Likert Scale" || v === "likert" || v === "likert scale" || v === "likert_scale") return "Likert Scale" // Kung Likert Scale
    return "text" // Default sa text
  }

  // STEP 11: Function para i-save ang question type sa database (may timeout para hindi mag-hang)
  const safeUpsertQuestionType = async (value: any) => {
    const qt = normalizeQuestionType(value) // I-normalize muna ang type
    try {
      await Promise.race([
        questionTypeService.createIfMissing(qt), // I-save sa database
        new Promise<void>((resolve) => setTimeout(() => resolve(), 1500)), // Timeout after 1.5 seconds
      ])
    } catch (e) {
      console.warn("questionType upsert (guarded) failed", e) // Log ang error kung may problema
    }
  }

  // STEP 15: useEffect para sa pag-handle ng question type changes
  useEffect(() => {
    // I-save ang question type sa database (hindi blocking)
    ; (async () => {
      await safeUpsertQuestionType(questionType) // I-save sa database
    })()

    if (questionType === "Likert Scale") {
      // Kung Likert Scale, i-set ang mga standard options
      setOptions(["Strongly Agree", "Agree", "Disagree", "Strongly Disagree"])
    } else {
      // Kung text type, i-set ang empty options
      setOptions([""])
    }
  }, [questionType]) // I-run kapag nag-change ang questionType

  // Prevent body scrolling when preview is open
  useEffect(() => {
    if (isPreviewOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [isPreviewOpen])

  // STEP 16: Function para sa pag-handle ng question type change
  const handleQuestionTypeChange = (value: any) => {
    const nextType = normalizeQuestionType(value) // I-normalize ang value
    setQuestionType(nextType) // I-update ang state
  }




  // STEP 17: Function para mag-check kung may kaparehas na question (para iwas duplicate)
  // Note: Currently not displayed in UI, but kept for potential future use
  const duplicateWarning = useMemo(() => {
    // Kung walang laman ang question, hindi magche-check
    if (!questionText.trim()) return null

    // Hinahanap ang mga similar questions
    const similarQuestions = questions.filter((q) => {
      // Hindi isasama ang question na ine-edit ngayon
      if (editingQuestion && q.id === editingQuestion.id) return false

      const currentText = questionText.toLowerCase().trim() // Current question text
      const existingText = q.questionText.toLowerCase().trim() // Existing question text

      if (currentText === existingText) {
        return true // Exact match
      }

      // I-check ang similarity gamit ang word comparison
      const words1 = currentText.split(/\s+/) // I-split ang current text sa words
      const words2 = existingText.split(/\s+/) // I-split ang existing text sa words
      const commonWords = words1.filter((word) => words2.includes(word)) // Hanapin ang common words
      const similarity = (commonWords.length * 2) / (words1.length + words2.length) // Calculate similarity

      return similarity > 0.7 // Return true kung mas mataas sa 70% ang similarity
    })

    return similarQuestions.length > 0 ? similarQuestions : null // Return ang similar questions kung may nahanap
  }, [questionText, questions, editingQuestion]) // I-run kapag mag-change ang dependencies

  // STEP 18: Function para i-group ang questions by professor
  const groupedQuestions = useMemo(() => {
    const grouped = new Map<string, { professor: Professor; questions: EvaluationQuestion[]; count: number }>()

    questions.forEach((question) => {
      const professor = professors.find((p) => p.id === question.teacherId) // Hanapin ang professor
      if (professor) {
        if (!grouped.has(question.teacherId)) {
          // Kung walang group para sa professor na ito, gumawa ng bago
          grouped.set(question.teacherId, {
            professor,
            questions: [],
            count: 0,
          })
        }
        const group = grouped.get(question.teacherId)! // Kunin ang group
        group.questions.push(question) // I-add ang question sa group
        group.count = group.questions.length // I-update ang count
      }
    })

    return Array.from(grouped.values()) // I-convert sa array
  }, [questions, professors]) // I-run kapag mag-change ang questions o professors

  // Get unique questions only (deduplicate by questionText)
  const uniqueQuestions = useMemo(() => {
    const seen = new Map<string, EvaluationQuestion>()
    questions.forEach((q) => {
      const key = q.questionText.toLowerCase().trim()
      if (!seen.has(key)) {
        seen.set(key, q)
      }
    })
    return Array.from(seen.values())
  }, [questions])

  // Group unique questions by section
  const questionsBySection = useMemo(() => {
    const sections = new Map<string, EvaluationQuestion[]>()

    uniqueQuestions.forEach((q) => {
      const section = q.section || 'Other'
      if (!sections.has(section)) {
        sections.set(section, [])
      }
      sections.get(section)!.push(q)
    })

    // Sort sections in a specific order
    const sectionOrder = [
      'A. Instructional Competence',
      'B. Classroom Management',
      'C. Professionalism and Personal Qualities',
      'D. Student Support and Development',
      'E. Research',
      'F. Comments',
      'Other'
    ]

    const sorted = new Map<string, EvaluationQuestion[]>()
    sectionOrder.forEach((section) => {
      if (sections.has(section)) {
        sorted.set(section, sections.get(section)!)
      }
    })

    // Add any remaining sections not in the predefined order
    sections.forEach((questions, section) => {
      if (!sorted.has(section)) {
        sorted.set(section, questions)
      }
    })

    return sorted
  }, [uniqueQuestions])

  const filteredQuestions = useMemo(() => {
    if (!searchQuery.trim()) return uniqueQuestions

    const query = searchQuery.toLowerCase()
    return uniqueQuestions.filter(
      (q) =>
        q.questionText.toLowerCase().includes(query) ||
        (q.section && q.section.toLowerCase().includes(query)) ||
        q.questionType.toLowerCase().includes(query),
    )
  }, [uniqueQuestions, searchQuery])

  const professorQuestions = useMemo(() => {
    if (!selectedProfessorForView) return []
    return questions.filter((q) => q.teacherId === selectedProfessorForView.id && q.isActive)
  }, [questions, selectedProfessorForView])


  const handleAddOption = () => {
    setOptions([...options, ""])
  }

  const handleRemoveOption = (index: number) => {
    if (options.length > 1) {
      setOptions(options.filter((_, i) => i !== index))
    }
  }

  const handleOptionChange = (index: number, value: string) => {
    const newOptions = [...options]
    newOptions[index] = value
    setOptions(newOptions)
  }

  // Ito yung function na nagdadagdag ng bagong tanong
  // Ganito siya gumagana:
  // - Chinecheck muna niya kung may napili ka bang teacher at may tanong ka
  // - Tapos, ilalagay niya yung bagong tanong sa database
  // - Pagkatapos, icle-clear niya yung form para ready ka na sa susunod na tanong
  const handleAddQuestion = async () => {
    // Validation: Kailangan may napiling professor at may question
    if (!selectedProfessorId) {
      toast({
        title: "Select a professor",
        description: "Please choose a professor before adding a question.",
        variant: "destructive",
      })
      return
    }
    if (!questionText.trim()) {
      toast({
        title: "Question text is required",
        description: "Please enter the question before saving.",
        variant: "destructive",
      })
      return
    }

    // Hanapin ang detalye ng piniling professor
    const selectedProfessor = professors.find((p) => p.id === selectedProfessorId)
    if (!selectedProfessor) {
      toast({
        title: "Invalid professor",
        description: "The selected professor could not be found.",
        variant: "destructive",
      })
      return
    }

    try {
      setIsSaving(true)
      // Best-effort: don't block question creation if this fails
      await safeUpsertQuestionType(questionType)
      const qt = normalizeQuestionType(questionType)
      const questionData: any = {
        teacherId: selectedProfessor.id,
        teacherName: selectedProfessor.name,
        questionText: questionText.trim(),
        questionType: qt,
        isActive: true,
      }
      if (qt === "Likert Scale") {
        questionData.options = ["Strongly Agree", "Agree", "Disagree", "Strongly Disagree"]
      }

      await evaluationQuestionService.create(questionData)
      toast({
        title: "Question added",
        description: "Your evaluation question has been saved to Firestore.",
      })
      resetForm()
      setIsAddDialogOpen(false)
      onRefresh?.()
    } catch (error) {
      console.error("Add question failed:", error)
      toast({
        title: "Failed to add question",
        description: sanitizeErrorMessage(error),
        variant: "destructive",
      })
    } finally {
      setIsSaving(false)
    }
  }

  const handleAddQuestionAndContinue = async () => {
    if (!selectedProfessorId) {
      toast({
        title: "Select a professor",
        description: "Please choose a professor before adding a question.",
        variant: "destructive",
      })
      return
    }
    if (!questionText.trim()) {
      toast({
        title: "Question text is required",
        description: "Please enter the question before saving.",
        variant: "destructive",
      })
      return
    }

    const selectedProfessor = professors.find((p) => p.id === selectedProfessorId)
    if (!selectedProfessor) {
      toast({
        title: "Invalid professor",
        description: "The selected professor could not be found.",
        variant: "destructive",
      })
      return
    }

    try {
      setIsSaving(true)
      // Best-effort: don't block question creation if this fails
      await safeUpsertQuestionType(questionType)
      const qt = normalizeQuestionType(questionType)
      const questionData: any = {
        teacherId: selectedProfessor.id,
        teacherName: selectedProfessor.name,
        questionText: questionText.trim(),
        questionType: qt,
        isActive: true,
      }
      if (qt === "Likert Scale") {
        questionData.options = ["Strongly Agree", "Agree", "Disagree", "Strongly Disagree"]
      }

      await evaluationQuestionService.create(questionData)
      toast({
        title: "Question added",
        description: "Saved. You can add another question.",
      })
      setQuestionText("")
      setQuestionType("text")
      setOptions([""])
      onRefresh?.()
    } catch (error) {
      console.error("Add & Continue failed:", error)
      toast({
        title: "Failed to add question",
        description: sanitizeErrorMessage(error),
        variant: "destructive",
      })
    } finally {
      setIsSaving(false)
    }
  }

  // Ito naman yung function para mag-edit ng tanong
  // Parang ganito siya:
  // - Kunwari may nakita kang mali sa tanong, pwede mong baguhin
  // - Chinecheck lang niya kung may laman yung mga important fields
  // - Tapos automatic na niya iu-update sa database yung changes mo
  const handleEditQuestion = async () => {
    if (!editingQuestion || !questionText.trim()) return;
    // Find all similar questions (using original text of the question being edited)
    const originalText = editingQuestion.questionText;
    const similarQuestions = findAllQuestionsByText(originalText);
    // Collect all update promises
    try {
      await Promise.all(similarQuestions.map(q => {
        const updatedData: any = {
          teacherId: q.teacherId,
          teacherName: q.teacherName,
          questionText: questionText.trim(),
          questionType,
          isActive: true,
        }
        if (questionType === "Likert Scale") {
          updatedData.options = ["Strongly Agree", "Agree", "Disagree", "Strongly Disagree"]
        }
        return evaluationQuestionService.update(q.id, updatedData);
      }))
      toast({
        title: "Updated all similar questions",
        description: `Updated ${similarQuestions.length} questions in all professors with the new question data.`
      })
      resetForm()
      setIsEditDialogOpen(false)
      setEditingQuestion(null)
      onRefresh?.()
    } catch (error) { }
  }

  // Ito yung delete function - ginagamit pag may tanong na gusto mong tanggalin
  // - Click ka lang ng delete button
  // - May lalabas na confirmation (para sure ka)
  // - Pag ok ka na, automatic na mawawala yung tanong sa list
  const handleDeleteQuestion = async (questionId: string) => {
    try {
      // Find the question being deleted (to use its questionText)
      const qToDelete = questions.find(q => q.id === questionId)
      if (!qToDelete) return;
      const sameQuestions = findAllQuestionsByText(qToDelete.questionText)
      if (sameQuestions.length === 0) return;
      // Bulk delete all similar questions
      await Promise.all(sameQuestions.map(q => evaluationQuestionService.delete(q.id)))
      toast({
        title: "Deleted all similar questions",
        description: `Deleted ${sameQuestions.length} questions in all professors with the same question text.`
      })
      onRefresh?.()
    } catch (error) { }
  }

  // Ito yung function pag gusto mong burahin LAHAT ng tanong ng isang teacher
  // Mag-iingat ka dito kasi mabubura lahat!
  // - Una, kukunin niya lahat ng tanong nung teacher
  // - Tapos sabay-sabay niyang buburahin
  // - May confirmation din para sure ka talaga!
  const handleDeleteAllQuestionsForProfessor = async (professorId: string) => {
    try {
      // Kunin lahat ng questions ng professor
      const professorQuestions = questions.filter((q) => q.teacherId === professorId)
      // I-delete lahat nang sabay-sabay gamit ang Promise.all
      await Promise.all(professorQuestions.map((q) => evaluationQuestionService.delete(q.id)))
      // I-refresh ang display
      onRefresh?.()
    } catch (error) { }
  }

  // Ito yung function na nagbubukas ng edit window
  // Ang ginagawa niya:
  // - Pag clinick mo yung edit button, magbubukas yung window
  // - Automatic niyang ilalagay yung current na tanong sa form
  // - Ready ka na mag-edit!
  const openEditDialog = (question: EvaluationQuestion) => {
    // I-store ang question na ie-edit
    setEditingQuestion(question)
    // I-load ang current values sa form
    setSelectedProfessorId(question.teacherId)
    setQuestionText(question.questionText)
    setQuestionType(normalizeQuestionType(question.questionType))
    setOptions(question.options || [""])
    // Buksan ang dialog
    setIsEditDialogOpen(true)
  }

  const openProfessorQuestionsDialog = (professorId: string, professorName: string) => {
    const professor = professors.find((p) => p.id === professorId)
    if (professor) {
      setSelectedProfessorForView(professor)
      setIsProfessorQuestionsDialogOpen(true)
    }
  }

  const closeProfessorQuestionsModal = () => {
    setIsProfessorQuestionsDialogOpen(false)
    setSelectedProfessorForView(null)
  }

  const openEditDialogForProfessor = (professorId: string) => {
    const professorQuestions = questions.filter((q) => q.teacherId === professorId)
    if (professorQuestions.length > 0) {
      openEditDialog(professorQuestions[0])
    }
  }

  const resetForm = () => {
    setSelectedProfessorId("")
    setQuestionText("")
    setQuestionType("text")
    setOptions([""])
    setEditingQuestion(null)
  }

  // Excel Import Functions
  // Helper function to normalize question text for comparison
  const normalizeQuestionText = (text: string): string => {
    if (!text) return ""
    // Convert to lowercase, trim, and normalize whitespace
    return text
      .toLowerCase()
      .trim()
      // Replace multiple spaces with single space
      .replace(/\s+/g, ' ')
      // Remove leading/trailing punctuation that might differ
      .replace(/^[.,;:!?\s]+|[.,;:!?\s]+$/g, '')
      // Normalize common punctuation variations
      .replace(/['"]/g, "'") // Normalize quotes
      .replace(/[–—]/g, '-') // Normalize dashes
  }

  const checkForDuplicateQuestions = (parsedQuestions: ParsedQuestion[]): {
    newQuestions: ParsedQuestion[]
    duplicateQuestions: ParsedQuestion[]
    duplicateCount: number
  } => {
    const newQuestions: ParsedQuestion[] = []
    const duplicateQuestions: ParsedQuestion[] = []

    // Create a normalized set of existing questions for faster lookup
    const existingQuestionsNormalized = new Set<string>()
    questions.forEach(existingQuestion => {
      const normalized = normalizeQuestionText(existingQuestion.questionText)
      if (normalized) {
        existingQuestionsNormalized.add(normalized)
      }
    })



    parsedQuestions.forEach(parsedQuestion => {
      const normalizedNewText = normalizeQuestionText(parsedQuestion.questionText)

      if (!normalizedNewText) {
        // Skip empty questions
        duplicateQuestions.push(parsedQuestion)
        return
      }

      // Check if this question already exists in the database
      const isDuplicate = existingQuestionsNormalized.has(normalizedNewText)

      if (isDuplicate) {
        console.log(`⚠️ Duplicate found: "${parsedQuestion.questionText.substring(0, 50)}..."`)
        duplicateQuestions.push(parsedQuestion)
      } else {
        // Also check within the parsed questions to avoid duplicates within the same import
        const isDuplicateInImport = newQuestions.some(newQ =>
          normalizeQuestionText(newQ.questionText) === normalizedNewText
        )

        if (isDuplicateInImport) {
        } else {
          newQuestions.push(parsedQuestion)
        }
      }
    })



    return {
      newQuestions,
      duplicateQuestions,
      duplicateCount: duplicateQuestions.length
    }
  }

  const handleExcelFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) {
      if (file.type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
        file.type === 'application/vnd.ms-excel' ||
        file.name.endsWith('.xlsx') ||
        file.name.endsWith('.xls')) {
        setExcelFile(file)
        setParsedQuestions([])
      } else {
        toast({
          title: "Invalid file type",
          description: "Please select an Excel file (.xlsx or .xls)",
          variant: "destructive",
        })
      }
    }
  }

  const handleReadExcel = async () => {
    if (!excelFile) {
      toast({
        title: "No File Selected",
        description: "Please select an Excel file first",
        variant: "destructive",
      })
      return
    }

    try {
      setIsParsingExcel(true)
      const result = await parseExcelQuestions(excelFile)

      if (result.questions.length === 0) {
        toast({
          title: "No questions found",
          description: "The Excel file doesn't contain any valid questions. Please check the file format.",
          variant: "destructive",
        })
        setIsParsingExcel(false)
        return
      }

      // Check for duplicates
      const duplicateCheck = checkForDuplicateQuestions(result.questions)

      setParsedQuestions(result.questions)
      setNewQuestions(duplicateCheck.newQuestions)
      setDuplicateQuestions(duplicateCheck.duplicateQuestions)

      // Close import dialog and show preview popup
      setIsExcelImportDialogOpen(false)
      setIsPreviewOpen(true)

      toast({
        title: "Excel Read Successfully",
        description: `Found ${result.questions.length} questions. ${duplicateCheck.newQuestions.length} will be imported, ${duplicateCheck.duplicateCount} already exist and will be skipped.`,
      })
    } catch (error) {
      console.error("Excel parsing error:", error)
      toast({
        title: "Failed to read Excel",
        description: sanitizeErrorMessage(error),
        variant: "destructive",
      })
    } finally {
      setIsParsingExcel(false)
    }
  }

  const handleImportQuestions = async () => {
    if (parsedQuestions.length === 0) return

    try {
      setIsImportingQuestions(true)
      setImportProgress(0)
      setImportedCount(0)
      setSkippedCount(0)

      let successCount = 0
      let errorCount = 0
      const totalQuestions = professors.length * newQuestions.length

      // Import only new questions for each professor
      for (let i = 0; i < professors.length; i++) {
        const professor = professors[i]

        for (let j = 0; j < newQuestions.length; j++) {
          const parsedQuestion = newQuestions[j]

          try {
            // Check if this is a Comments question (text type)
            const isCommentsSection = parsedQuestion.section?.toLowerCase().includes('comment')
            const questionType = isCommentsSection ? "text" : "Likert Scale"

            const questionData: any = {
              teacherId: professor.id,
              teacherName: professor.name,
              questionText: parsedQuestion.questionText,
              questionType: questionType as "Likert Scale" | "text",
              isActive: true,
              section: parsedQuestion.section,
              weight: parsedQuestion.weight,
            }

            // Only add options for Likert Scale questions
            if (!isCommentsSection) {
              questionData.options = ["Strongly Agree", "Agree", "Disagree", "Strongly Disagree"]
            }

            await evaluationQuestionService.create(questionData)
            successCount++
          } catch (error) {
            console.error(`Failed to import question for ${professor.name}:`, error)
            errorCount++
          }

          // Update progress
          const progress = totalQuestions > 0 ? Math.round(((i * newQuestions.length + j + 1) / totalQuestions) * 100) : 100
          setImportProgress(progress)
          setImportedCount(successCount)
        }
      }

      const skippedTotal = professors.length * duplicateQuestions.length
      setSkippedCount(skippedTotal)

      // Show toast notification with count of questions added
      if (successCount > 0) {
        // Questions were added
        toast({
          title: `Questions Added: ${successCount}`,
          description: `Successfully imported ${successCount} new questions. ${skippedTotal} duplicates were skipped. ${errorCount > 0 ? `${errorCount} failed.` : ''}`,
        })
      } else {
        // No questions were added
        toast({
          title: "Questions Added: 0",
          description: `Import completed. All ${parsedQuestions.length} questions already exist in the database and were skipped.`,
        })
      }

      // Reset form and close preview
      setExcelFile(null)
      setParsedQuestions([])
      setNewQuestions([])
      setDuplicateQuestions([])
      setIsPreviewOpen(false)
      onRefresh?.()
    } catch (error) {
      console.error("Import error:", error)
      toast({
        title: "Import failed",
        description: "Failed to import questions. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsImportingQuestions(false)
      setImportProgress(0)
      setImportedCount(0)
      setSkippedCount(0)
    }
  }


  const getQuestionTypeLabel = (type: string) => {
    switch (type) {
      case "Likert Scale":
        return "Likert Scale"
      case "text":
        return "Text Response"
      case "Comment":
        return "Comment"
      default:
        return type
    }
  }

  // Helper to normalize section display names
  const getSectionDisplayName = (section: string): string => {
    const lower = section.toLowerCase().trim()
    if (lower === 'verbal interpretation' || lower === 'f. verbal interpretation') {
      return 'Comments'
    }
    return section
  }

  const safeQuestions = questions || []
  const safeProfessors = professors || []

  // GLOBAL: Find all questions with the same text (case-insensitive, trimmed)
  function findAllQuestionsByText(originalText: string) {
    const refText = originalText.toLowerCase().trim();
    return questions.filter(q => q.questionText.toLowerCase().trim() === refText);
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4">
        <div>
          <h2 className="text-lg md:text-2xl lg:text-3xl font-bold text-foreground">Evaluation Questions</h2>
          <p className="text-xs sm:text-sm md:text-base text-muted-foreground">Create and manage teacher evaluation questions</p>
        </div>
        <div className="flex flex-wrap gap-2 w-full sm:w-auto">
          <Button
            onClick={() => {
              setExcelFile(null)
              setParsedQuestions([])
              setNewQuestions([])
              setDuplicateQuestions([])
              setImportProgress(0)
              setImportedCount(0)
              setSkippedCount(0)
              setIsExcelImportDialogOpen(true)
            }}
            className="w-full sm:w-auto text-sm"
          >
            <Upload className="mr-2 h-3.5 w-3.5 sm:h-4 sm:w-4" />
            Import Excel
          </Button>
        </div>
      </div>

      {/* All Questions Display - Main Content */}
      <div className="flex flex-col">
        {/* Filters and Actions Toolbar */}
        <div className="mb-6 p-4 bg-muted/30 rounded-lg border border-border/50">
          <div className="flex flex-col gap-4">
            {/* Filters Row - Now Inline */}
            <div className="flex flex-col sm:flex-row gap-3 w-full">
              {/* Section Filter */}
              <div className="flex flex-col gap-2 w-full sm:w-[200px]">
                <Label htmlFor="section-filter" className="text-xs font-medium text-muted-foreground">
                  Filter by Section
                </Label>
                <Select value={selectedSection} onValueChange={setSelectedSection}>
                  <SelectTrigger id="section-filter" className="w-full">
                    <SelectValue placeholder="Select a section" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Sections</SelectItem>
                    {Array.from(questionsBySection.entries()).map(([section, questions]) => (
                      <SelectItem key={section} value={section}>
                        {getSectionDisplayName(section)} ({questions.length})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Search Bar */}
              <div className="flex flex-col gap-2 flex-1">
                <Label htmlFor="search-questions" className="text-xs font-medium text-muted-foreground">
                  Search Questions
                </Label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="search-questions"
                    placeholder="Type to search questions..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10 pr-10"
                  />
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery("")}
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                      aria-label="Clear search"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>

              {/* Right Side: Actions - 3-dot menu */}
              <div className="flex flex-col gap-2 w-full sm:w-auto">
                <Label className="text-xs font-medium text-muted-foreground opacity-0 pointer-events-none">
                  Actions
                </Label>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full sm:w-auto"
                    >
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem
                      onClick={() => {
                        setDeleteAllPassword("")
                        setDeleteAllPasswordError("")
                        setIsDeleteAllPasswordDialogOpen(true)
                      }}
                      disabled={uniqueQuestions.length === 0}
                      className="text-destructive focus:text-destructive"
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      Delete All Questions
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>

                {/* Password Dialog for Delete All */}
                <Dialog open={isDeleteAllPasswordDialogOpen} onOpenChange={setIsDeleteAllPasswordDialogOpen}>
                  <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                      <DialogTitle className="flex items-center gap-2">
                        <Trash2 className="h-5 w-5 text-destructive" />
                        Delete All Questions
                      </DialogTitle>
                      <DialogDescription>
                        This action requires administrator password to proceed.
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                      <div className="space-y-2">
                        <Label htmlFor="delete-all-password">Enter Password</Label>
                        <Input
                          id="delete-all-password"
                          type="password"
                          placeholder="Enter password..."
                          value={deleteAllPassword}
                          onChange={(e) => {
                            setDeleteAllPassword(e.target.value)
                            setDeleteAllPasswordError("")
                          }}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              if (deleteAllPassword === "LCCADMIN") {
                                setIsDeleteAllPasswordDialogOpen(false)
                                setIsDeleteAllConfirmOpen(true)
                              } else {
                                setDeleteAllPasswordError("Incorrect password. Please try again.")
                              }
                            }
                          }}
                        />
                        {deleteAllPasswordError && (
                          <p className="text-sm text-destructive">{deleteAllPasswordError}</p>
                        )}
                      </div>
                    </div>
                    <DialogFooter>
                      <Button
                        variant="outline"
                        onClick={() => setIsDeleteAllPasswordDialogOpen(false)}
                      >
                        Cancel
                      </Button>
                      <Button
                        variant="destructive"
                        onClick={() => {
                          if (deleteAllPassword === "LCCADMIN") {
                            setIsDeleteAllPasswordDialogOpen(false)
                            setIsDeleteAllConfirmOpen(true)
                          } else {
                            setDeleteAllPasswordError("Incorrect password. Please try again.")
                          }
                        }}
                      >
                        Continue
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>

                {/* Confirmation Dialog after password */}
                <AlertDialog open={isDeleteAllConfirmOpen} onOpenChange={setIsDeleteAllConfirmOpen}>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Confirm Delete All Questions</AlertDialogTitle>
                      <AlertDialogDescription>
                        Are you sure you want to delete ALL {uniqueQuestions.length} evaluation questions across ALL professors?
                        <br /><br />
                        <strong className="text-destructive">Warning:</strong> This action cannot be undone and will permanently delete all questions from the database.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={async () => {
                          try {
                            // Delete all questions
                            await Promise.all(questions.map((q) => evaluationQuestionService.delete(q.id)))
                            toast({
                              title: "All questions deleted",
                              description: `Successfully deleted ${questions.length} questions.`,
                            })
                            onRefresh?.()
                          } catch (error) {
                            console.error("Error deleting all questions:", error)
                            toast({
                              title: "Delete failed",
                              description: "Failed to delete all questions. Please try again.",
                              variant: "destructive",
                            })
                          }
                        }}
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      >
                        Delete All
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </div>
          </div>
        </div>

        {/* Questions Display */}
        <div>
          {(() => {
            // Get sections to display based on selection
            const sectionsToShow = selectedSection === "all"
              ? Array.from(questionsBySection.entries())
              : questionsBySection.has(selectedSection)
                ? [[selectedSection, questionsBySection.get(selectedSection)!]] as [string, EvaluationQuestion[]][]
                : []

            // Apply search filter if needed
            const displaySections = searchQuery.trim()
              ? sectionsToShow.map(([section, questions]) => [
                section,
                questions.filter(q => filteredQuestions.includes(q))
              ] as [string, EvaluationQuestion[]])
                .filter(([_, questions]) => questions.length > 0)
              : sectionsToShow

            if (displaySections.length === 0) {
              return (
                <div className="flex flex-col items-center justify-center py-12">
                  <Search className="h-12 w-12 text-muted-foreground mb-4" />
                  <h3 className="text-lg font-semibold mb-2">
                    {searchQuery ? "No questions found" : "No questions in this section"}
                  </h3>
                  <p className="text-sm text-muted-foreground text-center mb-4">
                    {searchQuery
                      ? "Try adjusting your search terms or select a different section."
                      : "Select a different section or add questions to this section."
                    }
                  </p>
                  {searchQuery && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setSearchQuery("")}
                    >
                      <X className="mr-2 h-4 w-4" />
                      Clear Search
                    </Button>
                  )}
                </div>
              )
            }

            // If "all" is selected, show questions grouped by section with headers
            // Maintain section order: Instructional Competence first
            if (selectedSection === "all") {
              // Sort sections to ensure Instructional Competence appears first
              const sectionOrder = [
                'A. Instructional Competence',
                'Instructional Competence',
                'B. Classroom Management',
                'Classroom Management',
                'C. Professionalism and Personal Qualities',
                'Professionalism and Personal Qualities',
                'D. Student Support and Development',
                'Student Support and Development',
                'E. Research',
                'Research',
                'F. Comments',
                'Comments',
                'verbal interpretation',
                'F. verbal interpretation',
                'Other'
              ]

              // Helper function to get section priority for sorting
              const getSectionPriority = (section: string): number => {
                const normalized = section || 'Other'
                // Check for exact match first
                const exactIndex = sectionOrder.indexOf(normalized)
                if (exactIndex !== -1) return exactIndex

                // Check for partial match (case-insensitive)
                const lowerSection = normalized.toLowerCase()
                for (let i = 0; i < sectionOrder.length; i++) {
                  if (sectionOrder[i].toLowerCase().includes(lowerSection) ||
                    lowerSection.includes(sectionOrder[i].toLowerCase())) {
                    return i
                  }
                }

                // If no match, put at the end
                return sectionOrder.length
              }

              // Sort displaySections by priority
              const sortedDisplaySections = [...displaySections].sort(([sectionA], [sectionB]) => {
                const priorityA = getSectionPriority(sectionA)
                const priorityB = getSectionPriority(sectionB)
                return priorityA - priorityB
              })

              // Show sections with headers, in order
              return (
                <div className="space-y-6 sm:space-y-8">
                  {sortedDisplaySections.map(([section, sectionQuestions]) => (
                    <div key={section} className="space-y-3 sm:space-y-4">
                      <h4 className="text-lg sm:text-xl font-bold text-foreground border-b pb-2 px-1 sm:px-0">{getSectionDisplayName(section)}</h4>
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 items-stretch">
                        {sectionQuestions.map((question, index) => (
                          <div
                            key={question.id}
                            className={`group border rounded-lg sm:rounded-xl bg-gradient-to-br transition-all duration-300 hover:shadow-lg sm:hover:shadow-xl hover:scale-[1.01] sm:hover:scale-[1.02] hover:-translate-y-0.5 sm:hover:-translate-y-1 h-full flex flex-col ${index % 3 === 0
                              ? 'from-card to-primary/5 hover:border-primary/40'
                              : index % 3 === 1
                                ? 'from-card to-blue-500/5 hover:border-blue-500/40'
                                : 'from-card to-purple-500/5 hover:border-purple-500/40'
                              }`}
                          >

                            {/* Card Content */}
                            <div className="p-4 sm:p-5 flex-1 flex flex-col">
                              <div className="mb-4 sm:mb-5 flex-1">
                                <h4 className="text-sm sm:text-base font-bold leading-relaxed text-foreground group-hover:text-primary transition-colors">
                                  {question.questionText}
                                </h4>
                              </div>

                              {/* Question Options Preview */}
                              {question.options && question.options.length > 0 && (
                                <div className="mb-4 sm:mb-5 flex-shrink-0">
                                  <p className="text-xs font-semibold text-muted-foreground mb-2 sm:mb-3 uppercase tracking-wide">
                                    Response Options
                                  </p>
                                  <div className="flex flex-wrap gap-1.5 sm:gap-2">
                                    {question.options.slice(0, 2).map((option, optIndex) => (
                                      <span
                                        key={optIndex}
                                        className="inline-flex items-center px-2 sm:px-3 py-1 sm:py-1.5 rounded-full text-xs font-medium bg-muted/70 border hover:bg-muted transition-colors break-words"
                                      >
                                        {option}
                                      </span>
                                    ))}
                                    {question.options.length > 2 && (
                                      <span className="inline-flex items-center px-2 sm:px-3 py-1 sm:py-1.5 rounded-full text-xs font-medium bg-primary/10 border border-primary/30 text-primary">
                                        +{question.options.length - 2} more
                                      </span>
                                    )}
                                  </div>
                                </div>
                              )}

                              {/* Action Buttons */}
                              <div className="flex items-center justify-end gap-1.5 sm:gap-2 pt-3 sm:pt-4 border-t flex-shrink-0 mt-auto">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => {
                                    openEditDialog(question)
                                  }}
                                  className="h-8 sm:h-9 px-2 sm:px-3 hover:bg-primary/10 hover:text-primary transition-all text-xs"
                                  title="Edit all instances of this question"
                                  aria-label="Edit question"
                                >
                                  <Edit className="h-3.5 w-3.5 sm:h-4 sm:w-4 sm:mr-1.5" />
                                  <span className="hidden sm:inline text-xs font-medium">Edit</span>
                                </Button>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )
            }

            // For specific section, show with section header
            return (
              <div className="space-y-6 sm:space-y-8">
                {displaySections.map(([section, sectionQuestions]) => (
                  <div key={section} className="space-y-3 sm:space-y-4">
                    <h4 className="text-lg sm:text-xl font-bold text-foreground border-b pb-2 px-1 sm:px-0">{getSectionDisplayName(section)}</h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 items-stretch">
                      {sectionQuestions.map((question, index) => (
                        <div
                          key={question.id}
                          className={`group border rounded-lg sm:rounded-xl bg-gradient-to-br transition-all duration-300 hover:shadow-lg sm:hover:shadow-xl hover:scale-[1.01] sm:hover:scale-[1.02] hover:-translate-y-0.5 sm:hover:-translate-y-1 h-full flex flex-col ${index % 3 === 0
                            ? 'from-card to-primary/5 hover:border-primary/40'
                            : index % 3 === 1
                              ? 'from-card to-blue-500/5 hover:border-blue-500/40'
                              : 'from-card to-purple-500/5 hover:border-purple-500/40'
                            }`}
                        >

                          {/* Card Content */}
                          <div className="p-4 sm:p-5 flex-1 flex flex-col">
                            <div className="mb-4 sm:mb-5 flex-1">
                              <h4 className="text-sm sm:text-base font-bold leading-relaxed text-foreground group-hover:text-primary transition-colors">
                                {question.questionText}
                              </h4>
                            </div>

                            {/* Question Options Preview */}
                            {question.options && question.options.length > 0 && (
                              <div className="mb-4 sm:mb-5 flex-shrink-0">
                                <p className="text-xs font-semibold text-muted-foreground mb-2 sm:mb-3 uppercase tracking-wide">
                                  Response Options
                                </p>
                                <div className="flex flex-wrap gap-1.5 sm:gap-2">
                                  {question.options.slice(0, 2).map((option, optIndex) => (
                                    <span
                                      key={optIndex}
                                      className="inline-flex items-center px-2 sm:px-3 py-1 sm:py-1.5 rounded-full text-xs font-medium bg-muted/70 border hover:bg-muted transition-colors break-words"
                                    >
                                      {option}
                                    </span>
                                  ))}
                                  {question.options.length > 2 && (
                                    <span className="inline-flex items-center px-2 sm:px-3 py-1 sm:py-1.5 rounded-full text-xs font-medium bg-primary/10 border border-primary/30 text-primary">
                                      +{question.options.length - 2} more
                                    </span>
                                  )}
                                </div>
                              </div>
                            )}

                            {/* Action Buttons */}
                            <div className="flex items-center justify-end gap-1.5 sm:gap-2 pt-3 sm:pt-4 border-t flex-shrink-0 mt-auto">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  openEditDialog(question)
                                }}
                                className="h-8 sm:h-9 px-2 sm:px-3 hover:bg-primary/10 hover:text-primary transition-all text-xs"
                                title="Edit all instances of this question"
                              >
                                <Edit className="h-3.5 w-3.5 sm:h-4 sm:w-4 sm:mr-1.5" />
                                <span className="hidden sm:inline text-xs font-medium">Edit</span>
                              </Button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )
          })()}
        </div>
      </div>

      <Dialog open={isExcelImportDialogOpen} onOpenChange={setIsExcelImportDialogOpen}>
        <DialogContent className="w-[95vw] sm:w-[80vw] max-w-4xl max-h-[90vh] overflow-hidden flex flex-col mx-2 sm:mx-4">
          <DialogHeader>
            <DialogTitle>Import Evaluation Questions from Excel</DialogTitle>
            <DialogDescription>
              Upload an Excel file containing evaluation questions. The system will automatically detect questions from 6 sections:
              <br />• A. Instructional Competence (40%)
              <br />• B. Classroom Management (20%)
              <br />• C. Professionalism and Personal Qualities (20%)
              <br />• D. Student Support and Development (10%)
              <br />• E. Research (10%)
              <br />• F. Comments (text response)
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-auto space-y-6 py-4">
            {/* File Upload Section */}
            <div className="space-y-4">
              <div className="grid gap-2">
                <Label htmlFor="excel-file">Select Excel File</Label>
                <div className="flex items-center gap-4">
                  <Input
                    id="excel-file"
                    type="file"
                    accept=".xlsx,.xls"
                    onChange={handleExcelFileSelect}
                    className="flex-1"
                  />
                  <Button
                    onClick={handleReadExcel}
                    disabled={!excelFile || isParsingExcel}
                    className="min-w-[120px]"
                  >
                    {isParsingExcel ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                        Reading...
                      </>
                    ) : (
                      <>
                        <FileText className="mr-2 h-4 w-4" />
                        Read Excel
                      </>
                    )}
                  </Button>
                </div>
                {excelFile && (
                  <div className="text-sm text-muted-foreground">
                    Selected: {excelFile.name} ({(excelFile.size / 1024 / 1024).toFixed(2)} MB)
                  </div>
                )}
              </div>
            </div>

          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsExcelImportDialogOpen(false)}>
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-4xl mx-4 max-w-[calc(100vw-2rem)] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Evaluation Question</DialogTitle>
            <DialogDescription>
              Update question information. <strong className="text-primary">Note:</strong> Changes will apply to ALL professors with the same question.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="edit-question">Question Text</Label>
              <Textarea
                id="edit-question"
                value={questionText}
                onChange={(e) => setQuestionText(e.target.value)}
                rows={3}
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="edit-type">Question Type</Label>
              <Select value={questionType} onValueChange={handleQuestionTypeChange}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Likert Scale">Likert Scale</SelectItem>
                  <SelectItem value="text">Text Response</SelectItem>
                </SelectContent>
              </Select>
            </div>

          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleEditQuestion} disabled={!questionText.trim()}>
              Update All Similar Questions
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Custom Full-Screen Modal */}
      {isProfessorQuestionsDialogOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="relative w-[85vw] h-[85vh] bg-background overflow-hidden flex flex-col border rounded-lg">
            {/* Custom Header */}
            <div className="bg-gray-800 text-white p-6">
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="text-2xl font-bold text-white">
                    {selectedProfessorForView?.name}
                  </h1>
                  <p className="text-gray-300 text-sm mt-1">
                    {professorQuestions.length} evaluation question{professorQuestions.length !== 1 ? 's' : ''} for this professor
                  </p>
                </div>
                <button
                  onClick={closeProfessorQuestionsModal}
                  className="w-10 h-10 rounded-lg flex items-center justify-center hover:bg-gray-700 transition-colors text-white"
                  title="Close"
                  aria-label="Close professor questions"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-hidden flex flex-col pt-6 px-6">
              {professorQuestions.length > 0 ? (
                <div className="flex-1 overflow-auto pr-4 -mr-4">
                  <div className="grid gap-6 md:grid-cols-1 lg:grid-cols-2 xl:grid-cols-3">
                    {professorQuestions.map((question, index) => {
                      return (
                        <div key={question.id} className="border rounded-lg bg-white hover:shadow-md transition-shadow flex flex-col">
                          {/* Card Header */}
                          <div className="bg-gray-800 text-white px-4 py-3 border-b flex-shrink-0">
                            <div className="flex items-center justify-between">
                              <div>
                                <h3 className="font-semibold text-sm text-white">
                                  Question #{index + 1}
                                </h3>
                                <p className="text-xs text-gray-300">
                                  {getQuestionTypeLabel(question.questionType)}
                                </p>
                                {question.section && (
                                  <p className="text-xs text-blue-400 font-semibold mt-0.5">
                                    {question.section} {question.weight && `(${question.weight})`}
                                  </p>
                                )}
                              </div>
                              <div className="flex items-center gap-1">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => {
                                    openEditDialog(question)
                                    closeProfessorQuestionsModal()
                                  }}
                                  title="Edit question"
                                  className="h-8 w-8 p-0 text-white hover:bg-gray-700"
                                >
                                  <Edit className="h-4 w-4" />
                                </Button>
                                <AlertDialog>
                                  <AlertDialogTrigger asChild>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      title="Delete question"
                                      className="h-8 w-8 p-0 text-white hover:bg-gray-700"
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </AlertDialogTrigger>
                                  <AlertDialogContent>
                                    <AlertDialogHeader>
                                      <AlertDialogTitle>Delete Question</AlertDialogTitle>
                                      <AlertDialogDescription>
                                        Are you sure you want to delete this question: "{question.questionText}"?
                                        <br /><br />
                                        <strong className="text-destructive">Note:</strong> This will delete ALL instances of this question across ALL professors.
                                      </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                                      <AlertDialogAction
                                        onClick={() => {
                                          handleDeleteQuestion(question.id)
                                          closeProfessorQuestionsModal()
                                        }}
                                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                      >
                                        Delete All
                                      </AlertDialogAction>
                                    </AlertDialogFooter>
                                  </AlertDialogContent>
                                </AlertDialog>
                              </div>
                            </div>
                          </div>

                          {/* Card Content */}
                          <div className="p-4 flex-1 flex flex-col">
                            <div className="mb-4">
                              <h4 className="text-sm leading-relaxed break-words">
                                {question.questionText}
                              </h4>
                            </div>

                            {/* Question Options Preview */}
                            {question.options && question.options.length > 0 && (
                              <div className="mt-auto">
                                <p className="text-xs text-muted-foreground mb-2">
                                  Response Options:
                                </p>
                                <div className="flex flex-wrap gap-1">
                                  {question.options.slice(0, 3).map((option, optIndex) => (
                                    <span
                                      key={optIndex}
                                      className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-muted border"
                                    >
                                      {option}
                                    </span>
                                  ))}
                                  {question.options.length > 3 && (
                                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-muted border text-muted-foreground">
                                      +{question.options.length - 3}
                                    </span>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              ) : (
                <div className="flex-1 flex items-center justify-center">
                  <div className="text-center py-12">
                    <List className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <h3 className="text-lg font-semibold mb-2">No Questions Yet</h3>
                    <p className="text-sm text-muted-foreground mb-6">
                      {selectedProfessorForView?.name} doesn't have any evaluation questions yet.
                    </p>
                    <Button
                      onClick={() => {
                        if (selectedProfessorForView) {
                          setSelectedProfessorId(selectedProfessorForView.id)
                          closeProfessorQuestionsModal()
                          setIsAddDialogOpen(true)
                        }
                      }}
                      size="default"
                    >
                      <Plus className="mr-2 h-4 w-4" />
                      Create First Question
                    </Button>
                  </div>
                </div>
              )}
            </div>

            {/* Custom Footer */}

          </div>
        </div>
      )}

      {/* Preview Excel Data - Window Popup */}
      {isPreviewOpen && parsedQuestions.length > 0 && (
        <>
          {/* Backdrop with blur */}
          <div
            className="fixed inset-0 bg-black/30 backdrop-blur-sm z-40"
            onClick={() => {
              setIsPreviewOpen(false)
              setExcelFile(null)
              setParsedQuestions([])
              setNewQuestions([])
              setDuplicateQuestions([])
            }}
          />
          {/* Popup Window */}
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="w-full max-w-[95vw] max-h-[68vh] bg-card border rounded-lg shadow-lg flex flex-col">
              {/* Header */}
              <div className="flex items-center justify-between p-6 border-b flex-shrink-0">
                <div>
                  <h3 className="text-lg font-semibold">Preview Excel Data</h3>
                  <p className="text-sm text-muted-foreground">
                    Review the questions from Excel before importing. Total: {parsedQuestions.length} questions
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex gap-2">
                    <Badge variant="secondary">
                      {parsedQuestions.length} total
                    </Badge>
                    <Badge variant="default" className="bg-green-600">
                      {newQuestions.length} new
                    </Badge>
                    {duplicateQuestions.length > 0 && (
                      <Badge variant="outline" className="text-blue-600 border-blue-600">
                        {duplicateQuestions.length} existing
                      </Badge>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0"
                    onClick={() => {
                      setIsPreviewOpen(false)
                      setExcelFile(null)
                      setParsedQuestions([])
                      setNewQuestions([])
                      setDuplicateQuestions([])
                    }}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {/* Content */}
              <div className="flex-1 overflow-y-auto p-6">
                {/* Duplicate Information */}
                {duplicateQuestions.length > 0 && (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
                    <div className="flex items-start gap-2">
                      <div className="w-4 h-4 bg-blue-500 rounded-full flex items-center justify-center mt-0.5">
                        <span className="text-white text-xs font-bold">i</span>
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-medium text-blue-800">
                          {duplicateQuestions.length} question{duplicateQuestions.length !== 1 ? 's' : ''} already exist
                        </p>
                        <p className="text-xs text-blue-700 mt-1">
                          These questions are already in the database and will be skipped during import. Only new questions will be added.
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Import Progress */}
                {isImportingQuestions && (
                  <div className="sticky top-0 z-10 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/50 dark:to-indigo-950/50 border-2 border-blue-200 dark:border-blue-800 rounded-xl p-6 mb-6 shadow-lg">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <div className="relative">
                          <div className="w-10 h-10 rounded-full bg-blue-500 flex items-center justify-center">
                            <Upload className="w-5 h-5 text-white animate-bounce" />
                          </div>
                          <div className="absolute inset-0 rounded-full bg-blue-500/30 animate-ping"></div>
                        </div>
                        <div>
                          <h3 className="text-xl font-bold text-blue-900 dark:text-blue-100">
                            Importing Questions...
                          </h3>
                          <p className="text-sm text-blue-700 dark:text-blue-300">
                            Please wait while we add questions for all professors
                          </p>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Badge variant="default" className="bg-green-600 text-white px-3 py-1 text-sm">
                          ✓ {importedCount} imported
                        </Badge>
                        {skippedCount > 0 && (
                          <Badge variant="outline" className="text-blue-600 border-blue-600 px-3 py-1 text-sm">
                            ⏭ {skippedCount} skipped
                          </Badge>
                        )}
                      </div>
                    </div>
                    <div className="space-y-3">
                      <div className="flex justify-between text-sm font-medium">
                        <span className="text-blue-800 dark:text-blue-200">Progress</span>
                        <span className="text-blue-900 dark:text-blue-100 font-bold text-lg">{importProgress}%</span>
                      </div>
                      <div className="w-full bg-blue-200 dark:bg-blue-900 rounded-full h-4 overflow-hidden">
                        <div
                          className="bg-gradient-to-r from-blue-500 via-blue-600 to-indigo-600 h-4 rounded-full transition-all duration-300 relative"
                          style={{ width: `${importProgress}%` }}
                        >
                          <div className="absolute inset-0 bg-white/20 animate-pulse"></div>
                        </div>
                      </div>
                      <p className="text-sm text-blue-700 dark:text-blue-300 text-center">
                        Creating <span className="font-bold">{newQuestions.length}</span> new questions for all <span className="font-bold">{professors.length}</span> professors
                        {duplicateQuestions.length > 0 && (
                          <span className="text-blue-500 ml-2">
                            ({duplicateQuestions.length} existing will be skipped)
                          </span>
                        )}
                      </p>
                    </div>
                  </div>
                )}

                {/* Questions Table */}
                <div className="w-full overflow-x-auto">
                  <Table className="w-full">
                    <TableHeader>
                      <TableRow>
                        <TableHead className="min-w-[200px]">Section</TableHead>
                        <TableHead className="min-w-[400px]">Question</TableHead>
                        <TableHead className="min-w-[100px]">Weight</TableHead>
                        <TableHead className="min-w-[120px]">Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {parsedQuestions.map((question, index) => {
                        const isNew = newQuestions.some(q => q.questionText === question.questionText)
                        const isDuplicate = duplicateQuestions.some(q => q.questionText === question.questionText)
                        return (
                          <TableRow key={index}>
                            <TableCell>
                              <Badge variant="outline" className="text-xs">
                                {question.section || 'Unknown'}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <div className="text-sm" title={question.questionText}>
                                {question.questionText}
                              </div>
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                              {question.weight || 'N/A'}
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

              {/* Footer */}
              <div className="border-t p-6 flex-shrink-0 flex items-center justify-end gap-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setIsPreviewOpen(false)
                    setExcelFile(null)
                    setParsedQuestions([])
                    setNewQuestions([])
                    setDuplicateQuestions([])
                  }}
                  disabled={isImportingQuestions}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleImportQuestions}
                  disabled={parsedQuestions.length === 0 || isImportingQuestions}
                  className="min-w-[140px]"
                >
                  {isImportingQuestions ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Importing...
                    </>
                  ) : (
                    <>
                      <Upload className="mr-2 h-4 w-4" />
                      Import Questions
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
