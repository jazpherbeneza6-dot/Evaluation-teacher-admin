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

import { useState, useEffect, useMemo } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"

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
    Search
} from "lucide-react"

import { evaluationHistoryService, type HistoryByYear, type EvaluationHistoryEntry } from "@/lib/evaluation-history-service"
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

// Section order and colors (same as evaluation-results-management)
const SECTION_ORDER = [
    "A. Instructional Competence",
    "Instructional Competence",
    "B. Classroom Management",
    "Classroom Management",
    "C. Professionalism and Personal Qualities",
    "Professionalism and Personal Qualities",
    "D. Student Support and Development",
    "Student Support and Development",
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
    "C. Professionalism and Personal Qualities": { bg: "bg-purple-50", border: "border-purple-500", text: "text-purple-700" },
    "Professionalism and Personal Qualities": { bg: "bg-purple-50", border: "border-purple-500", text: "text-purple-700" },
    "D. Student Support and Development": { bg: "bg-orange-50", border: "border-orange-500", text: "text-orange-700" },
    "Student Support and Development": { bg: "bg-orange-50", border: "border-orange-500", text: "text-orange-700" },
    "E. Research": { bg: "bg-pink-50", border: "border-pink-500", text: "text-pink-700" },
    "Research": { bg: "bg-pink-50", border: "border-pink-500", text: "text-pink-700" },
    "F. Comments": { bg: "bg-teal-50", border: "border-teal-500", text: "text-teal-700" },
    "Comments": { bg: "bg-teal-50", border: "border-teal-500", text: "text-teal-700" },

}

