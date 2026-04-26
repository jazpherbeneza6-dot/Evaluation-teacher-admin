"use client"

/*
 * EVALUATION HISTORY MANAGEMENT - View archived evaluation results
 * 
 * HIERARCHY:
 * 1. Year folders (2026, 2025, etc.)
 * 2. Date range folders (Jan 15 - Feb 15)
 * 3. Professor folders
 * 4. Individual results with charts
 */

import { useState, useEffect, useMemo, Fragment } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

import {
    FolderOpen,
    Calendar,
    ArrowLeft,
    Users,
    BarChart3,
    ChevronRight,
    Loader2,
    Trash2,
    AlertCircle,
    Search,
    FileDown,
    Trophy,
    Award,
    Star,
    TrendingUp,
    MoreHorizontal,
    ArrowUpDown,
    FileText,
    Folder
} from "lucide-react"
import jsPDF from "jspdf"

import { evaluationHistoryService, type HistoryByYear, type EvaluationHistoryEntry } from "@/lib/evaluation-history-service"
import { evaluationResultsService, type TopProfessorData } from "@/lib/evaluation-results-service"
import type { EvaluationQuestion, Professor } from "@/lib/types"
import { useToast } from "@/hooks/use-toast"
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog"

// Declare global variables for Google Charts
declare global {
    interface Window {
        google: any
    }
}

// Chart colors
const chartColors = [
    "#3b82f6", // blue
    "#10b981", // emerald
    "#f59e0b", // amber
    "#ef4444", // red
    "#8b5cf6", // violet
    "#06b6d4", // cyan
    "#84cc16", // lime
]

const SECTION_ORDER = [
    "A. Instructional Competence",
    "Instructional Competence",
    "B. Classroom Management",
    "Classroom Management",
    "C. Professionalism & Personal Qualities",
    "Professionalism & Personal Qualities",
    "D. Student Support & Development",
    "Student Support & Development",
    "E. Research",
    "Research",
    "F. Comments",
    "Comments",
]

// Helper function to normalize section names for comparison
// Strips prefix (A., B., etc.), converts to lowercase, and normalizes & to "and"
const normalizeSectionName = (name: string) => {
    let result = name
        .replace(/^[A-F]\.\s*/, "")  // Remove prefix like "A. ", "B. ", ..., "F. "
        .replace(/&/g, "and")         // Normalize & to "and"
        .toLowerCase()
        .trim()
    // Map old "verbal interpretation" to "comments"
    if (result === "verbal interpretation") result = "comments"
    return result
}

// Helper function to check if two section names match (with or without prefix, & vs and)
const sectionMatches = (section1: string, section2: string) => {
    return normalizeSectionName(section1) === normalizeSectionName(section2)
}




const SECTION_COLORS: Record<string, { bg: string; border: string; text: string }> = {
    "A. Instructional Competence": { bg: "bg-blue-50", border: "border-blue-500", text: "text-blue-700" },
    "Instructional Competence": { bg: "bg-blue-50", border: "border-blue-500", text: "text-blue-700" },
    "B. Classroom Management": { bg: "bg-green-50", border: "border-green-500", text: "text-green-700" },
    "Classroom Management": { bg: "bg-green-50", border: "border-green-500", text: "text-green-700" },
    "C. Professionalism & Personal Qualities": { bg: "bg-purple-50", border: "border-purple-500", text: "text-purple-700" },
    "Professionalism & Personal Qualities": { bg: "bg-purple-50", border: "border-purple-500", text: "text-purple-700" },
    "D. Student Support & Development": { bg: "bg-orange-50", border: "border-orange-500", text: "text-orange-700" },
    "Student Support & Development": { bg: "bg-orange-50", border: "border-orange-500", text: "text-orange-700" },
    "E. Research": { bg: "bg-pink-50", border: "border-pink-500", text: "text-pink-700" },
    "Research": { bg: "bg-pink-50", border: "border-pink-500", text: "text-pink-700" },
    "F. Comments": { bg: "bg-teal-50", border: "border-teal-500", text: "text-teal-700" },
    "Comments": { bg: "bg-teal-50", border: "border-teal-500", text: "text-teal-700" },

}

// Navigation levels
type ViewLevel = "years" | "history-type-selection" | "semester-selection" | "periods" | "departments" | "professors" | "results" | "performance-rankings"

interface EvaluationHistoryManagementProps {
    questions: EvaluationQuestion[]
    professors: Professor[]
}

// Question aggregate type for chart rendering
type QuestionAggregate = {
    questionId: string
    questionText: string
    questionType: string
    options: string[]
    counts: Record<string, number>
    textResponses?: string[]
    section?: string
}