// Navigation levels
type ViewLevel = "years" | "periods" | "departments" | "professors" | "results"

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
        return yearData?.periods || []
    }, [historyByYears, selectedYear])

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
        setViewLevel("periods")
    }

    // Handle period selection - now goes to departments first
    const handlePeriodClick = async (periodId: string) => {
        setSelectedPeriodId(periodId)
        setIsLoading(true)
        try {
            const periodData = await evaluationHistoryService.getHistoryById(periodId)
            setSelectedPeriod(periodData)
            setViewLevel("departments")  // Changed to departments
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
        } else if (viewLevel === "periods") {
            setSelectedYear(null)
            setPeriodsSearch("")  // Reset periods search
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
                        if ((!baseOptions || baseOptions.length === 0) && response.questionType === "Likert Scale") {
                            baseOptions = ["Strongly Agree", "Agree", "Disagree", "Strongly Disagree"]
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
    ]

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
                                <span className="hover:text-foreground cursor-pointer" onClick={() => { setViewLevel("years"); setSelectedYear(null); setSelectedPeriod(null); setSelectedDepartment(null); setSelectedProfessorId(null); }}>
                                    History
                                </span>
                                {selectedYear && (
                                    <>
                                        <ChevronRight className="h-4 w-4 mx-1" />
                                        <span className={viewLevel === "periods" ? "text-foreground font-medium" : "hover:text-foreground cursor-pointer"} onClick={() => { if (viewLevel !== "periods") { setViewLevel("periods"); setSelectedPeriod(null); setSelectedDepartment(null); setSelectedProfessorId(null); } }}>
                                            {selectedYear}
                                        </span>
                                    </>
                                )}
                                {selectedPeriod && (
                                    <>
                                        <ChevronRight className="h-4 w-4 mx-1" />
                                        <span className={viewLevel === "departments" ? "text-foreground font-medium" : "hover:text-foreground cursor-pointer"} onClick={() => { if (viewLevel !== "departments") { setViewLevel("departments"); setSelectedDepartment(null); setSelectedProfessorId(null); } }}>
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

                    {/* Content based on view level */}
                    <div className="space-y-6">
                        {/* LEVEL 1: Years */}
                        {viewLevel === "years" && (
                            <>
                                {/* Header with search bar */}
                                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
                                    <div className="flex items-center gap-2">
                                        <FolderOpen className="h-5 w-5 text-orange-500" />
                                        <h3 className="font-semibold text-lg">Evaluation History</h3>
                                        <Badge variant="secondary">{historyByYears.length} year{historyByYears.length !== 1 ? 's' : ''}</Badge>
                                    </div>
                                    {/* Search bar */}
                                    <div className="relative w-full sm:w-64">
                                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                        <Input
                                            placeholder="Search years..."
                                            value={yearsSearch}
                                            onChange={(e) => setYearsSearch(e.target.value)}
                                            className="pl-9 h-9"
                                        />
                                    </div>
                                </div>

                                {historyByYears.length === 0 ? (
                                    <div className="text-center py-12 bg-muted/30 rounded-xl border-2 border-dashed">
                                        <div className="w-20 h-20 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
                                            <FolderOpen className="h-10 w-10 text-muted-foreground" />
                                        </div>
                                        <p className="text-foreground font-semibold text-lg">No History Yet</p>
                                        <p className="text-muted-foreground text-sm mt-2">
                                            Evaluation history will appear here after deadline updates
                                        </p>
                                    </div>
                                ) : (
                                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                                        {historyByYears.filter(yearData => {
                                            if (!yearsSearch) return true
                                            return yearData.year.toString().includes(yearsSearch)
                                        }).map((yearData, index) => {

                                            const colors = colorSchemes[index % colorSchemes.length]
                                            const totalEvals = yearData.periods.reduce((sum, p) => sum + p.totalEvaluations, 0)
                                            return (
                                                <Card
                                                    key={yearData.year}
                                                    className={`cursor-pointer transition-all duration-300 border-2 ${colors.border} ${colors.hoverBorder} bg-gradient-to-br ${colors.gradient} group hover:shadow-xl hover:scale-[1.02]`}
                                                    onClick={() => handleYearClick(yearData.year)}
                                                >
                                                    <CardContent className="p-6">
                                                        <div className="flex flex-col items-center text-center space-y-4">
                                                            <div className={`w-20 h-20 rounded-2xl ${colors.iconBg} flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform`}>
                                                                <FolderOpen className={`h-10 w-10 ${colors.textColor}`} />
                                                            </div>
                                                            <div>
                                                                <h3 className="font-bold text-2xl text-foreground">{yearData.year}</h3>
                                                                <div className="flex items-center justify-center gap-2 mt-2">
                                                                    <Badge variant="secondary" className="text-xs">
                                                                        {yearData.periods.length} period{yearData.periods.length !== 1 ? 's' : ''}
                                                                    </Badge>
                                                                    <Badge variant="outline" className="text-xs">
                                                                        {totalEvals} evaluation{totalEvals !== 1 ? 's' : ''}
                                                                    </Badge>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </CardContent>
                                                </Card>
                                            )
                                        })}
                                    </div>
                                )}
                            </>
                        )}

                        {/* LEVEL 2: Periods */}
                        {viewLevel === "periods" && (
                            <>
                                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
                                    <div className="flex items-center gap-2">
                                        <Calendar className="h-5 w-5 text-blue-500" />
                                        <h3 className="font-semibold text-lg">Evaluation Periods in {selectedYear}</h3>
                                        <Badge variant="secondary">{periodsForYear.length} period{periodsForYear.length !== 1 ? 's' : ''}</Badge>
                                    </div>
                                    {/* Search bar */}
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

                                        const colors = colorSchemes[(index + 1) % colorSchemes.length]
                                        return (
                                            <Card
                                                key={period.id}
                                                className={`cursor-pointer transition-all duration-300 border-2 ${colors.border} ${colors.hoverBorder} bg-gradient-to-br ${colors.gradient} group hover:shadow-lg`}
                                                onClick={() => handlePeriodClick(period.id)}
                                            >
                                                <CardContent className="p-5">
                                                    <div className="flex items-center justify-between">
                                                        <div className="flex items-center gap-4">
                                                            <div className={`w-14 h-14 rounded-xl ${colors.iconBg} flex items-center justify-center shadow group-hover:scale-105 transition-transform`}>
                                                                <Calendar className={`h-7 w-7 ${colors.textColor}`} />
                                                            </div>
                                                            <div>
                                                                <h4 className="font-semibold text-foreground">
                                                                    {formatDateRange(period.startDate, period.endDate)}
                                                                </h4>
                                                                <div className="flex items-center gap-2 mt-1">
                                                                    <Badge variant="secondary" className="text-xs">
                                                                        <Users className="h-3 w-3 mr-1" />
                                                                        {period.professorCount} professor{period.professorCount !== 1 ? 's' : ''}
                                                                    </Badge>
                                                                    <Badge variant="outline" className="text-xs">
                                                                        {period.totalEvaluations} eval{period.totalEvaluations !== 1 ? 's' : ''}
                                                                    </Badge>
                                                                </div>
                                                            </div>
                                                        </div>
                                                        <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-foreground transition-colors" />
                                                    </div>
                                                </CardContent>
                                            </Card>
                                        )
                                    })}
                                </div>
                            </>
                        )}

                        {/* LEVEL 3: Departments */}
                        {viewLevel === "departments" && (
                            <>
                                {isLoading ? (
                                    <div className="flex items-center justify-center py-8">
                                        <Loader2 className="h-6 w-6 animate-spin text-primary" />
                                        <span className="ml-2 text-muted-foreground">Loading departments...</span>
                                    </div>
                                ) : (
                                    <>
                                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
                                            <div className="flex items-center gap-2">
                                                <FolderOpen className="h-5 w-5 text-purple-500" />
                                                <h3 className="font-semibold text-lg">Departments</h3>
                                                <Badge variant="secondary">{departmentsForPeriod.length} department{departmentsForPeriod.length !== 1 ? 's' : ''}</Badge>
                                            </div>
                                            {/* Search bar */}
                                            <div className="relative w-full sm:w-64">
                                                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                                <Input
                                                    placeholder="Search departments..."
                                                    value={departmentsSearch}
                                                    onChange={(e) => setDepartmentsSearch(e.target.value)}
                                                    className="pl-9 h-9"
                                                />
                                            </div>
                                        </div>
                                        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                                            {departmentsForPeriod.filter(dept => {
                                                if (!departmentsSearch) return true
                                                return dept.toLowerCase().includes(departmentsSearch.toLowerCase())
                                            }).map((dept, index) => {
                                                const colors = colorSchemes[(index + 2) % colorSchemes.length]
                                                const professorsInDept = (selectedPeriod?.professorEvaluations || []).filter(p => p.departmentName === dept)
                                                const totalEvals = professorsInDept.reduce((sum, p) => sum + p.evaluationCount, 0)
                                                return (
                                                    <Card
                                                        key={dept}
                                                        className={`cursor-pointer transition-all duration-300 border-2 ${colors.border} ${colors.hoverBorder} bg-gradient-to-br ${colors.gradient} group hover:shadow-lg`}
                                                        onClick={() => handleDepartmentClick(dept)}
                                                    >
                                                        <CardContent className="p-5">
                                                            <div className="flex items-center justify-between">
                                                                <div className="flex items-center gap-4">
                                                                    <div className={`w-14 h-14 rounded-xl ${colors.iconBg} flex items-center justify-center shadow group-hover:scale-105 transition-transform`}>
                                                                        <FolderOpen className={`h-7 w-7 ${colors.textColor}`} />
                                                                    </div>
                                                                    <div>
                                                                        <h4 className="font-semibold text-foreground">
                                                                            {dept}
                                                                        </h4>
                                                                        <div className="flex items-center gap-2 mt-1">
                                                                            <Badge variant="secondary" className="text-xs">
                                                                                <Users className="h-3 w-3 mr-1" />
                                                                                {professorsInDept.length} professor{professorsInDept.length !== 1 ? 's' : ''}
                                                                            </Badge>
                                                                            <Badge variant="outline" className="text-xs">
                                                                                {totalEvals} eval{totalEvals !== 1 ? 's' : ''}
                                                                            </Badge>
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                                <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-foreground transition-colors" />
                                                            </div>
                                                        </CardContent>
                                                    </Card>
                                                )
                                            })}
                                        </div>
                                    </>
                                )}
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
                                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
                                            <div className="flex items-center gap-2">
                                                <Users className="h-5 w-5 text-green-500" />
                                                <h3 className="font-semibold text-lg">Professors</h3>
                                                <Badge variant="secondary">{professorsForDepartment.length} professor{professorsForDepartment.length !== 1 ? 's' : ''}</Badge>
                                            </div>
                                            {/* Search bar */}
                                            <div className="relative w-full sm:w-64">
                                                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                                <Input
                                                    placeholder="Search professors..."
                                                    value={professorsSearch}
                                                    onChange={(e) => setProfessorsSearch(e.target.value)}
                                                    className="pl-9 h-9"
                                                />
                                            </div>
                                        </div>
                                        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                                            {professorsForDepartment.filter(prof => {
                                                if (!professorsSearch) return true
                                                return prof.professorName.toLowerCase().includes(professorsSearch.toLowerCase())
                                            }).map((prof, index) => {

                                                const borderColors = ["border-l-blue-500", "border-l-green-500", "border-l-purple-500", "border-l-orange-500", "border-l-pink-500"]
                                                const borderColor = borderColors[index % borderColors.length]
                                                return (
                                                    <Card
                                                        key={prof.professorId}
                                                        className={`relative bg-white border-2 ${borderColor} rounded-lg overflow-hidden hover:shadow-lg transition-all duration-300 cursor-pointer`}
                                                        onClick={() => handleProfessorClick(prof.professorId)}
                                                    >
                                                        <CardContent className="p-4">
                                                            <div className="flex items-start gap-3 mb-3">
                                                                <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center border-2 border-gray-300">
                                                                    <svg className="w-8 h-8 text-gray-600" fill="currentColor" viewBox="0 0 24 24">
                                                                        <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
                                                                    </svg>
                                                                </div>
                                                                <div className="flex-1">
                                                                    <h3 className="font-bold text-gray-900 text-lg">{prof.professorName}</h3>
                                                                    <p className="text-gray-600 text-xs">Professor</p>
                                                                </div>
                                                            </div>
                                                            <div className="flex items-center justify-between">
                                                                <Badge variant="secondary" className="text-xs">
                                                                    <BarChart3 className="h-3 w-3 mr-1" />
                                                                    {prof.evaluationCount} evaluation{prof.evaluationCount !== 1 ? 's' : ''}
                                                                </Badge>
                                                                <Button variant="outline" size="sm" className="text-xs h-8">
                                                                    View Results
                                                                    <ChevronRight className="h-3 w-3 ml-1" />
                                                                </Button>
                                                            </div>
                                                        </CardContent>
                                                    </Card>
                                                )
                                            })}
                                        </div>
                                    </>
                                )}
                            </>
                        )}

                        {/* LEVEL 4: Results */}
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
                                                <Badge variant="secondary" className="mt-1">
                                                    {selectedProfessorData.evaluationCount} evaluation{selectedProfessorData.evaluationCount !== 1 ? 's' : ''}
                                                </Badge>
                                            </div>

                                        </div>
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
                                                    <h4 className={`font-semibold text-lg mb-4 ${sectionColors.text}`}>{section}</h4>
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
                                        })}
                                    </div>
                                )}
                            </>
                        )}
                    </div>
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