export function EvaluationHistoryManagement({ questions, professors }: EvaluationHistoryManagementProps) {
    const { toast } = useToast()

    // State
    const [isLoading, setIsLoading] = useState(true)
    const [historyByYears, setHistoryByYears] = useState<HistoryByYear[]>([])
    const [viewLevel, setViewLevel] = useState<ViewLevel>("years")
    const [selectedYear, setSelectedYear] = useState<number | null>(null)
    const [selectedPeriodId, setSelectedPeriodId] = useState<string | null>(null)
    const [selectedPeriod, setSelectedPeriod] = useState<EvaluationHistoryEntry | null>(null)
    const [selectedProfessorId, setSelectedProfessorId] = useState<string | null>(null)
    const [googleChartsLoaded, setGoogleChartsLoaded] = useState(false)
    const [questionAggregates, setQuestionAggregates] = useState<Record<string, QuestionAggregate>>({})
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
    const [periodToDelete, setPeriodToDelete] = useState<string | null>(null)
    const [searchQuery, setSearchQuery] = useState("")
    const [selectedSection, setSelectedSection] = useState<string | null>(null)
    const [periodsSearch, setPeriodsSearch] = useState("")
    const [professorsSearch, setProfessorsSearch] = useState("")
    const [yearsSearch, setYearsSearch] = useState("")
    const [selectedDepartment, setSelectedDepartment] = useState<string | null>(null)
    const [departmentsSearch, setDepartmentsSearch] = useState("")
    const [historyType, setHistoryType] = useState<"evaluation" | "performance" | null>(null)
    const [performanceSearch, setPerformanceSearch] = useState("")
    const [performanceSortBy, setPerformanceSortBy] = useState<"score" | "name" | "department">("score")
    const [performanceSortOrder, setPerformanceSortOrder] = useState<"asc" | "desc">("desc")
    const [performanceCategory, setPerformanceCategory] = useState<string>("Instructional Competence")
    const [selectedSemesterFilter, setSelectedSemesterFilter] = useState<"all" | "1st" | "2nd">("all")

    // Load history data
    useEffect(() => {
        const loadHistory = async () => {
            setIsLoading(true)
            try {
                const data = await evaluationHistoryService.getHistoryByYears()
                setHistoryByYears(data)
            } catch (error) {
                console.error("Error loading history:", error)
                toast({
                    title: "Error",
                    description: "Failed to load evaluation history",
                    variant: "destructive"
                })
            } finally {
                setIsLoading(false)
            }
        }
        loadHistory()
    }, [toast])

    // Load Google Charts
    useEffect(() => {
        const loadGoogleCharts = () => {
            if (window.google && window.google.charts) {
                window.google.charts.load("current", { packages: ["corechart"] })
                window.google.charts.setOnLoadCallback(() => {
                    setGoogleChartsLoaded(true)
                })
            } else {
                const script = document.createElement("script")
                script.src = "https://www.gstatic.com/charts/loader.js"
                script.onload = () => {
                    window.google.charts.load("current", { packages: ["corechart"] })
                    window.google.charts.setOnLoadCallback(() => {
                        setGoogleChartsLoaded(true)
                    })
                }
                document.head.appendChild(script)
            }
        }
        loadGoogleCharts()
    }, [])

    // Get periods for selected year
    const periodsForYear = useMemo(() => {
        if (selectedYear === null) return []
        const yearData = historyByYears.find(y => y.year === selectedYear)
        const allPeriods = yearData?.periods || []
        // Filter by semester if selected
        if (selectedSemesterFilter === "all") return allPeriods
        return allPeriods.filter(p => p.semester === selectedSemesterFilter)
    }, [historyByYears, selectedYear, selectedSemesterFilter])

    // Get departments for selected period (unique list)
    const departmentsForPeriod = useMemo(() => {
        if (!selectedPeriod) return []
        const allProfessors = selectedPeriod.professorEvaluations || []
        const uniqueDepartments = [...new Set(allProfessors.map(p => p.departmentName))].filter(Boolean)
        return uniqueDepartments.sort()
    }, [selectedPeriod])

    // Get professors for selected department
    const professorsForDepartment = useMemo(() => {
        if (!selectedPeriod || !selectedDepartment) return []
        return (selectedPeriod.professorEvaluations || []).filter(p => p.departmentName === selectedDepartment)
    }, [selectedPeriod, selectedDepartment])

    // Get selected professor data
    const selectedProfessorData = useMemo(() => {
        if (!selectedPeriod || !selectedProfessorId) return null
        return selectedPeriod.professorEvaluations.find(p => p.professorId === selectedProfessorId) || null
    }, [selectedPeriod, selectedProfessorId])

    // Handle year selection
    const handleYearClick = (year: number) => {
        setSelectedYear(year)
        setViewLevel("history-type-selection")
    }

    // Handle history type selection
    const handleHistoryTypeSelect = (type: "evaluation" | "performance") => {
        setHistoryType(type)
        setViewLevel("semester-selection")
    }

    // Handle semester selection
    const handleSemesterSelect = (semester: "1st" | "2nd") => {
        setSelectedSemesterFilter(semester)
        setViewLevel("periods")
    }

    // Handle period selection
    const handlePeriodClick = async (periodId: string) => {
        setSelectedPeriodId(periodId)
        setIsLoading(true)
        try {
            const periodData = await evaluationHistoryService.getHistoryById(periodId)
            setSelectedPeriod(periodData)

            if (historyType === "performance") {
                setViewLevel("performance-rankings")
            } else {
                setViewLevel("departments")
            }
        } catch (error) {
            console.error("Error loading period:", error)
            toast({
                title: "Error",
                description: "Failed to load period data",
                variant: "destructive"
            })
        } finally {
            setIsLoading(false)
        }
    }

    // Handle department selection
    const handleDepartmentClick = (departmentName: string) => {
        setSelectedDepartment(departmentName)
        setViewLevel("professors")
    }

    // Handle professor selection
    const handleProfessorClick = (professorId: string) => {
        setSelectedProfessorId(professorId)
        setViewLevel("results")
    }

    // Go back function
    const goBack = () => {
        if (viewLevel === "results") {
            setSelectedProfessorId(null)
            setSearchQuery("")  // Reset search when leaving results
            setSelectedSection(null)  // Reset section filter when leaving results
            setViewLevel("professors")
        } else if (viewLevel === "professors") {
            setSelectedDepartment(null)
            setProfessorsSearch("")  // Reset professors search
            setViewLevel("departments")
        } else if (viewLevel === "departments") {
            setSelectedPeriod(null)
            setSelectedPeriodId(null)
            setDepartmentsSearch("")  // Reset departments search
            setViewLevel("periods")
        } else if (viewLevel === "performance-rankings") {
            setSelectedPeriod(null)
            setSelectedPeriodId(null)
            setPerformanceSearch("")
            setViewLevel("periods")
        } else if (viewLevel === "periods") {
            setSelectedSemesterFilter("all")
            setPeriodsSearch("")  // Reset periods search
            setViewLevel("semester-selection")
        } else if (viewLevel === "semester-selection") {
            setHistoryType(null)
            setViewLevel("history-type-selection")
        } else if (viewLevel === "history-type-selection") {
            setSelectedYear(null)
            setViewLevel("years")
        }
    }


    // Handle delete period
    const handleDeletePeriod = async () => {
        if (!periodToDelete) return
        try {
            const success = await evaluationHistoryService.deleteHistoryPeriod(periodToDelete)
            if (success) {
                toast({
                    title: "Deleted",
                    description: "History period deleted successfully"
                })
                // Refresh data
                const data = await evaluationHistoryService.getHistoryByYears()
                setHistoryByYears(data)
            } else {
                throw new Error("Delete failed")
            }
        } catch (error) {
            toast({
                title: "Error",
                description: "Failed to delete history period",
                variant: "destructive"
            })
        } finally {
            setDeleteDialogOpen(false)
            setPeriodToDelete(null)
        }
    }

    // Process evaluation data for charts
    useEffect(() => {
        if (viewLevel !== "results" || !selectedProfessorData) return

        const evaluations = selectedProfessorData.evaluations || []
        const aggregates: Record<string, QuestionAggregate> = {}

        evaluations
            .filter((e) => (e.evaluationStatus as any) === "submitted")
            .forEach((evaluation) => {
                (evaluation.responses || []).forEach((response: any) => {
                    const qid = response.questionId
                    if (!aggregates[qid]) {
                        let baseOptions = Array.isArray(response.options) ? response.options : []
                        // Force standard order for Likert Scale to ensure consistency even with existing data
                        if (String(response.questionType).toLowerCase() === "likert scale") {
                            baseOptions = ["Poor", "Fair", "Satisfactory", "Very Satisfactory", "Excellent"]
                        }
                        const initialCounts: Record<string, number> = {}
                        baseOptions.forEach((opt: string) => {
                            initialCounts[String(opt)] = 0
                        })
                        aggregates[qid] = {
                            questionId: qid,
                            questionText: response.questionText,
                            questionType: response.questionType,
                            options: baseOptions,
                            counts: initialCounts,
                            textResponses: [],
                            section: response.section || "Other",
                        }
                    }
                    if (response.questionType === "text") {
                        if (response.answer && String(response.answer).trim()) {
                            aggregates[qid].textResponses!.push(String(response.answer))
                        }
                    } else if (String(response.questionType).toLowerCase() === "likert scale") {
                        let answerKey = String(response.answer)
                        const answerIndex = parseInt(answerKey, 10)

                        // If answer is an index, resolve it using the original options
                        if (!isNaN(answerIndex) && Array.isArray(response.options) && response.options[answerIndex]) {
                            answerKey = response.options[answerIndex]
                        }

                        // Normalize to match our standard baseOptions labels
                        const normalized = answerKey.toLowerCase()
                        if (normalized === "excellent") answerKey = "Excellent"
                        else if (normalized.includes("very satisfactory") || normalized === "verysatisfactory") answerKey = "Very Satisfactory"
                        else if (normalized === "satisfactory") answerKey = "Satisfactory"
                        else if (normalized === "fair") answerKey = "Fair"
                        else if (normalized === "poor") answerKey = "Poor"

                        aggregates[qid].counts[answerKey] = (aggregates[qid].counts[answerKey] || 0) + 1
                    } else {
                        const answerKey = String(response.answer)
                        aggregates[qid].counts[answerKey] = (aggregates[qid].counts[answerKey] || 0) + 1
                    }
                })
            })

        setQuestionAggregates(aggregates)
    }, [selectedProfessorData, viewLevel])

    // Draw charts when data or view changes
    useEffect(() => {
        if (!googleChartsLoaded || viewLevel !== "results") return
        const aggs = Object.values(questionAggregates)
        if (aggs.length === 0) return

        const drawCharts = () => {
            aggs.forEach((ag) => {
                const order = ag.options && ag.options.length > 0 ? ag.options : Object.keys(ag.counts)
                drawPieChart(ag.questionId, ag.counts, order)
                drawBarChart(ag.questionId, ag.counts, order)
            })
        }

        // Reduced delay for faster chart rendering
        const id = setTimeout(drawCharts, 10)
        return () => clearTimeout(id)
    }, [questionAggregates, googleChartsLoaded, viewLevel, selectedSection])



    // Draw pie chart function
    const drawPieChart = (questionId: string, counts: Record<string, number>, order: string[]) => {
        const el = document.getElementById(`history-pie-chart-${questionId}`)
        if (!el || !window.google) return

        el.innerHTML = ''
        const data = new window.google.visualization.DataTable()
        data.addColumn("string", "Response")
        data.addColumn("number", "Count")

        order.forEach((answer) => {
            data.addRow([answer, counts[answer] || 0])
        })

        const options = {
            title: "Response Distribution",
            titleTextStyle: { fontSize: 14, bold: true, color: "#1e3a8a" },
            pieHole: 0.4,
            colors: chartColors.slice(0, order.length),
            backgroundColor: "transparent",
            legend: { position: "bottom", textStyle: { fontSize: 11 }, alignment: "center" },
            chartArea: { width: "100%", height: "75%", left: 0, top: "12%" },
            pieSliceBorderColor: "white",
            pieSliceTextStyle: { color: "white", fontSize: 12, bold: true },
        }

        const chart = new window.google.visualization.PieChart(el)
        chart.draw(data, options)
    }

    // Draw bar chart function
    const drawBarChart = (questionId: string, counts: Record<string, number>, order: string[]) => {
        const el = document.getElementById(`history-bar-chart-${questionId}`)
        if (!el || !window.google) return

        el.innerHTML = ''
        const data = new window.google.visualization.DataTable()
        data.addColumn("string", "Answer")
        data.addColumn("number", "Count")

        order.forEach((answer) => {
            data.addRow([answer, counts[answer] || 0])
        })

        const options = {
            title: "Answer Distribution",
            titleTextStyle: { fontSize: 13, bold: true, color: "#374151" },
            backgroundColor: "transparent",
            hAxis: {
                title: "Answers",
                textStyle: { fontSize: 10 },
                slantedText: true,
                slantedTextAngle: 45
            },
            vAxis: { title: "Count", minValue: 0, format: "0" },
            colors: [chartColors[0]],
            chartArea: { width: "75%", height: "60%", left: "15%", top: "15%" },
            legend: { position: "none" },
            bar: { groupWidth: "60%" },
        }

        const chart = new window.google.visualization.ColumnChart(el)
        chart.draw(data, options)
    }

    // Helper function to generate PDF content for a single professor
    const generatePDFContent = (doc: jsPDF, profName: string, deptName: string, aggs: QuestionAggregate[], period: EvaluationHistoryEntry | null) => {
        const pageWidth = doc.internal.pageSize.getWidth()
        const pageHeight = doc.internal.pageSize.getHeight()

        // Helper: truncate text
        const truncateText = (text: string, maxWidth: number): string => {
            if (doc.getTextWidth(text) <= maxWidth) return text
            let t = text
            while (t.length > 0 && doc.getTextWidth(t + "...") > maxWidth) {
                t = t.slice(0, -1)
            }
            return t + "..."
        }

        // Title
        doc.setFontSize(18)
        doc.setFont("helvetica", "bold")
        doc.setTextColor(30, 41, 59)
        doc.text("Professor Evaluation Results", 20, 22)

        // Evaluation Period on the right (aligned with professor name)
        let periodText = ""
        let periodWidth = 0
        if (period) {
            const startDate = new Date(period.startDate)
            const endDate = new Date(period.endDate)
            const dateOptions: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric', year: 'numeric' }
            const semesterLabel = period.semester ? (period.semester === "1st" ? "1st Semester" : "2nd Semester") : ""
            periodText = `Period: ${startDate.toLocaleDateString('en-US', dateOptions)} - ${endDate.toLocaleDateString('en-US', dateOptions)}${semesterLabel ? ` | ${semesterLabel}` : ""}`

            doc.setFontSize(10)
            doc.setTextColor(100, 116, 139)
            periodWidth = doc.getTextWidth(periodText)
            doc.text(periodText, pageWidth - periodWidth - 20, 30)
        }

        doc.setFontSize(12)
        doc.setFont("helvetica", "bold")
        doc.setTextColor(100, 116, 139)
        const profDisplay = profName.toUpperCase() + (deptName ? ` | ${deptName.toUpperCase()}` : "")
        // Truncate professor display to prevent overlap with period text
        const availableWidth = pageWidth - periodWidth - 45 // 45 units for margins and gap
        const truncatedProf = truncateText(profDisplay, availableWidth)
        doc.text(truncatedProf, 20, 30)

        // Group aggregates by section
        const grouped: Record<string, QuestionAggregate[]> = {}
        aggs.forEach(q => {
            const section = q.section || "Other"
            if (!grouped[section]) grouped[section] = []
            grouped[section].push(q)
        })

        // Sort sections
        const sortedSecs = Object.keys(grouped).sort((a, b) => {
            const ai = SECTION_ORDER.findIndex(s => s.toLowerCase() === a.toLowerCase())
            const bi = SECTION_ORDER.findIndex(s => s.toLowerCase() === b.toLowerCase())
            if (ai === -1 && bi === -1) return 0
            if (ai === -1) return 1
            if (bi === -1) return -1
            return ai - bi
        })

        // --- Overall Performance Summary Table ---
        let y = 40
        doc.setFontSize(13)
        doc.setFont("helvetica", "bold")
        doc.setTextColor(30, 41, 59)
        doc.text("Overall Performance Summary", 20, y)
        y += 10

        // Table header
        doc.setFillColor(51, 65, 85)
        doc.rect(20, y - 6, pageWidth - 40, 10, "F")
        doc.setFontSize(11)
        doc.setTextColor(255, 255, 255)
        doc.text("Section Name", 24, y)
        doc.text("Avg. Score", pageWidth - 24, y, { align: "right" })
        y += 8

        doc.setTextColor(30, 30, 30)
        doc.setFont("helvetica", "normal")

        // Weights map
        const weights: Record<string, number> = {
            "Instructional Competence": 0.4,
            "Classroom Management": 0.2,
            "Professionalism and Personal Qualities": 0.2,
            "Personal and Professional Qualities": 0.2,
            "Professionalism & Personal Qualities": 0.2,
            "Personal & Professional Qualities": 0.2,
            "Student Support and Development": 0.1,
            "Student Engagement and Assessment": 0.1,
            "Student Engagement & Assessment": 0.1,
            "Student Support & Development": 0.1,
            "Research": 0.1,
            "E. Research": 0.1
        }

        let finalWeightedRating = 0
        let totalDefinedWeights = 0

        sortedSecs.forEach((sec, idx) => {
            const secQuestions = grouped[sec]
            // Skip Comments
            if (sec.toLowerCase().includes("comment")) return

            const cleanName = sec.replace(/^[A-F]\.\s*/, "").trim()
            const weight = weights[cleanName] || 0

            let secWeightedSum = 0
            let secTotalResponses = 0

            secQuestions.forEach(q => {
                if (q.questionType !== "text") {
                    const opts = q.options || ["Poor", "Fair", "Satisfactory", "Very Satisfactory", "Excellent"]
                    let weightedScore = 0
                    let count = 0

                    opts.forEach((opt, oi) => {
                        const val = q.counts[opt] || 0
                        const label = opt.toLowerCase()
                        let score = 0
                        if (label.includes("excellent") || label.includes("strongly agree") || label === "5") score = 5
                        else if (label.includes("very satisfactory") || label.includes("verysatisfactory") || label.includes("agree") || label === "4") score = 4
                        else if (label.includes("satisfactory") || label.includes("neutral") || label === "3") score = 3
                        else if (label.includes("fair") || label.includes("disagree") || label === "2") score = 2
                        else if (label.includes("poor") || label.includes("strongly disagree") || label === "1") score = 1
                        else if (score === 0) {
                            const firstOpt = opts[0].toLowerCase()
                            if (firstOpt.includes("excellent") || firstOpt.includes("strongly agree")) {
                                score = [5, 4, 3, 2, 1][oi] || 0
                            } else {
                                score = [1, 2, 3, 4, 5][oi] || 0
                            }
                        }

                        weightedScore += val * score
                        count += val
                    })

                    secWeightedSum += weightedScore
                    secTotalResponses += count
                }
            })

            const secAvg = secTotalResponses > 0 ? secWeightedSum / secTotalResponses : 0
            const secWeighted = secAvg * weight

            finalWeightedRating += secWeighted
            if (weight > 0) totalDefinedWeights += weight

            if (idx % 2 === 0) {
                doc.setFillColor(248, 248, 248)
                doc.rect(20, y - 5, pageWidth - 40, 8, "F")
            }

            doc.text(cleanName, 24, y)
            doc.setFont("helvetica", "bold")
            doc.text(secAvg.toFixed(2), pageWidth - 24, y, { align: "right" })
            doc.setFont("helvetica", "normal")
            y += 8
        })

        doc.setFillColor(51, 65, 85)
        doc.rect(20, y - 6, pageWidth - 40, 10, "F")
        doc.setTextColor(255, 255, 255)
        doc.setFont("helvetica", "bold")
        doc.setFontSize(12)
        doc.text("Final Rating", 24, y)
        doc.setFontSize(12)
        doc.text(finalWeightedRating.toFixed(2), pageWidth - 24, y, { align: "right" })
        doc.setTextColor(30, 41, 59)
        y += 18

        // --- Rating Scale Description Box ---
        const boxY = y - 6
        const boxH = 46
        doc.setFillColor(248, 250, 252)
        doc.setDrawColor(226, 232, 240)
        doc.roundedRect(20, boxY, pageWidth - 40, boxH, 2, 2, "FD")

        doc.setFontSize(10)
        doc.setFont("helvetica", "bold")
        doc.setTextColor(51, 65, 85)
        doc.text("RATING SCALE DESCRIPTION:", 24, boxY + 7)

        doc.setFontSize(8)
        doc.setFont("helvetica", "normal")
        doc.setTextColor(71, 85, 105)
        const scales = [
            "5 – Excellent (consistently demonstrates outstanding classroom management skills)",
            "4 – Very Satisfactory (often manages the class effectively, with minor areas for improvement)",
            "3 – Satisfactory (generally maintains acceptable classroom order and organization)",
            "2 – Fair (occasionally struggles with classroom control or organization)",
            "1 – Poor (rarely demonstrates effective classroom management)"
        ]

        scales.forEach((s, si) => {
            doc.text(s, 24, boxY + 13 + (si * 4.5))
        })

        // Horizontal line
        doc.setDrawColor(226, 232, 240)
        doc.line(24, boxY + 36, pageWidth - 24, boxY + 36)

        doc.setFont("helvetica", "bold")
        doc.text("Column Legend:", 24, boxY + 41)
        doc.setFont("helvetica", "normal")
        doc.text("P = Poor  |  F = Fair  |  S = Satisfactory  |  VS = Very Satisfactory  |  E = Excellent", 54, boxY + 41)

        y += boxH + 8

        // --- Per-section question tables (comments last) ---
        const orderedSecs = [...sortedSecs.filter(s => !s.toLowerCase().includes("comments")), ...sortedSecs.filter(s => s.toLowerCase().includes("comment"))]
        orderedSecs.forEach(sec => {
            const secQuestions = grouped[sec]
            const cleanName = sec.replace(/^[A-F]\.\s*/, "")
            const isVerbal = sec.toLowerCase().includes("comments")

            // Page break threshold for new section
            if (y > pageHeight - 80) {
                doc.addPage()
                y = 18
            }

            // Section constants
            const margin = 20
            const optStartX = pageWidth - 105
            const spacing = 15

            // Section title
            doc.setFontSize(13)
            doc.setFont("helvetica", "bold")
            doc.setTextColor(30, 41, 59)
            doc.text(cleanName, margin, y)
            y += 10

            if (isVerbal) {
                // For Comment, list text responses
                doc.setFontSize(9)
                doc.setFont("helvetica", "normal")
                secQuestions.forEach(q => {
                    doc.setFont("helvetica", "bold")
                    const lines = doc.splitTextToSize(q.questionText, pageWidth - 30)
                    lines.forEach((line: string) => {
                        if (y > pageHeight - 15) { doc.addPage(); y = 18 }
                        doc.text(line, 16, y)
                        y += 5
                    })
                    doc.setFont("helvetica", "normal")
                    if (q.textResponses && q.textResponses.length > 0) {
                        q.textResponses.forEach((txt, i) => {
                            if (y > pageHeight - 15) { doc.addPage(); y = 18 }
                            const respLines = doc.splitTextToSize(`${i + 1}. ${txt}`, pageWidth - 36)
                            respLines.forEach((line: string) => {
                                if (y > pageHeight - 15) { doc.addPage(); y = 18 }
                                doc.text(line, 20, y)
                                y += 5
                            })
                        })
                    } else {
                        doc.text("No text responses.", 20, y)
                        y += 5
                    }
                    y += 4
                })
            } else {
                // Likert questions table
                // Table header
                doc.setFillColor(51, 65, 85)
                const headerH = 10
                doc.rect(margin, y - 6, pageWidth - (margin * 2), headerH, "F")
                doc.setFontSize(10)
                doc.setTextColor(255, 255, 255)
                doc.setFont("helvetica", "bold")
                doc.text("#", margin + 4, y)
                doc.text("Question", margin + 12, y)

                // Option columns
                const labels = ["P", "F", "S", "VS", "E", "Total"]
                labels.forEach((label, oi) => {
                    doc.text(label, optStartX + (oi * spacing), y, { align: "center" })
                })
                y += 8

                doc.setTextColor(30, 30, 30)
                doc.setFont("helvetica", "normal")

                secQuestions.forEach((q, qi) => {
                    if (q.questionType === "text") return

                    doc.setFontSize(9)
                    const maxQWidth = optStartX - (margin + 12) - 10
                    const qLines = doc.splitTextToSize(q.questionText, maxQWidth)
                    const lineH = 4.8
                    const rowH = Math.max(12, qLines.length * lineH + 6)
                    const centerShift = ((qLines.length - 1) * lineH) / 2

                    // Check if row fits on page, if not add new page with header
                    if (y + rowH - 5 > pageHeight - 15) {
                        doc.addPage()
                        y = 18
                        doc.setFillColor(51, 65, 85)
                        doc.rect(margin, y - 6, pageWidth - (margin * 2), headerH, "F")
                        doc.setFontSize(10)
                        doc.setTextColor(255, 255, 255)
                        doc.setFont("helvetica", "bold")
                        doc.text("#", margin + 4, y)
                        // "Question" text omitted for cleaner look on continuation pages

                        const labels = ["P", "F", "S", "VS", "E", "Total"]
                        labels.forEach((label, oi) => {
                            doc.text(label, optStartX + (oi * spacing), y, { align: "center" })
                        })

                        doc.setTextColor(30, 41, 59)
                        doc.setFont("helvetica", "normal")
                        y += 8
                    }

                    // Alternate row background
                    if (qi % 2 === 0) {
                        doc.setFillColor(248, 248, 248)
                        doc.rect(margin, y - 6, pageWidth - (margin * 2), rowH, "F")
                    }

                    doc.setFontSize(9)
                    doc.text(`${qi + 1}`, margin + 4, y + centerShift)
                    // Print each line of the question text
                    qLines.forEach((line: string, li: number) => {
                        doc.text(line, margin + 12, y + (li * lineH))
                    })

                    const opts = ["Poor", "Fair", "Satisfactory", "Very Satisfactory", "Excellent"]
                    const total = Object.values(q.counts).reduce((a, b) => a + b, 0)
                    opts.forEach((opt, oi) => {
                        const count = q.counts[opt] || 0
                        doc.text(`${count}`, optStartX + (oi * spacing), y + centerShift, { align: "center" })
                    })
                    doc.text(`${total}`, optStartX + (5 * spacing), y + centerShift, { align: "center" })
                    y += rowH
                })
            }
            y += 8
        })
    }

    // PDF Export Function
    const handleExportPDF = () => {
        const aggs = Object.values(questionAggregates)
        if (aggs.length === 0) return

        const profName = selectedProfessorData?.professorName || "Professor"
        const deptName = selectedProfessorData?.departmentName || ""

        const doc = new jsPDF({ orientation: "portrait" })
        generatePDFContent(doc, profName, deptName, aggs, selectedPeriod)

        const safeName = profName.replace(/[^a-zA-Z0-9]/g, "_")
        doc.save(`History_${safeName}_evaluation_results.pdf`)
    }

    // Batch Export PDF for Performance Rankings
    const handleExportAllPDF = () => {
        if (!selectedPeriod) return

        const flattenedEvaluations = selectedPeriod.professorEvaluations.flatMap(p => p.evaluations)
        const allByCat = evaluationResultsService.calculateTopPerformingProfessorsByCategory(
            flattenedEvaluations,
            questions,
            999
        )

        const doc = new jsPDF({ orientation: "landscape" })
        const pageWidth = doc.internal.pageSize.getWidth()
        const pageHeight = doc.internal.pageSize.getHeight()

        // Helper: truncate text
        const truncateText = (text: string, maxWidth: number): string => {
            if (doc.getTextWidth(text) <= maxWidth) return text
            let truncated = text
            while (truncated.length > 0 && doc.getTextWidth(truncated + "...") > maxWidth) {
                truncated = truncated.slice(0, -1)
            }
            return truncated + "..."
        }

        // Main Title
        doc.setFontSize(16)
        doc.setFont("helvetica", "bold")
        doc.text(`All Professors Performance Rankings`, 14, 18)
        doc.setFontSize(10)
        doc.setFont("helvetica", "normal")
        doc.setTextColor(120, 120, 120)
        const semesterLabel = selectedPeriod.semester ? (selectedPeriod.semester === "1st" ? "1st Semester" : "2nd Semester") : ""
        doc.text(`Period: ${formatDateRange(selectedPeriod.startDate, selectedPeriod.endDate)}${semesterLabel ? ` | ${semesterLabel}` : ""}`, 14, 26)
        doc.text(`Generated: ${new Date().toLocaleDateString()}`, 14, 32)

        const cats = performanceCategories.map(cat => ({ key: cat, label: cat }))
        const isGrouped = performanceSortBy === "department"

        const colX_grouped = [14, 30, 190, 240]
        const colWidths_grouped = [14, 150, 48, 40]
        const colHeaders_grouped = ["Rank", "Professor", "Performance", "Avg Score"]

        const colX_flat = [14, 30, 110, 190, 240]
        const colWidths_flat = [14, 75, 75, 48, 40]
        const colHeaders_flat = ["Rank", "Professor", "Dept", "Performance", "Avg Score"]

        const colX = isGrouped ? colX_grouped : colX_flat
        const colWidths = isGrouped ? colWidths_grouped : colWidths_flat
        const colHeaders = isGrouped ? colHeaders_grouped : colHeaders_flat
        const rowHeight = 8

        let y = 44
        let isFirstCategory = true

        cats.forEach((category) => {
            const categoryProfessors = allByCat[category.key] || []
            if (categoryProfessors.length === 0) return

            // Sort category professors by score for global ranks
            const globalSorted = [...categoryProfessors].sort((a, b) => {
                const scoreDiff = b.averageRating - a.averageRating
                if (scoreDiff !== 0) return scoreDiff
                return a.professorName.localeCompare(b.professorName)
            })

            const rankMap = new Map<string, number>()
            globalSorted.forEach((p, i) => rankMap.set(p.professorId, i + 1))

            // New page if needed for category header
            if (!isFirstCategory && y > pageHeight - 50) {
                doc.addPage()
                y = 20
            }

            // Category header
            if (!isFirstCategory) y += 8
            doc.setFontSize(14)
            doc.setFont("helvetica", "bold")
            doc.setTextColor(15, 23, 42)
            doc.text(category.label, 14, y)
            y += 4
            doc.setDrawColor(30, 80, 160)
            doc.setLineWidth(1)
            doc.line(14, y, pageWidth - 14, y)
            y += 12

            let isHeaderOnPage = false

            if (isGrouped) {
                // GROUPED BY DEPARTMENT
                const groups: { [dept: string]: TopProfessorData[] } = {}
                categoryProfessors.forEach(p => {
                    const dept = p.departmentName || "General"
                    if (!groups[dept]) groups[dept] = []
                    groups[dept].push(p)
                })

                const sortedDepts = Object.keys(groups).sort((a, b) => {
                    const minRankA = Math.min(...groups[a].map(p => rankMap.get(p.professorId) || 999))
                    const minRankB = Math.min(...groups[b].map(p => rankMap.get(p.professorId) || 999))
                    return minRankA - minRankB
                })

                sortedDepts.forEach((dept) => {
                    const deptProfs = [...groups[dept]].sort((a, b) => b.averageRating - a.averageRating)

                    if (y > pageHeight - 35) {
                        doc.addPage()
                        y = 20
                        isHeaderOnPage = false
                    }

                    // Dept divider - Blue theme matching screenshot
                    doc.setFillColor(239, 246, 255) // Blue-50
                    doc.rect(12, y - 5, pageWidth - 24, 7, "F")
                    doc.setFontSize(8)
                    doc.setFont("helvetica", "bold")
                    doc.setTextColor(30, 64, 175) // Blue-800
                    doc.text(`DEPARTMENT: ${dept.toUpperCase()}`, 14, y)
                    y += 10

                    deptProfs.forEach((professor, idx) => {
                        if (y > pageHeight - 20) {
                            doc.addPage()
                            y = 20
                            isHeaderOnPage = false
                        }

                        if (!isHeaderOnPage) {
                            doc.setFillColor(243, 244, 246) // Gray-100
                            doc.rect(12, y - 6, pageWidth - 24, rowHeight + 2, "F")
                            doc.setFontSize(8)
                            doc.setFont("helvetica", "bold")
                            doc.setTextColor(107, 114, 128) // Gray-500
                            colHeaders.forEach((header, i) => doc.text(header.toUpperCase(), colX[i], y))
                            y += rowHeight + 2
                            isHeaderOnPage = true
                        }

                        if (idx % 2 !== 0) {
                            doc.setFillColor(252, 253, 254)
                            doc.rect(12, y - 5, pageWidth - 24, rowHeight, "F")
                        }

                        doc.setFont("helvetica", "normal").setTextColor(55, 65, 81).setFontSize(10)
                        const rank = rankMap.get(professor.professorId) || 0
                        doc.text(`${rank}`, colX[0], y)
                        doc.setTextColor(17, 24, 39).text(truncateText(professor.professorName || "", colWidths[1]), colX[1], y)

                        const label = getPerformanceLabel(professor.averageRating)
                        // Dynamic label colors
                        if (label === "Excellent") doc.setTextColor(22, 163, 74) // Green-600
                        else if (label === "Very Satisfactory") doc.setTextColor(37, 99, 235) // Blue-600
                        else if (label === "Satisfactory") doc.setTextColor(217, 119, 6) // Amber-600
                        else doc.setTextColor(220, 38, 38) // Red-600

                        doc.text(label, colX[2], y)

                        doc.setTextColor(17, 24, 39).setFont("helvetica", "bold")
                        doc.text(`${professor.averageRating.toFixed(2)}`, colX[3], y)
                        doc.setFont("helvetica", "normal")
                        y += rowHeight
                    })
                    y += 4
                })
            } else {
                // FLAT LIST
                globalSorted.forEach((professor, index) => {
                    if (y > pageHeight - 20) {
                        doc.addPage()
                        y = 20
                        isHeaderOnPage = false
                    }

                    if (!isHeaderOnPage) {
                        doc.setFillColor(241, 245, 249)
                        doc.rect(12, y - 6, pageWidth - 24, rowHeight + 2, "F")
                        doc.setFontSize(9)
                        doc.setFont("helvetica", "bold")
                        doc.setTextColor(71, 85, 105)
                        colHeaders.forEach((header, i) => doc.text(header.toUpperCase(), colX[i], y))
                        y += rowHeight + 2
                        isHeaderOnPage = true
                    }

                    if (index % 2 !== 0) {
                        doc.setFillColor(248, 250, 252)
                        doc.rect(12, y - 5, pageWidth - 24, rowHeight, "F")
                    }

                    doc.setFont("helvetica", "normal").setTextColor(15, 23, 42).setFontSize(10)
                    const rank = rankMap.get(professor.professorId) || 0
                    doc.text(`${rank}`, colX[0], y)
                    doc.text(truncateText(professor.professorName || "", colWidths[1]), colX[1], y)
                    doc.text(truncateText(professor.departmentName || "", colWidths[2]), colX[2], y)

                    const label = getPerformanceLabel(professor.averageRating)
                    doc.text(label, colX[3], y)
                    doc.setFont("helvetica", "bold")
                    doc.text(`${professor.averageRating.toFixed(2)}`, colX[4], y)
                    doc.setFont("helvetica", "normal")
                    y += rowHeight
                })
            }

            y += 2
            doc.setFontSize(8)
            doc.setTextColor(100, 116, 139)
            doc.text(`${categoryProfessors.length} professor${categoryProfessors.length !== 1 ? "s" : ""} in ${category.label}`, 14, y)
            y += 12

            isFirstCategory = false
        })

        doc.save(`Performance_Rankings_${new Date().toISOString().split('T')[0]}.pdf`)
    }

    // Helper functions for performance rankings
    const getRankBadgeColor = (index: number) => {
        switch (index) {
            case 0:
                return "bg-black text-white shadow-sm"
            case 1:
                return "bg-[#FF6B00] text-white shadow-sm"
            case 2:
                return "bg-[#00CBA9] text-white shadow-sm"
            default:
                return "bg-[#F3F4F6] text-[#374151] shadow-sm"
        }
    }

    const getPerformanceColor = (score: number) => {
        if (score >= 4.50) return "text-green-600"
        if (score >= 3.50) return "text-primary"
        if (score >= 2.50) return "text-amber-600"
        if (score >= 1.50) return "text-orange-600"
        return "text-destructive"
    }

    const getProgressBarColor = (score: number) => {
        if (score >= 4.50) return "bg-[#647C3E]" // Dark Green - Excellent
        if (score >= 3.50) return "bg-[#00D261]" // Bright Green - Very Satisfactory
        if (score >= 2.50) return "bg-amber-500" // Amber - Satisfactory
        if (score >= 1.50) return "bg-orange-600" // Orange - Fair
        return "bg-destructive" // Red - Poor
    }

    const getPerformanceBadgeStyle = (score: number) => {
        if (score >= 4.50) return "bg-green-50 text-green-600 border-none"
        if (score >= 3.50) return "bg-blue-50 text-blue-600 border-none"
        if (score >= 2.50) return "bg-amber-50 text-amber-600 border-none"
        if (score >= 1.50) return "bg-orange-50 text-orange-600 border-none"
        return "bg-red-50 text-red-600 border-none"
    }

    const getPerformanceLabel = (score: number) => {
        if (score >= 4.50) return "Excellent"
        if (score >= 3.50) return "Very Satisfactory"
        if (score >= 2.50) return "Satisfactory"
        if (score >= 1.50) return "Fair"
        if (score > 0) return "Poor"
        return "No Data"
    }

    const performanceCategories = [
        "Instructional Competence",
        "Classroom Management",
        "Student Support & Development",
        "Professionalism & Personal Qualities",
        "Research",
    ]

    // Format date range
    const formatDateRange = (startDate: Date, endDate: Date) => {
        const options: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric', year: 'numeric' }
        return `${startDate.toLocaleDateString('en-US', options)} - ${endDate.toLocaleDateString('en-US', options)}`
    }

    // Render loading state
    if (isLoading && viewLevel === "years") {
        return (
            <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <span className="ml-3 text-muted-foreground">Loading evaluation history...</span>
            </div>
        )
    }

    // Color schemes for cards
    const colorSchemes = [
        { gradient: "from-amber-500/10 via-amber-400/5", border: "border-amber-500/30", hoverBorder: "hover:border-amber-500", iconBg: "bg-amber-100", textColor: "text-amber-700" },
        { gradient: "from-blue-500/10 via-blue-400/5", border: "border-blue-500/30", hoverBorder: "hover:border-blue-500", iconBg: "bg-blue-100", textColor: "text-blue-700" },
        { gradient: "from-green-500/10 via-green-400/5", border: "border-green-500/30", hoverBorder: "hover:border-green-500", iconBg: "bg-green-100", textColor: "text-green-700" },
        { gradient: "from-purple-500/10 via-purple-400/5", border: "border-purple-500/30", hoverBorder: "hover:border-purple-500", iconBg: "bg-purple-100", textColor: "text-purple-700" },
        { gradient: "from-pink-500/10 via-pink-400/5", border: "border-pink-500/30", hoverBorder: "hover:border-pink-500", iconBg: "bg-pink-100", textColor: "text-pink-700" },
    ];

    return (
        <div className="space-y-4 sm:space-y-6">
            <div className="border rounded-lg bg-card">
                <div className="pt-4 pb-4 px-4 sm:pt-6 sm:pb-6 sm:px-6">
                    {/* Header */}
                    <div className="pb-4 mb-4 sm:pb-6 sm:mb-6">
                        <div className="flex items-center gap-2 sm:gap-3 mb-1 sm:mb-2">
                            <div className="p-1.5 sm:p-2 rounded-lg bg-amber-100">
                                <FolderOpen className="h-5 w-5 sm:h-6 sm:w-6 text-amber-600" />
                            </div>
                            <div>
                                <CardTitle className="text-lg sm:text-xl md:text-2xl font-bold text-foreground">
                                    Evaluation History
                                </CardTitle>
                                <CardDescription className="text-xs sm:text-sm md:text-base mt-0.5 sm:mt-1">
                                    View archived evaluation results from previous periods
                                </CardDescription>
                            </div>
                        </div>
                    </div>

                    {/* Breadcrumb / Navigation */}
                    {viewLevel !== "years" && (
                        <div className="flex items-center gap-2 mb-6">
                            <Button variant="outline" size="sm" onClick={goBack} className="h-8">
                                <ArrowLeft className="h-4 w-4 mr-1" />
                                Back
                            </Button>
                            <div className="flex items-center text-sm text-muted-foreground">
                                <span className="hover:text-foreground cursor-pointer" onClick={() => { setViewLevel("years"); setSelectedYear(null); setHistoryType(null); setSelectedPeriod(null); setSelectedDepartment(null); setSelectedProfessorId(null); setSelectedSemesterFilter("all"); }}>
                                    History
                                </span>
                                {selectedYear && (
                                    <>
                                        <ChevronRight className="h-4 w-4 mx-1" />
                                        <span className={viewLevel === "history-type-selection" ? "text-foreground font-medium" : "hover:text-foreground cursor-pointer"} onClick={() => { setViewLevel("history-type-selection"); setHistoryType(null); setSelectedPeriod(null); setSelectedDepartment(null); setSelectedProfessorId(null); }}>
                                            {selectedYear}
                                        </span>
                                    </>
                                )}
                                {historyType && (
                                    <>
                                        <ChevronRight className="h-4 w-4 mx-1" />
                                        <span className={viewLevel === "semester-selection" ? "text-foreground font-medium" : "hover:text-foreground cursor-pointer"} onClick={() => { setViewLevel("semester-selection"); setSelectedSemesterFilter("all"); setSelectedPeriod(null); setSelectedDepartment(null); setSelectedProfessorId(null); }}>
                                            {historyType === "performance" ? "Performance" : "Evaluations"}
                                        </span>
                                    </>
                                )}
                                {selectedSemesterFilter !== "all" && (
                                    <>
                                        <ChevronRight className="h-4 w-4 mx-1" />
                                        <span className={viewLevel === "periods" ? "text-foreground font-medium" : "hover:text-foreground cursor-pointer"} onClick={() => { setViewLevel("periods"); setSelectedPeriod(null); setSelectedDepartment(null); setSelectedProfessorId(null); }}>
                                            {selectedSemesterFilter} Semester
                                        </span>
                                    </>
                                )}
                                {selectedPeriod && (
                                    <>
                                        <ChevronRight className="h-4 w-4 mx-1" />
                                        <span className={viewLevel === "departments" || viewLevel === "performance-rankings" ? "text-foreground font-medium" : "hover:text-foreground cursor-pointer"} onClick={() => {
                                            if (historyType === "performance") {
                                                setViewLevel("performance-rankings");
                                            } else {
                                                setViewLevel("departments");
                                                setSelectedDepartment(null);
                                                setSelectedProfessorId(null);
                                            }
                                        }}>
                                            {formatDateRange(selectedPeriod.startDate, selectedPeriod.endDate)}
                                        </span>
                                    </>
                                )}
                                {selectedDepartment && (
                                    <>
                                        <ChevronRight className="h-4 w-4 mx-1" />
                                        <span className={viewLevel === "professors" ? "text-foreground font-medium" : "hover:text-foreground cursor-pointer"} onClick={() => { if (viewLevel !== "professors") { setViewLevel("professors"); setSelectedProfessorId(null); } }}>
                                            {selectedDepartment}
                                        </span>
                                    </>
                                )}
                                {selectedProfessorData && (
                                    <>
                                        <ChevronRight className="h-4 w-4 mx-1" />
                                        <span className="text-foreground font-medium">
                                            {selectedProfessorData.professorName}
                                        </span>
                                    </>
                                )}
                            </div>
                        </div>
                    )}

                    {/* LEVEL 1: Years */}
                    {viewLevel === "years" && (
                        <>
                            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
                                <div className="flex items-center gap-2">
                                    <div className="p-2 rounded-lg bg-blue-50 border border-blue-100">
                                        <Calendar className="h-5 w-5 text-blue-600" />
                                    </div>
                                    <div>
                                        <CardTitle className="text-xl font-bold text-gray-900">Evaluation Library</CardTitle>
                                        <CardDescription>Select a year to view back up data of evaluation</CardDescription>
                                    </div>
                                </div>
                                <div className="relative w-full sm:w-64">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                    <Input
                                        placeholder="Search years..."
                                        value={yearsSearch}
                                        onChange={(e) => setYearsSearch(e.target.value)}
                                        className="pl-9 h-9"
                                    />
                                </div>
                            </div>

                            <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
                                {historyByYears.filter(y => {
                                    if (!yearsSearch) return true
                                    return y.year.toString().includes(yearsSearch)
                                }).map((yearData, index) => {
                                    const colors = colorSchemes[index % colorSchemes.length]
                                    return (
                                        <Card
                                            key={yearData.year}
                                            className={`group cursor-pointer transition-all duration-300 border-2 ${colors.border} ${colors.hoverBorder} bg-gradient-to-br ${colors.gradient} hover:shadow-lg hover:scale-[1.02] relative overflow-hidden h-40`}
                                            onClick={() => handleYearClick(yearData.year)}
                                        >
                                            <div className="p-5 flex flex-col items-center justify-center text-center h-full relative z-10">
                                                <div className={`w-14 h-14 rounded-2xl ${colors.iconBg} flex items-center justify-center mb-3 group-hover:scale-110 transition-transform`}>
                                                    <FolderOpen className={`h-8 w-8 ${colors.textColor}`} />
                                                </div>
                                                <h3 className={`text-xl font-bold ${colors.textColor}`}>{yearData.year}</h3>
                                                <p className="text-xs text-muted-foreground mt-1">{yearData.periods.length} Evaluation Periods</p>
                                            </div>
                                        </Card>
                                    )
                                })}
                            </div>
                        </>
                    )}

                    {/* LEVEL 1.5: History Type Selection */}
                    {viewLevel === "history-type-selection" && (
                        <>
                            <div className="flex items-center gap-2 mb-8">
                                <div className="p-2 rounded-lg bg-blue-50 border border-blue-100">
                                    <Calendar className="h-5 w-5 text-blue-600" />
                                </div>
                                <div>
                                    <CardTitle className="text-xl font-bold text-gray-900">Back up data for {selectedYear}</CardTitle>
                                    <CardDescription>Choose how you want to browse the backed up data</CardDescription>
                                </div>
                            </div>



                            <div className="grid gap-8 sm:grid-cols-2 max-w-4xl mx-auto px-4">
                                <Card
                                    className="group cursor-pointer transition-all duration-500 border-2 border-blue-100 hover:border-blue-500 bg-white hover:shadow-2xl hover:scale-[1.03] relative overflow-hidden flex flex-col items-center text-center p-8 group"
                                    onClick={() => handleHistoryTypeSelect("evaluation")}
                                >
                                    <div className="absolute top-0 right-0 w-32 h-32 bg-blue-50 rounded-bl-full -mr-10 -mt-10 group-hover:bg-blue-100 transition-colors" />
                                    <div className="w-24 h-24 rounded-3xl bg-blue-50 flex items-center justify-center mb-6 group-hover:scale-110 group-hover:rotate-3 transition-transform duration-500 shadow-sm border border-blue-100">
                                        <FolderOpen className="h-12 w-12 text-blue-600" />
                                    </div>
                                    <h3 className="text-2xl font-bold text-gray-900 mb-3 group-hover:text-blue-600 transition-colors">Evaluation History</h3>
                                    <p className="text-muted-foreground text-sm leading-relaxed max-w-[240px]">
                                        Browse through detailed evaluation periods, departments, and individual professor performance results.
                                    </p>
                                    <div className="mt-8 flex items-center gap-2 text-blue-600 font-semibold opacity-0 group-hover:opacity-100 translate-y-2 group-hover:translate-y-0 transition-all duration-300">
                                        <span>Open Archive</span>
                                        <ChevronRight className="h-4 w-4" />
                                    </div>
                                </Card>

                                <Card
                                    className="group cursor-pointer transition-all duration-500 border-2 border-purple-100 hover:border-purple-500 bg-white hover:shadow-2xl hover:scale-[1.03] relative overflow-hidden flex flex-col items-center text-center p-8"
                                    onClick={() => handleHistoryTypeSelect("performance")}
                                >
                                    <div className="absolute top-0 right-0 w-32 h-32 bg-purple-50 rounded-bl-full -mr-10 -mt-10 group-hover:bg-purple-100 transition-colors" />
                                    <div className="w-24 h-24 rounded-3xl bg-purple-50 flex items-center justify-center mb-6 group-hover:scale-110 group-hover:-rotate-3 transition-transform duration-500 shadow-sm border border-purple-100">
                                        <TrendingUp className="h-12 w-12 text-purple-600" />
                                    </div>
                                    <h3 className="text-2xl font-bold text-gray-900 mb-3 group-hover:text-purple-600 transition-colors">Performance History</h3>
                                    <p className="text-muted-foreground text-sm leading-relaxed max-w-[240px]">
                                        View summarized performance rankings, top performing professors, and historical trends for this year.
                                    </p>
                                    <div className="mt-8 flex items-center gap-2 text-purple-600 font-semibold opacity-0 group-hover:opacity-100 translate-y-2 group-hover:translate-y-0 transition-all duration-300">
                                        <span>View Rankings</span>
                                        <ChevronRight className="h-4 w-4" />
                                    </div>
                                </Card>
                            </div>
                        </>
                    )}

                    {/* LEVEL 1.7: Semester Selection */}
                    {viewLevel === "semester-selection" && (
                        <>
                            <div className="flex items-center gap-2 mb-8">
                                <div className="p-2 rounded-lg bg-indigo-50 border border-indigo-100">
                                    <FileText className="h-5 w-5 text-indigo-600" />
                                </div>
                                <div>
                                    <CardTitle className="text-xl font-bold text-gray-900">
                                        Select Semester for {selectedYear}
                                    </CardTitle>
                                    <CardDescription>
                                        Browse {historyType === "performance" ? "performance" : "evaluation"} data by semester
                                    </CardDescription>
                                </div>
                            </div>

                            <div className="grid gap-6 sm:grid-cols-2 max-w-3xl mx-auto px-4">
                                <Card
                                    className="group cursor-pointer transition-all duration-500 border-2 border-blue-100 hover:border-blue-500 bg-white hover:shadow-xl hover:scale-[1.02] p-8 flex flex-col items-center text-center"
                                    onClick={() => handleSemesterSelect("1st")}
                                >
                                    <div className="w-20 h-20 rounded-full bg-blue-50 flex items-center justify-center mb-4 group-hover:bg-blue-100 transition-colors border border-blue-100">
                                        <span className="text-3xl font-black text-blue-600">1</span>
                                    </div>
                                    <h3 className="text-xl font-bold text-gray-900">1st Semester</h3>
                                    <p className="text-muted-foreground text-sm mt-2">
                                        View archives from the first half of the academic year
                                    </p>
                                </Card>

                                <Card
                                    className="group cursor-pointer transition-all duration-500 border-2 border-blue-100 hover:border-blue-500 bg-white hover:shadow-xl hover:scale-[1.02] p-8 flex flex-col items-center text-center"
                                    onClick={() => handleSemesterSelect("2nd")}
                                >
                                    <div className="w-20 h-20 rounded-full bg-blue-50 flex items-center justify-center mb-4 group-hover:bg-blue-100 transition-colors border border-blue-100">
                                        <span className="text-3xl font-black text-blue-600">2</span>
                                    </div>
                                    <h3 className="text-xl font-bold text-gray-900">2nd Semester</h3>
                                    <p className="text-muted-foreground text-sm mt-2">
                                        View archives from the second half of the academic year
                                    </p>
                                </Card>
                            </div>
                        </>
                    )}

                    {/* LEVEL 2: Periods */}
                    {viewLevel === "periods" && (
                        <>
                            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
                                <div className="flex items-center gap-2">
                                    <div className="p-2 rounded-lg bg-indigo-50 border border-indigo-100">
                                        {historyType === "performance" ? (
                                            <TrendingUp className="h-5 w-5 text-indigo-600" />
                                        ) : (
                                            <Calendar className="h-5 w-5 text-indigo-600" />
                                        )}
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <CardTitle className="text-xl font-bold text-gray-900">
                                            {historyType === "performance" ? "Performance Dates" : "Evaluation Periods"} in {selectedYear}
                                        </CardTitle>
                                        <Badge variant="secondary" className="bg-gray-100 text-gray-600 border-none px-2 h-5 text-[10px] font-bold">
                                            {periodsForYear.length} {historyType === "performance" ? "dates" : "periods"}
                                        </Badge>
                                    </div>
                                </div>
                                <div className="relative w-full sm:w-64">
                                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                    <Input
                                        placeholder="Search periods..."
                                        value={periodsSearch}
                                        onChange={(e) => setPeriodsSearch(e.target.value)}
                                        className="pl-9 h-9"
                                    />
                                </div>
                            </div>
                            <div className="grid gap-4 md:grid-cols-2">
                                {periodsForYear.filter(period => {
                                    if (!periodsSearch) return true
                                    const dateStr = `${period.startDate.toLocaleDateString()} - ${period.endDate.toLocaleDateString()}`
                                    return dateStr.toLowerCase().includes(periodsSearch.toLowerCase())
                                }).map((period, index) => {
                                    const isPerformance = historyType === "performance"
                                    const palette = [
                                        { bg: "bg-blue-50/50", border: "border-blue-200", icon: "bg-blue-100 text-blue-600", chevron: "text-blue-400" },
                                        { bg: "bg-green-50/50", border: "border-green-200", icon: "bg-green-100 text-green-600", chevron: "text-green-400" },
                                        { bg: "bg-purple-50/50", border: "border-purple-200", icon: "bg-purple-100 text-purple-600", chevron: "text-purple-400" },
                                        { bg: "bg-pink-50/50", border: "border-pink-200", icon: "bg-pink-100 text-pink-600", chevron: "text-pink-400" },
                                        { bg: "bg-amber-50/50", border: "border-amber-200", icon: "bg-amber-100 text-amber-600", chevron: "text-amber-400" },
                                        { bg: "bg-indigo-50/50", border: "border-indigo-200", icon: "bg-indigo-100 text-indigo-600", chevron: "text-indigo-400" },
                                    ]
                                    const color = palette[index % palette.length]
                                    const icon = isPerformance ? <TrendingUp className="h-6 w-6" /> : <Calendar className="h-6 w-6" />

                                    return (
                                        <Card
                                            key={period.id}
                                            className={`group cursor-pointer transition-all duration-300 hover:shadow-md hover:scale-[1.01] border ${color.border} ${color.bg}`}
                                            onClick={() => handlePeriodClick(period.id)}
                                        >
                                            <CardContent className="p-4 sm:p-5 flex items-center justify-between">
                                                <div className="flex items-center gap-4">
                                                    <div className={`w-12 h-12 rounded-xl ${color.icon} flex items-center justify-center transition-colors shadow-sm`}>
                                                        {icon}
                                                    </div>
                                                    <div>
                                                        <h4 className="font-bold text-gray-900 group-hover:text-primary transition-colors">
                                                            {period.startDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} - {period.endDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                                                        </h4>
                                                        <div className="flex items-center gap-2 mt-1.5">
                                                            <span className="flex items-center gap-1.5 text-[10px] font-bold text-gray-500 bg-white/60 px-2 py-1 rounded-lg border border-gray-100 shadow-sm">
                                                                <Users className="h-3 w-3" />
                                                                {period.professorCount} professor{period.professorCount !== 1 ? 's' : ''}
                                                            </span>
                                                            <span className="flex items-center gap-1.5 text-[10px] font-bold text-gray-500 bg-white/60 px-2 py-1 rounded-lg border border-gray-100 shadow-sm">
                                                                <FileText className="h-3 w-3" />
                                                                {period.totalEvaluations} eval{period.totalEvaluations !== 1 ? 's' : ''}
                                                            </span>
                                                            <Badge variant="outline" className="text-[10px] h-5 font-bold border-primary/30 text-primary">
                                                                {period.semester === "2nd" ? "2nd Sem" : "1st Sem"}
                                                            </Badge>
                                                        </div>
                                                    </div>
                                                </div>
                                                <ChevronRight className={`h-5 w-5 ${color.chevron} group-hover:translate-x-1 transition-transform`} />
                                            </CardContent>
                                        </Card>
                                    )
                                })}
                            </div>
                        </>
                    )}

                    {/* LEVEL 2.5: Performance Rankings */}
                    {viewLevel === "performance-rankings" && selectedPeriod && (
                        <>
                            <div className="flex flex-col gap-6 mb-6">
                                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                                    <div className="flex items-center gap-3">
                                        <div className="p-2.5 rounded-2xl bg-gradient-to-br from-purple-500/10 to-indigo-500/10 border border-purple-100 shadow-sm">
                                            <TrendingUp className="h-6 w-6 text-purple-600" />
                                        </div>
                                        <div>
                                            <CardTitle className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-gray-900 to-gray-600">
                                                Performance Rankings
                                            </CardTitle>
                                            <CardDescription className="flex items-center gap-1.5 mt-0.5">
                                                <Calendar className="h-3.5 w-3.5" />
                                                {formatDateRange(selectedPeriod.startDate, selectedPeriod.endDate)}
                                            </CardDescription>
                                        </div>
                                    </div>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        className="h-10 gap-2 border-primary/20 bg-primary/5 hover:bg-primary/10 transition-all shadow-sm font-semibold"
                                        onClick={handleExportAllPDF}
                                    >
                                        <FileDown className="h-4 w-4" />
                                        Export All PDF
                                    </Button>
                                </div>

                                {/* Category Tabs */}
                                <div className="bg-muted/30 p-1.5 rounded-xl">
                                    <Tabs value={performanceCategory} onValueChange={setPerformanceCategory} className="w-full">
                                        <TabsList className="grid w-full grid-cols-2 md:grid-cols-5 h-auto gap-1.5 bg-transparent p-0">
                                            {performanceCategories.map((cat) => (
                                                <TabsTrigger
                                                    key={cat}
                                                    value={cat}
                                                    className="text-[11px] sm:text-xs py-3 px-2 font-medium data-[state=active]:bg-white data-[state=active]:text-primary data-[state=active]:shadow-md rounded-lg transition-all border border-transparent data-[state=active]:border-primary/10 whitespace-normal text-center min-h-[44px]"
                                                >
                                                    {cat}
                                                </TabsTrigger>
                                            ))}
                                        </TabsList>
                                    </Tabs>
                                </div>

                                {/* Search & Sort Controls */}
                                <div className="flex flex-col sm:flex-row gap-4">
                                    <div className="flex-1 relative group">
                                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-glow-primary transition-colors" />
                                        <Input
                                            placeholder="Search by professor or dept..."
                                            value={performanceSearch}
                                            onChange={(e) => setPerformanceSearch(e.target.value)}
                                            className="pl-9 h-11 border-2 focus-visible:ring-0 focus-visible:border-primary/50 transition-all rounded-xl bg-white/50"
                                        />
                                    </div>
                                    <div className="flex gap-2">
                                        <Button
                                            variant={performanceSortBy === "score" ? "default" : "outline"}
                                            size="sm"
                                            onClick={() => {
                                                if (performanceSortBy === "score") {
                                                    setPerformanceSortOrder(performanceSortOrder === "asc" ? "desc" : "asc")
                                                } else {
                                                    setPerformanceSortBy("score")
                                                    setPerformanceSortOrder("desc")
                                                }
                                            }}
                                            className="h-11 px-4 gap-2 rounded-xl transition-all shadow-sm"
                                        >
                                            <ArrowUpDown className="h-4 w-4" />
                                            Score {performanceSortBy === "score" && (performanceSortOrder === "desc" ? "↓" : "↑")}
                                        </Button>
                                        <Button
                                            variant={performanceSortBy === "department" ? "default" : "outline"}
                                            size="sm"
                                            onClick={() => {
                                                if (performanceSortBy === "department") {
                                                    setPerformanceSortOrder(performanceSortOrder === "asc" ? "desc" : "asc")
                                                } else {
                                                    setPerformanceSortBy("department")
                                                    setPerformanceSortOrder("desc")
                                                }
                                            }}
                                            className="h-11 px-4 gap-2 rounded-xl transition-all shadow-sm"
                                        >
                                            <ArrowUpDown className="h-4 w-4" />
                                            Dept {performanceSortBy === "department" && (performanceSortOrder === "desc" ? "↓" : "↑")}
                                        </Button>
                                    </div>
                                </div>
                            </div>

                            <div className="border border-gray-100 rounded-lg overflow-hidden bg-white shadow-sm relative">
                                <div className="overflow-x-auto">
                                    <Table>
                                        <TableHeader className="bg-white border-b border-gray-100">
                                            <TableRow className="hover:bg-transparent">
                                                <TableHead className="w-[60px] text-[11px] font-semibold text-gray-500 py-3 px-4">Rank</TableHead>
                                                <TableHead className="text-[11px] font-semibold text-gray-500 py-3 px-4">Professor</TableHead>
                                                <TableHead className="text-[11px] font-semibold text-gray-500 py-3 px-4">Dept</TableHead>
                                                <TableHead className="text-[11px] font-semibold text-gray-500 py-3 px-4 text-center">Performance</TableHead>
                                                <TableHead className="text-[11px] font-semibold text-gray-500 py-3 px-4 text-center">Average Score</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {(() => {
                                                const flattenedEvaluations = selectedPeriod.professorEvaluations.flatMap(p => p.evaluations)
                                                const rankingsByCategory = evaluationResultsService.calculateTopPerformingProfessorsByCategory(
                                                    flattenedEvaluations,
                                                    questions,
                                                    999
                                                )
                                                const categoryData = rankingsByCategory[performanceCategory] || []
                                                let filtered = [...categoryData]
                                                if (performanceSearch) {
                                                    const term = performanceSearch.toLowerCase()
                                                    filtered = filtered.filter(p =>
                                                        p.professorName.toLowerCase().includes(term) ||
                                                        p.departmentName.toLowerCase().includes(term)
                                                    )
                                                }

                                                // Prepare global rank map based on score with name as tie-breaker
                                                const globalSorted = [...categoryData].sort((a, b) => {
                                                    const scoreDiff = b.averageRating - a.averageRating
                                                    if (scoreDiff !== 0) return scoreDiff
                                                    return a.professorName.localeCompare(b.professorName)
                                                })
                                                const rankMap = new Map<string, number>()
                                                globalSorted.forEach((p, i) => rankMap.set(p.professorId, i + 1))

                                                // CONDITIONAL RENDERING: Grouped vs Flat
                                                if (performanceSortBy === "department") {
                                                    // Group by department
                                                    const groups: { [dept: string]: TopProfessorData[] } = {}
                                                    filtered.forEach(p => {
                                                        const dept = p.departmentName || "General"
                                                        if (!groups[dept]) groups[dept] = []
                                                        groups[dept].push(p)
                                                    })

                                                    // Sort groups by their top ranked professor's global rank
                                                    const sortedDepts = Object.keys(groups).sort((a, b) => {
                                                        const minRankA = Math.min(...groups[a].map(p => rankMap.get(p.professorId) || 999))
                                                        const minRankB = Math.min(...groups[b].map(p => rankMap.get(p.professorId) || 999))
                                                        return performanceSortOrder === "asc" ? minRankB - minRankA : minRankA - minRankB
                                                    })

                                                    if (sortedDepts.length === 0) {
                                                        return (
                                                            <TableRow>
                                                                <TableCell colSpan={5} className="text-center py-24">
                                                                    <div className="flex flex-col items-center justify-center space-y-4">
                                                                        <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center">
                                                                            <Search className="h-8 w-8 text-gray-300" />
                                                                        </div>
                                                                        <div className="text-gray-400 font-medium text-xs tracking-wider">No records found matching search</div>
                                                                    </div>
                                                                </TableCell>
                                                            </TableRow>
                                                        )
                                                    }

                                                    return (
                                                        <>
                                                            {sortedDepts.map(dept => (
                                                                <Fragment key={dept}>
                                                                    <TableRow className="bg-gray-50/50 hover:bg-gray-50/50 border-l-4 border-l-primary/40">
                                                                        <TableCell colSpan={5} className="py-2 px-4 border-b border-gray-100">
                                                                            <div className="flex items-center gap-2">
                                                                                <div className="w-1.5 h-1.5 rounded-full bg-primary/60" />
                                                                                <span className="font-bold text-primary/80 text-[10px] uppercase tracking-widest">Dept: {dept}</span>
                                                                                <span className="text-[10px] text-gray-400 font-normal">
                                                                                    ({groups[dept].length} PROFESSOR{groups[dept].length !== 1 ? 'S' : ''})
                                                                                </span>
                                                                            </div>
                                                                        </TableCell>
                                                                    </TableRow>
                                                                    {groups[dept].sort((a, b) => {
                                                                        const scoreDiff = b.averageRating - a.averageRating
                                                                        if (scoreDiff !== 0) return scoreDiff
                                                                        return a.professorName.localeCompare(b.professorName)
                                                                    }).map((professor) => {
                                                                        const rank = rankMap.get(professor.professorId) || 0
                                                                        return (
                                                                            <TableRow key={professor.professorId} className="group hover:bg-gray-50 border-b border-gray-50 transition-colors">
                                                                                <TableCell className="py-2 px-4">
                                                                                    <div className={`flex items-center justify-center w-8 h-8 rounded-full font-bold text-xs ${getRankBadgeColor(rank - 1)}`}>
                                                                                        {rank}
                                                                                    </div>
                                                                                </TableCell>
                                                                                <TableCell className="py-2 px-4">
                                                                                    <div className="font-bold text-[#374151] text-sm">{professor.professorName}</div>
                                                                                </TableCell>
                                                                                <TableCell className="py-2 px-4">
                                                                                    <div className="text-xs text-gray-500 truncate max-w-[200px]">
                                                                                        {professor.departmentName}
                                                                                    </div>
                                                                                </TableCell>
                                                                                <TableCell className="py-2 px-4">
                                                                                    <div className="space-y-1 w-full max-w-[150px] mx-auto">
                                                                                        <div className="relative h-2.5 w-full bg-[#F3F4F6] rounded-full overflow-hidden shadow-inner p-[1px]">
                                                                                            <div
                                                                                                className={`h-full transition-all duration-700 ease-out rounded-full ${getProgressBarColor(professor.averageRating)}`}
                                                                                                style={{ width: `${(professor.averageRating / 5) * 100}%` }}
                                                                                            />
                                                                                        </div>
                                                                                        <div className="flex justify-center">
                                                                                            <Badge variant="outline" className={`text-[8px] px-1.5 h-3.5 font-bold uppercase tracking-wider ${getPerformanceBadgeStyle(professor.averageRating)}`}>
                                                                                                {getPerformanceLabel(professor.averageRating)}
                                                                                            </Badge>
                                                                                        </div>
                                                                                    </div>
                                                                                </TableCell>
                                                                                <TableCell className="py-2 px-4 text-center">
                                                                                    <div className={`font-bold text-base ${professor.averageRating >= 5.00 ? 'text-[#FF6B00]' : 'text-[#374151]'}`}>
                                                                                        {professor.averageRating.toFixed(2)}
                                                                                    </div>
                                                                                </TableCell>
                                                                            </TableRow>
                                                                        )
                                                                    })}
                                                                </Fragment>
                                                            ))}
                                                            {/* Summary Footer */}
                                                            <TableRow className="bg-white hover:bg-white border-t border-gray-100">
                                                                <TableCell colSpan={5} className="py-3 px-4">
                                                                    <div className="text-[11px] text-gray-400">
                                                                        Showing {filtered.length} of {categoryData.length} professors in {performanceCategory}
                                                                    </div>
                                                                </TableCell>
                                                            </TableRow>
                                                        </>
                                                    )
                                                } else {
                                                    // Flat List sorting
                                                    const flatList = [...filtered].sort((a, b) => {
                                                        let comparison = 0
                                                        if (performanceSortBy === "score") {
                                                            comparison = b.averageRating - a.averageRating
                                                            if (comparison === 0) comparison = a.professorName.localeCompare(b.professorName)
                                                        } else if (performanceSortBy === "name") {
                                                            comparison = a.professorName.localeCompare(b.professorName)
                                                        }
                                                        return performanceSortOrder === "asc" ? -comparison : comparison
                                                    })

                                                    if (flatList.length === 0) {
                                                        return (
                                                            <TableRow>
                                                                <TableCell colSpan={5} className="text-center py-24">
                                                                    <div className="flex flex-col items-center justify-center space-y-4">
                                                                        <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center">
                                                                            <Search className="h-8 w-8 text-gray-300" />
                                                                        </div>
                                                                        <div className="text-gray-400 font-medium text-xs tracking-wider">No records found matching search</div>
                                                                    </div>
                                                                </TableCell>
                                                            </TableRow>
                                                        )
                                                    }

                                                    return (
                                                        <>
                                                            {flatList.map((professor) => {
                                                                const rank = rankMap.get(professor.professorId) || 0
                                                                return (
                                                                    <TableRow key={professor.professorId} className="group hover:bg-gray-50 border-b border-gray-50 transition-colors">
                                                                        <TableCell className="py-2 px-4">
                                                                            <div className={`flex items-center justify-center w-8 h-8 rounded-full font-bold text-xs ${getRankBadgeColor(rank - 1)}`}>
                                                                                {rank}
                                                                            </div>
                                                                        </TableCell>
                                                                        <TableCell className="py-2 px-4">
                                                                            <div className="font-bold text-[#374151] text-sm">{professor.professorName}</div>
                                                                        </TableCell>
                                                                        <TableCell className="py-2 px-4">
                                                                            <div className="text-xs text-gray-500 truncate max-w-[200px]">
                                                                                {professor.departmentName}
                                                                            </div>
                                                                        </TableCell>
                                                                        <TableCell className="py-2 px-4">
                                                                            <div className="space-y-1 w-full max-w-[150px] mx-auto">
                                                                                <div className="relative h-2.5 w-full bg-[#F3F4F6] rounded-full overflow-hidden shadow-inner p-[1px]">
                                                                                    <div
                                                                                        className={`h-full transition-all duration-700 ease-out rounded-full ${getProgressBarColor(professor.averageRating)}`}
                                                                                        style={{ width: `${(professor.averageRating / 5) * 100}%` }}
                                                                                    />
                                                                                </div>
                                                                                <div className="flex justify-center">
                                                                                    <Badge variant="outline" className={`text-[8px] px-1.5 h-3.5 font-bold uppercase tracking-wider ${getPerformanceBadgeStyle(professor.averageRating)}`}>
                                                                                        {getPerformanceLabel(professor.averageRating)}
                                                                                    </Badge>
                                                                                </div>
                                                                            </div>
                                                                        </TableCell>
                                                                        <TableCell className="py-2 px-4 text-center">
                                                                            <div className={`font-bold text-base ${professor.averageRating >= 5.00 ? 'text-[#FF6B00]' : 'text-[#374151]'}`}>
                                                                                {professor.averageRating.toFixed(2)}
                                                                            </div>
                                                                        </TableCell>
                                                                    </TableRow>
                                                                )
                                                            })}
                                                            {/* Summary Footer */}
                                                            <TableRow className="bg-white hover:bg-white border-t border-gray-100">
                                                                <TableCell colSpan={5} className="py-3 px-4">
                                                                    <div className="text-[11px] text-gray-400">
                                                                        Showing {flatList.length} of {categoryData.length} professors in {performanceCategory}
                                                                    </div>
                                                                </TableCell>
                                                            </TableRow>
                                                        </>
                                                    )
                                                }
                                            })()}
                                        </TableBody>
                                    </Table>
                                </div>
                            </div>
                        </>
                    )}

                    {/* LEVEL 3: Departments */}
                    {viewLevel === "departments" && selectedPeriod && (
                        <>
                            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
                                <div className="flex items-center gap-2">
                                    <div className="p-2 rounded-lg bg-purple-50 border border-purple-100">
                                        <Folder className="h-5 w-5 text-purple-600" />
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <CardTitle className="text-xl font-bold text-gray-900">Departments</CardTitle>
                                        <Badge variant="secondary" className="bg-gray-100 text-gray-600 border-none px-2 h-5 text-[10px] font-bold">
                                            {(() => {
                                                const departments = new Set<string>()
                                                selectedPeriod.professorEvaluations.forEach(prof => {
                                                    if (prof.departmentName) departments.add(prof.departmentName)
                                                })
                                                return departments.size
                                            })()} departments
                                        </Badge>
                                    </div>
                                </div>
                                <div className="relative w-full sm:w-64">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                    <Input
                                        placeholder="Search departments..."
                                        value={departmentsSearch}
                                        onChange={(e) => setDepartmentsSearch(e.target.value)}
                                        className="pl-9 h-9"
                                    />
                                </div>
                            </div>

                            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                                {(() => {
                                    const departments = new Set<string>()
                                    selectedPeriod.professorEvaluations.forEach(prof => {
                                        if (prof.departmentName) departments.add(prof.departmentName)
                                    })
                                    return Array.from(departments).sort().filter(dept => {
                                        if (!departmentsSearch) return true
                                        return dept.toLowerCase().includes(departmentsSearch.toLowerCase())
                                    }).map((dept, index) => {
                                        const palette = [
                                            { bg: "bg-blue-50/50", border: "border-blue-200", icon: "bg-blue-100 text-blue-600", chevron: "text-blue-400" },
                                            { bg: "bg-green-50/50", border: "border-green-200", icon: "bg-green-100 text-green-600", chevron: "text-green-400" },
                                            { bg: "bg-purple-50/50", border: "border-purple-200", icon: "bg-purple-100 text-purple-600", chevron: "text-purple-400" },
                                            { bg: "bg-pink-50/50", border: "border-pink-200", icon: "bg-pink-100 text-pink-600", chevron: "text-pink-400" },
                                            { bg: "bg-amber-50/50", border: "border-amber-200", icon: "bg-amber-100 text-amber-600", chevron: "text-amber-400" },
                                            { bg: "bg-indigo-50/50", border: "border-indigo-200", icon: "bg-indigo-100 text-indigo-600", chevron: "text-indigo-400" },
                                        ]
                                        const color = palette[index % palette.length]
                                        const deptProfs = selectedPeriod.professorEvaluations.filter(p => p.departmentName === dept)
                                        const totalEvals = deptProfs.reduce((sum, p) => sum + p.evaluations.length, 0)
                                        return (
                                            <Card
                                                key={dept}
                                                className={`group cursor-pointer transition-all duration-300 hover:shadow-md hover:scale-[1.01] border ${color.border} ${color.bg}`}
                                                onClick={() => handleDepartmentClick(dept)}
                                            >
                                                <CardContent className="p-4 sm:p-5 flex items-center justify-between">
                                                    <div className="flex items-center gap-4 flex-1 min-w-0">
                                                        <div className={`w-12 h-12 rounded-xl flex-shrink-0 ${color.icon} flex items-center justify-center transition-colors shadow-sm`}>
                                                            <Folder className="h-6 w-6" />
                                                        </div>
                                                        <div className="min-w-0">
                                                            <h4 className="font-bold text-gray-900 group-hover:text-primary transition-colors line-clamp-2 text-sm leading-tight">
                                                                {dept}
                                                            </h4>
                                                            <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                                                                <span className="flex items-center gap-1 text-[10px] font-bold text-gray-500 bg-white/60 px-2 py-0.5 rounded-lg border border-gray-100 shadow-sm whitespace-nowrap">
                                                                    <Users className="h-3 w-3" />
                                                                    {deptProfs.length} professor{deptProfs.length !== 1 ? 's' : ''}
                                                                </span>
                                                                <span className="flex items-center gap-1 text-[10px] font-bold text-gray-500 bg-white/60 px-2 py-0.5 rounded-lg border border-gray-100 shadow-sm whitespace-nowrap">
                                                                    <FileText className="h-3 w-3" />
                                                                    {totalEvals} eval{totalEvals !== 1 ? 's' : ''}
                                                                </span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <ChevronRight className={`h-5 w-5 flex-shrink-0 ${color.chevron} group-hover:translate-x-1 transition-transform`} />
                                                </CardContent>
                                            </Card>
                                        )
                                    })
                                })()}
                            </div>
                        </>
                    )}

                    {/* LEVEL 4: Professors */}
                    {viewLevel === "professors" && (
                        <>
                            {isLoading ? (
                                <div className="flex items-center justify-center py-8">
                                    <Loader2 className="h-6 w-6 animate-spin text-primary" />
                                    <span className="ml-2 text-muted-foreground">Loading professors...</span>
                                </div>
                            ) : (
                                <>
                                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
                                        <div className="flex items-center gap-2">
                                            <div className="p-2 rounded-lg bg-green-50 border border-green-100">
                                                <Users className="h-5 w-5 text-green-600" />
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <CardTitle className="text-xl font-bold text-gray-900">Professors</CardTitle>
                                                <Badge variant="secondary" className="bg-gray-100 text-gray-600 border-none px-2 h-5 text-[10px] font-bold">
                                                    {professorsForDepartment.length} professors
                                                </Badge>
                                            </div>
                                        </div>
                                        <div className="relative w-full sm:w-64">
                                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                            <Input
                                                placeholder="Search professors..."
                                                value={professorsSearch}
                                                onChange={(e) => setProfessorsSearch(e.target.value)}
                                                className="pl-9 h-9"
                                            />
                                        </div>
                                    </div>
                                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                                        {professorsForDepartment.filter(prof => {
                                            if (!professorsSearch) return true
                                            return prof.professorName.toLowerCase().includes(professorsSearch.toLowerCase())
                                        }).map((prof, index) => {
                                            const palette = [
                                                { bg: "bg-blue-50/50", border: "border-blue-200", icon: "bg-blue-100 text-blue-600", chevron: "text-blue-400" },
                                                { bg: "bg-green-50/50", border: "border-green-200", icon: "bg-green-100 text-green-600", chevron: "text-green-400" },
                                                { bg: "bg-purple-50/50", border: "border-purple-200", icon: "bg-purple-100 text-purple-600", chevron: "text-purple-400" },
                                                { bg: "bg-pink-50/50", border: "border-pink-200", icon: "bg-pink-100 text-pink-600", chevron: "text-pink-400" },
                                                { bg: "bg-amber-50/50", border: "border-amber-200", icon: "bg-amber-100 text-amber-600", chevron: "text-amber-400" },
                                                { bg: "bg-indigo-50/50", border: "border-indigo-200", icon: "bg-indigo-100 text-indigo-600", chevron: "text-indigo-400" },
                                            ]
                                            const color = palette[index % palette.length]
                                            return (
                                                <Card
                                                    key={prof.professorId}
                                                    className={`group cursor-pointer transition-all duration-300 hover:shadow-md hover:scale-[1.01] border ${color.border} ${color.bg}`}
                                                    onClick={() => handleProfessorClick(prof.professorId)}
                                                >
                                                    <CardContent className="p-4 sm:p-5 flex items-center justify-between">
                                                        <div className="flex items-center gap-4 flex-1 min-w-0">
                                                            <div className={`w-12 h-12 rounded-full flex-shrink-0 ${color.icon} flex items-center justify-center transition-colors shadow-sm border-2 border-white`}>
                                                                <Users className="h-6 w-6" />
                                                            </div>
                                                            <div className="min-w-0">
                                                                <h4 className="font-bold text-gray-900 group-hover:text-primary transition-colors truncate text-sm leading-tight">
                                                                    {prof.professorName}
                                                                </h4>
                                                                <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                                                                    <span className="flex items-center gap-1.5 text-[10px] font-bold text-gray-500 bg-white/60 px-2 py-0.5 rounded-lg border border-gray-100 shadow-sm whitespace-nowrap">
                                                                        <BarChart3 className="h-3 w-3" />
                                                                        {prof.evaluationCount} eval{prof.evaluationCount !== 1 ? 's' : ''}
                                                                    </span>
                                                                </div>
                                                            </div>
                                                        </div>
                                                        <ChevronRight className={`h-5 w-5 flex-shrink-0 ${color.chevron} group-hover:translate-x-1 transition-transform`} />
                                                    </CardContent>
                                                </Card>
                                            )
                                        })}
                                    </div>
                                </>
                            )}
                        </>
                    )}
                    {viewLevel === "results" && selectedProfessorData && (
                        <>
                            <div className="flex flex-col gap-4 mb-6">
                                {/* Header with title, profile picture, and search */}
                                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                                    <div className="flex items-center gap-3">
                                        {/* Professor profile picture */}
                                        {(() => {
                                            const prof = professors.find(p => p.id === selectedProfessorId)
                                            const imageUrl = prof?.imageUrl
                                            return imageUrl ? (
                                                <img
                                                    src={imageUrl}
                                                    alt={selectedProfessorData.professorName}
                                                    className="w-12 h-12 rounded-full object-cover border-2 border-purple-200 shadow-sm"
                                                />
                                            ) : (
                                                <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center border-2 border-purple-200">
                                                    <svg className="w-7 h-7 text-purple-600" fill="currentColor" viewBox="0 0 24 24">
                                                        <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
                                                    </svg>
                                                </div>
                                            )
                                        })()}
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <BarChart3 className="h-5 w-5 text-purple-500" />
                                                <h3 className="font-semibold text-lg">Results for {selectedProfessorData.professorName}</h3>
                                            </div>
                                            <div className="flex items-center gap-2 mt-1">
                                                <Badge variant="secondary">
                                                    {selectedProfessorData.evaluationCount} evaluation{selectedProfessorData.evaluationCount !== 1 ? 's' : ''}
                                                </Badge>
                                                {(() => {
                                                    const aggs = Object.values(questionAggregates)
                                                    if (aggs.length === 0) return null

                                                    const groupedBySection: Record<string, QuestionAggregate[]> = {}
                                                    aggs.forEach(q => {
                                                        const section = q.section || "Other"
                                                        if (!groupedBySection[section]) groupedBySection[section] = []
                                                        groupedBySection[section].push(q)
                                                    })

                                                    const weights: Record<string, number> = {
                                                        "instructional competence": 0.4,
                                                        "classroom management": 0.2,
                                                        "professionalism & personal qualities": 0.2,
                                                        "professionalism and personal qualities": 0.2,
                                                        "personal & professional qualities": 0.2,
                                                        "personal and professional qualities": 0.2,
                                                        "personal qualities": 0.2,
                                                        "student support & development": 0.1,
                                                        "student support and development": 0.1,
                                                        "student engagement & assessment": 0.1,
                                                        "student engagement and assessment": 0.1,
                                                        "research": 0.1,
                                                        "e. research": 0.1
                                                    }

                                                    let finalWeightedRating = 0

                                                    Object.entries(groupedBySection).forEach(([sec, sqs]) => {
                                                        const normalizedName = normalizeSectionName(sec)
                                                        if (normalizedName === "comments") return

                                                        const weight = weights[normalizedName] || 0
                                                        if (weight === 0) return

                                                        let secWeightedSum = 0
                                                        let secTotalResponses = 0

                                                        sqs.forEach(q => {
                                                            if (q.questionType !== "text") {
                                                                const opts = q.options || ["Excellent", "Very Satisfactory", "Satisfactory", "Fair", "Poor"]
                                                                opts.forEach((opt, oi) => {
                                                                    const val = q.counts[opt] || 0
                                                                    let score = 0
                                                                    const label = opt.toLowerCase()
                                                                    if (label === "excellent" || oi === 0) score = 5
                                                                    else if (label === "very satisfactory" || label === "verysatisfactory" || oi === 1) score = 4
                                                                    else if (label === "satisfactory" || oi === 2) score = 3
                                                                    else if (label === "fair" || (oi === 2 && opts.length === 4) || (oi === 3 && opts.length === 5)) score = 2
                                                                    else if (label === "poor" || (oi === 3 && opts.length === 4) || (oi === 4 && opts.length === 5)) score = 1

                                                                    secWeightedSum += val * score
                                                                    secTotalResponses += val
                                                                })
                                                            }
                                                        })

                                                        if (secTotalResponses > 0) {
                                                            finalWeightedRating += (secWeightedSum / secTotalResponses) * weight
                                                        }
                                                    })

                                                    const label = finalWeightedRating >= 4.5 ? "Excellent" : finalWeightedRating >= 3.5 ? "Very Satisfactory" : finalWeightedRating >= 2.5 ? "Satisfactory" : finalWeightedRating >= 1.5 ? "Fair" : "Poor"
                                                    const color = finalWeightedRating >= 4.5 ? "text-green-600 bg-green-50 border-green-200" : finalWeightedRating >= 3.5 ? "text-blue-600 bg-blue-50 border-blue-200" : finalWeightedRating >= 2.5 ? "text-yellow-600 bg-yellow-50 border-yellow-200" : finalWeightedRating >= 1.5 ? "text-orange-600 bg-orange-50 border-orange-200" : "text-red-600 bg-red-50 border-red-200"

                                                    return (
                                                        <div className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full border text-[11px] font-bold shadow-sm ${color}`}>
                                                            <span>{finalWeightedRating.toFixed(2)}</span>
                                                            <span className="opacity-70">|</span>
                                                            <span>{label}</span>
                                                        </div>
                                                    )
                                                })()}
                                            </div>
                                        </div>
                                    </div>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={handleExportPDF}
                                        className="h-9 gap-2 text-primary border-primary/20 bg-primary/5 hover:bg-primary/10 transition-all shadow-sm"
                                    >
                                        <FileDown className="h-4 w-4" />
                                        <span className="font-semibold">Export PDF</span>
                                    </Button>
                                </div>

                                {/* Section filter tabs */}
                                <div className="flex flex-wrap gap-2 p-1 bg-muted/30 rounded-lg">
                                    {(() => {
                                        // Deduplicate sections based on normalized name
                                        const seenNormalized = new Set<string>()
                                        return SECTION_ORDER.filter(section => {
                                            const normalized = normalizeSectionName(section)
                                            // Skip Comments - we'll add it manually
                                            if (normalized === "comment" || normalized === "comments") return false
                                            // Skip if we've already seen this normalized name
                                            if (seenNormalized.has(normalized)) return false
                                            // Check if this section has any questions
                                            const hasQuestions = Object.values(questionAggregates).some(ag => sectionMatches(ag.section || "", section))
                                            if (hasQuestions) {
                                                seenNormalized.add(normalized)
                                                return true
                                            }
                                            return false
                                        }).map((section) => {
                                            // Get short name for tab
                                            const shortName = section.replace(/^[A-F]\.\s*/, "")
                                            // Check if active using flexible matching
                                            const isActive = selectedSection ? sectionMatches(selectedSection, section) : false
                                            return (
                                                <Button
                                                    key={section}
                                                    variant={isActive ? "default" : "ghost"}
                                                    size="sm"
                                                    onClick={() => setSelectedSection(isActive ? null : section)}
                                                    className={`text-xs h-8 ${isActive ? 'shadow-sm' : 'hover:bg-background/80'}`}
                                                >
                                                    {shortName}
                                                </Button>
                                            )
                                        })
                                    })()}
                                    {/* Always show Comments button */}
                                    <Button
                                        variant={selectedSection === "Comments" ? "default" : "ghost"}
                                        size="sm"
                                        onClick={() => setSelectedSection(selectedSection === "Comments" ? null : "Comments")}
                                        className={`text-xs h-8 ${selectedSection === "Comments" ? 'shadow-sm' : 'hover:bg-background/80'}`}
                                    >
                                        Comments
                                    </Button>
                                </div>


                            </div>


                            {Object.keys(questionAggregates).length === 0 ? (
                                <div className="text-center py-8 bg-muted/30 rounded-lg border-2 border-dashed">
                                    <AlertCircle className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
                                    <p className="text-foreground font-medium">No submitted evaluations found</p>
                                    <p className="text-muted-foreground text-sm">Only submitted evaluations are displayed</p>
                                </div>
                            ) : selectedSection === "Comments" ? (
                                /* Special handling for Comment - show student text answers */
                                <div className="space-y-6">
                                    <div className="bg-teal-50 rounded-lg p-6 border-l-4 border-teal-500 shadow-sm">
                                        <div className="flex items-center gap-3 mb-6">
                                            <div className="w-10 h-10 bg-teal-100 rounded-full flex items-center justify-center">
                                                <svg className="w-5 h-5 text-teal-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                                                </svg>
                                            </div>
                                            <div>
                                                <h4 className="font-bold text-xl text-teal-800">Comments</h4>
                                                <p className="text-teal-600 text-sm">Student feedback and comments</p>
                                            </div>
                                        </div>
                                        <div className="space-y-4">
                                            {(() => {
                                                // Search through all evaluations for comment text responses
                                                const evaluations = selectedProfessorData?.evaluations || []
                                                const commentResponses: { questionText: string; answer: string; questionId: string; studentName?: string }[] = []

                                                evaluations
                                                    .filter((e: any) => e.evaluationStatus === "submitted")
                                                    .forEach((evaluation: any) => {
                                                        const studentName = evaluation.studentName || "Anonymous Student"
                                                            ; (evaluation.responses || []).forEach((response: any) => {
                                                                // Check if this is a comment response
                                                                const sectionLower = (response.section || "").toLowerCase()
                                                                const questionTextLower = (response.questionText || "").toLowerCase()

                                                                // Match comments by:
                                                                // 1. Section name contains "comment"
                                                                // 2. Question type is "text"
                                                                // 3. Section starts with "F." (F. Comments)
                                                                const isCommentSection =
                                                                    sectionLower === "comment" ||
                                                                    sectionLower === "comments" ||
                                                                    sectionLower === "f. comment" ||
                                                                    sectionLower === "f. comments" ||
                                                                    sectionLower.includes("comment")

                                                                if (isCommentSection && response.answer && String(response.answer).trim()) {
                                                                    commentResponses.push({
                                                                        questionText: response.questionText || "Comment",
                                                                        answer: String(response.answer).trim(),
                                                                        questionId: response.questionId,
                                                                        studentName: studentName
                                                                    })
                                                                }
                                                            })
                                                    })

                                                if (commentResponses.length === 0) {
                                                    return (
                                                        <div className="text-center py-8 bg-white rounded-xl border-2 border-dashed border-teal-200">
                                                            <div className="w-16 h-16 bg-teal-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                                                <svg className="w-8 h-8 text-teal-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                                                                </svg>
                                                            </div>
                                                            <p className="text-teal-700 font-semibold text-lg">No Comments Yet</p>
                                                            <p className="text-teal-500 text-sm mt-1">Students have not submitted any comments yet.</p>
                                                        </div>
                                                    )
                                                }

                                                // Group responses by question
                                                const groupedByQuestion = new Map<string, { questionText: string; answers: { text: string; studentName: string }[] }>()
                                                commentResponses.forEach(r => {
                                                    if (!groupedByQuestion.has(r.questionId)) {
                                                        groupedByQuestion.set(r.questionId, { questionText: r.questionText, answers: [] })
                                                    }
                                                    groupedByQuestion.get(r.questionId)!.answers.push({
                                                        text: r.answer,
                                                        studentName: r.studentName || "Student"
                                                    })
                                                })

                                                return Array.from(groupedByQuestion.entries()).map(([qid, data], questionIndex) => (
                                                    <Card key={qid} className="bg-white shadow-md hover:shadow-lg transition-shadow border-2 border-teal-100">
                                                        <CardContent className="p-5">
                                                            {/* Question Header */}
                                                            <div className="flex items-start gap-3 mb-4 pb-3 border-b border-teal-100">
                                                                <Badge className="bg-teal-500 text-white px-3 py-1 text-xs font-bold">
                                                                    Q{questionIndex + 1}
                                                                </Badge>
                                                                <p className="font-semibold text-gray-800 text-base leading-relaxed">{data.questionText}</p>
                                                            </div>

                                                            {/* Student Answers */}
                                                            <div className="space-y-3 max-h-80 overflow-y-auto pr-2">
                                                                <p className="text-xs text-teal-600 font-medium uppercase tracking-wide mb-2">
                                                                    {data.answers.length} Student Response{data.answers.length !== 1 ? 's' : ''}
                                                                </p>
                                                                {data.answers.map((answerData, idx) => (
                                                                    <div key={idx} className="bg-gradient-to-r from-teal-50 to-cyan-50 p-4 rounded-lg border border-teal-200 hover:border-teal-300 transition-colors">
                                                                        <div className="flex items-center gap-2 mb-2">
                                                                            <div className="w-6 h-6 bg-teal-500 rounded-full flex items-center justify-center text-white text-xs font-bold">
                                                                                {idx + 1}
                                                                            </div>
                                                                            <span className="text-teal-700 font-semibold text-sm">Response {idx + 1}</span>
                                                                        </div>
                                                                        <p className="text-gray-700 text-sm leading-relaxed pl-8">
                                                                            "{answerData.text}"
                                                                        </p>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </CardContent>
                                                    </Card>
                                                ))
                                            })()}
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div className="space-y-6">
                                    {/* Group by section - filter by selectedSection, deduplicated */}
                                    {(() => {
                                        const seenNormalized = new Set<string>()
                                        return SECTION_ORDER.filter(section => {
                                            const normalized = normalizeSectionName(section)
                                            // Skip Comments - handled separately
                                            if (normalized === "comment" || normalized === "comments") return false
                                            // Skip if we've already seen this normalized name
                                            if (seenNormalized.has(normalized)) return false
                                            // If a section is selected, only show sections that match (using flexible matching)
                                            if (selectedSection && !sectionMatches(section, selectedSection)) return false
                                            // Only show sections that have questions (using flexible matching)
                                            const hasQuestions = Object.values(questionAggregates).some(ag => sectionMatches(ag.section || "", section))
                                            if (hasQuestions) {
                                                seenNormalized.add(normalized)
                                                return true
                                            }
                                            return false
                                        })
                                    })().map((section) => {

                                        const sectionColors = SECTION_COLORS[section] || { bg: "bg-gray-50", border: "border-gray-500", text: "text-gray-700" }
                                        // Filter questions by section (flexible matching) and search query
                                        const sectionQuestions = Object.values(questionAggregates).filter(ag => {
                                            if (!sectionMatches(ag.section || "", section)) return false
                                            if (searchQuery) {
                                                return ag.questionText.toLowerCase().includes(searchQuery.toLowerCase())
                                            }
                                            return true
                                        })


                                        // Skip section if no questions match search
                                        if (sectionQuestions.length === 0) return null


                                        return (
                                            <div key={section} className={`${sectionColors.bg} rounded-lg p-4 border-l-4 ${sectionColors.border}`}>
                                                <div className="flex items-center justify-between mb-4">
                                                    <h4 className={`font-bold text-lg ${sectionColors.text}`}>{section}</h4>
                                                    {(() => {
                                                        let secWeightedSum = 0
                                                        let secTotalResponses = 0

                                                        sectionQuestions.forEach(q => {
                                                            if (q.questionType !== "text") {
                                                                const opts = q.options || ["Excellent", "Very Satisfactory", "Satisfactory", "Fair", "Poor"]
                                                                opts.forEach((opt, oi) => {
                                                                    const val = q.counts[opt] || 0
                                                                    let score = 0
                                                                    const label = opt.toLowerCase()
                                                                    if (label === "excellent" || oi === 0) score = 5
                                                                    else if (label === "very satisfactory" || label === "verysatisfactory" || oi === 1) score = 4
                                                                    else if (label === "satisfactory" || oi === 2) score = 3
                                                                    else if (label === "fair" || (oi === 2 && opts.length === 4) || (oi === 3 && opts.length === 5)) score = 2
                                                                    else if (label === "poor" || (oi === 3 && opts.length === 4) || (oi === 4 && opts.length === 5)) score = 1

                                                                    secWeightedSum += val * score
                                                                    secTotalResponses += val
                                                                })
                                                            }
                                                        })

                                                        const secAvg = secTotalResponses > 0 ? secWeightedSum / secTotalResponses : 0
                                                        return secAvg > 0 ? (
                                                            <div className={`px-2.5 py-1 rounded-lg border bg-white/50 shadow-sm text-sm font-bold flex items-center gap-2 ${sectionColors.text} ${sectionColors.border}`}>
                                                                <span className="text-[10px] uppercase opacity-70">Average</span>
                                                                <span>{secAvg.toFixed(2)}</span>
                                                            </div>
                                                        ) : null
                                                    })()}
                                                </div>
                                                <div className="space-y-4">
                                                    {sectionQuestions.map((ag) => (
                                                        <Card key={ag.questionId} className="bg-white">
                                                            <CardContent className="p-4">
                                                                <p className="font-medium text-gray-800 mb-4">{ag.questionText}</p>
                                                                {ag.questionType === "text" ? (
                                                                    <div className="space-y-2 max-h-48 overflow-y-auto">
                                                                        {ag.textResponses?.map((resp, idx) => (
                                                                            <div key={idx} className="bg-gray-50 p-3 rounded border text-sm">
                                                                                {resp}
                                                                            </div>
                                                                        ))}
                                                                    </div>
                                                                ) : (
                                                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                                        <div
                                                                            id={`history-pie-chart-${ag.questionId}`}
                                                                            className="h-64 bg-gray-50 rounded-lg"
                                                                        />
                                                                        <div
                                                                            id={`history-bar-chart-${ag.questionId}`}
                                                                            className="h-64 bg-gray-50 rounded-lg"
                                                                        />
                                                                    </div>
                                                                )}
                                                            </CardContent>
                                                        </Card>
                                                    ))}
                                                </div>
                                            </div>
                                        )
                                    })
                                    }
                                </div>
                            )}
                        </>
                    )}
                </div>
            </div>

            {/* Delete Confirmation Dialog */}
            <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete History Period?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This will permanently delete this evaluation history. This action cannot be undone.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDeletePeriod} className="bg-red-500 hover:bg-red-600">
                            Delete
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    )
}
