"use client"

/*
 * EVALUATION RESULTS MANAGEMENT - Ito ang page para sa pag-view ng Faculties Evaluation Results
 * 
 * SIMPLE EXPLANATION:
 * 1. Dito mo makikita ang evaluation results ng bawat department
 * 2. Pwede kang pumili ng department at professor
 * 3. Makikita mo ang charts at responses ng students
 * 4. Real-time updates ng evaluation data
 */

import { useState, useMemo, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { BarChart3, ArrowLeft, Search, Users, X } from "lucide-react"
import { firebaseEvaluationService, type FirebaseEvaluationResult } from "@/lib/firebase-evaluation-service"
import type { EvaluationQuestion, Professor } from "@/lib/types"
import { useToast } from "@/hooks/use-toast"

// Declare global variables para sa Google Charts
declare global {
  interface Window {
    google: any
  }
}

// Define ang data type para sa question aggregates (summary ng mga sagot)
type QuestionAggregate = {
  questionId: string // ID ng tanong
  questionText: string // Text ng tanong
  questionType: string // Tipo ng tanong (Likert Scale o text)
  options: string[] // Mga choices para sa tanong
  counts: Record<string, number> // Bilang ng bawat sagot
  textResponses?: string[] // Mga text na sagot (kung text type)
}

// Define ang mga colors para sa charts
const chartColors = [
  "#3b82f6", // blue
  "#10b981", // emerald
  "#f59e0b", // amber
  "#ef4444", // red
  "#8b5cf6", // violet
  "#06b6d4", // cyan
  "#84cc16", // lime
]

interface EvaluationResultsManagementProps {
  questions: EvaluationQuestion[]
  professors: Professor[]
}

export function EvaluationResultsManagement({ questions, professors }: EvaluationResultsManagementProps) {
  const { toast } = useToast()

  // State variables
  const [searchQuery, setSearchQuery] = useState("") // Text para sa pag-search
  const [selectedDepartmentForResults, setSelectedDepartmentForResults] = useState<string>("") // Napiling department
  const [selectedQuestionForResults, setSelectedQuestionForResults] = useState<EvaluationQuestion | null>(null) // Tanong para sa results
  const [isQuestionResultsDialogOpen, setIsQuestionResultsDialogOpen] = useState(false) // Para sa results modal
  const [firebaseEvaluations, setFirebaseEvaluations] = useState<FirebaseEvaluationResult[]>([]) // Data ng evaluations
  const [unsubscribe, setUnsubscribe] = useState<(() => void) | null>(null) // Function para i-stop ang real-time updates
  const [googleChartsLoaded, setGoogleChartsLoaded] = useState(false) // Kung na-load na ba ang Google Charts
  const [questionAggregates, setQuestionAggregates] = useState<Record<string, QuestionAggregate>>({}) // Data ng mga question aggregates

  // Load Google Charts library para sa paggawa ng charts
  useEffect(() => {
    const loadGoogleCharts = () => {
      if (window.google && window.google.charts) {
        // Kung na-load na ang Google Charts, i-load lang ang corechart package
        window.google.charts.load("current", { packages: ["corechart"] })
        window.google.charts.setOnLoadCallback(() => {
          setGoogleChartsLoaded(true) // I-set na loaded na
        })
      } else {
        // Kung hindi pa na-load, gumawa ng script tag para i-load ang Google Charts
        const script = document.createElement("script")
        script.src = "https://www.gstatic.com/charts/loader.js"
        script.onload = () => {
          window.google.charts.load("current", { packages: ["corechart"] })
          window.google.charts.setOnLoadCallback(() => {
            setGoogleChartsLoaded(true) // I-set na loaded na
          })
        }
        document.head.appendChild(script) // I-add ang script sa HTML
      }
    }

    loadGoogleCharts() // Tawagin ang function
  }, []) // I-run lang once kapag na-mount ang component

  // Function para gumawa ng pie chart (bilog na chart)
  const drawPieChartForQuestion = (questionId: string, counts: Record<string, number>, order: string[]) => {
    if (!googleChartsLoaded) return // Hindi mag-draw kung hindi pa na-load ang Google Charts

    // Make sure we're getting the PIE chart container, not the bar chart container
    const el = document.getElementById(`pie-chart-${questionId}`) // Kunin ang element
    if (!el) {
      console.warn(`Pie chart container not found: pie-chart-${questionId}`)
      return // Hindi mag-draw kung walang element
    }

    // Verify this is the correct container by checking the ID
    if (!el.id.includes('pie-chart')) {
      console.error(`Wrong container for pie chart: ${el.id}`)
      return
    }

    // Clear the container first
    el.innerHTML = ''

    const data = new window.google.visualization.DataTable() // Gumawa ng data table
    data.addColumn("string", "Response") // Column para sa mga sagot
    data.addColumn("number", "Count") // Column para sa bilang

    order.forEach((answer) => {
      const count = counts[answer] || 0 // Kunin ang bilang ng sagot
      data.addRow([answer, count]) // I-add sa data table
    })

    const options = {
      title: "Response Distribution", // Title ng chart
      titleTextStyle: { fontSize: 16, bold: true, color: "#1e3a8a" }, // Style ng title (mas malaki, blue)
      pieHole: 0.4, // Butas sa gitna ng pie chart
      colors: chartColors.slice(0, order.length), // Mga colors
      backgroundColor: "transparent", // Transparent background
      legend: {
        position: "bottom",
        textStyle: { fontSize: 12, color: "#374151" },
        alignment: "center",
        maxLines: 2,
      }, // Legend sa baba
      chartArea: { width: "100%", height: "80%", left: 0, top: "10%" }, // Mas malaking chart area
      pieSliceBorderColor: "white", // White border para sa separation
      pieSliceBorderWidth: 2, // Border width
      pieSliceTextStyle: { color: "white", fontSize: 13, bold: true }, // Text style sa slices
      tooltip: {
        textStyle: { fontSize: 13, color: "#374151" },
        trigger: "selection",
      }, // Tooltip styling
      is3D: false, // Flat design
      enableInteractivity: true, // Enable hover effects
    }

    const chart = new window.google.visualization.PieChart(el) // Gumawa ng pie chart
    chart.draw(data, options) // I-draw ang chart
  }

  // Function para gumawa ng bar chart (bar na chart)
  const drawBarChartForQuestion = (questionId: string, counts: Record<string, number>, order: string[]) => {
    if (!googleChartsLoaded) return // Hindi mag-draw kung hindi pa na-load ang Google Charts

    // Make sure we're getting the BAR chart container, not the pie chart container
    const el = document.getElementById(`bar-chart-${questionId}`) // Kunin ang element
    if (!el) {
      console.warn(`Bar chart container not found: bar-chart-${questionId}`)
      return // Hindi mag-draw kung walang element
    }

    // Verify this is the correct container by checking the ID
    if (!el.id.includes('bar-chart')) {
      console.error(`Wrong container for bar chart: ${el.id}`)
      return
    }

    // Clear the container first
    el.innerHTML = ''

    const data = new window.google.visualization.DataTable() // Gumawa ng data table
    data.addColumn("string", "Answer") // Column para sa mga sagot
    data.addColumn("number", "Count") // Column para sa bilang

    order.forEach((answer) => {
      const count = counts[answer] || 0 // Kunin ang bilang ng sagot
      data.addRow([answer, count]) // I-add sa data table
    })

    const options = {
      title: "Answer Distribution", // Title ng chart
      titleTextStyle: { fontSize: 15, bold: true, color: "#374151" }, // Style ng title
      backgroundColor: "transparent", // Transparent background (container na lang may background)
      hAxis: {
        title: "Answers", // Title ng horizontal axis
        titleTextStyle: { fontSize: 12, bold: true, color: "#374151" },
        textStyle: { fontSize: 10, color: "#6b7280" },
        slantedText: true,
        slantedTextAngle: 45,
        gridlines: { color: "#e5e7eb", count: 5 },
        baselineColor: "#d1d5db",
      },
      vAxis: {
        title: "Count", // Title ng vertical axis
        titleTextStyle: { fontSize: 12, bold: true, color: "#374151" },
        textStyle: { fontSize: 10, color: "#6b7280" },
        minValue: 0, // Minimum value
        gridlines: {
          color: "#e5e7eb",
          count: 5,
        },
        baselineColor: "#d1d5db",
        format: "0",
      },
      colors: [chartColors[0]], // Color ng bars
      chartArea: {
        width: "75%",
        height: "65%",
        left: "15%",
        top: "18%",
      },
      legend: { position: "none" }, // Walang legend
      bar: {
        groupWidth: "65%", // Bar width (mas malapad)
      },
      animation: {
        startup: true,
        duration: 1000,
        easing: "out",
      },
      tooltip: {
        textStyle: { fontSize: 12, color: "#374151" },
      },
    }

    // IMPORTANT: Use ColumnChart for bar chart, NOT PieChart
    try {
      const chart = new window.google.visualization.ColumnChart(el) // Gumawa ng bar chart
      chart.draw(data, options) // I-draw ang chart
    } catch (error) {
      console.error(`Error drawing bar chart for question ${questionId}:`, error)
    }
  }

  // Get unique departments from professors
  const uniqueDepartments = useMemo(() => {
    const departments = new Set<string>()
    professors.forEach((professor) => {
      if (professor.departmentName) {
        departments.add(professor.departmentName)
      }
    })
    return Array.from(departments)
  }, [professors])

  // Filter departments based on search query
  const filteredDepartments = useMemo(() => {
    if (!searchQuery.trim()) {
      return uniqueDepartments
    }

    const query = searchQuery.toLowerCase()
    return uniqueDepartments.filter((department) => {
      // Search in department name
      if (department.toLowerCase().includes(query)) {
        return true
      }

      // Also search in professor names and emails within this department
      const departmentProfessors = professors.filter(p => p.departmentName === department)
      return departmentProfessors.some(professor =>
        professor.name.toLowerCase().includes(query) ||
        professor.email.toLowerCase().includes(query)
      )
    })
  }, [uniqueDepartments, searchQuery, professors])

  // Filter professors by selected department and search query
  const professorsByDepartment = useMemo(() => {
    if (!selectedDepartmentForResults) return []

    let filteredProfessors = professors
    if (selectedDepartmentForResults !== "all") {
      filteredProfessors = professors.filter((professor) => professor.departmentName === selectedDepartmentForResults)
    }

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase()
      filteredProfessors = filteredProfessors.filter(
        (professor) =>
          professor.name.toLowerCase().includes(query) ||
          professor.email.toLowerCase().includes(query) ||
          professor.departmentName.toLowerCase().includes(query)
      )
    }

    return filteredProfessors
  }, [professors, selectedDepartmentForResults, searchQuery])

  // Function to show evaluation results for a specific question
  const showQuestionResults = async (question: EvaluationQuestion) => {
    try {
      if (unsubscribe) {
        unsubscribe()
      }

      // Find the professor for this question
      const professor = professors.find((p) => p.id === question.teacherId)
      if (!professor) {
        toast({
          title: "Professor not found",
          description: "Could not find the professor for this question.",
          variant: "destructive",
        })
        return
      }

      // Get ALL questions for this professor, not just the selected one
      const professorQuestions = questions.filter((q) => q.teacherId === professor.id && q.isActive)

      if (professorQuestions.length === 0) {
        toast({
          title: "No questions found",
          description: "This professor has no active evaluation questions.",
          variant: "destructive",
        })
        return
      }

      const unsubscribeFn = firebaseEvaluationService.subscribeToEvaluationsByEmail(professor.email, (evaluations) => {
        console.log("Received Firebase evaluations:", evaluations)
        setFirebaseEvaluations(evaluations)
      })
      setUnsubscribe(() => unsubscribeFn)

      // Store the question so we can find all professor's questions in the useEffect
      setSelectedQuestionForResults(question)
      setIsQuestionResultsDialogOpen(true)
    } catch (error) {
      console.error("Error fetching question results:", error)
      toast({
        title: "Error loading results",
        description: "Could not load evaluation results for this question.",
        variant: "destructive",
      })
    }
  }

  // Cleanup subscription on unmount
  useEffect(() => {
    return () => {
      if (unsubscribe) {
        unsubscribe()
      }
    }
  }, [unsubscribe])

  // Process evaluation data for ALL questions from the professor
  useEffect(() => {
    if (!isQuestionResultsDialogOpen || !selectedQuestionForResults) return

    // Get all questions for this professor (either from the stored list or find them)
    const professor = professors.find((p) => p.id === selectedQuestionForResults.teacherId)
    const allProfessorQuestions = professor
      ? questions.filter((q) => q.teacherId === professor.id && q.isActive)
      : []

    if (allProfessorQuestions.length === 0) {
      setQuestionAggregates({})
      return
    }

    const aggregates: Record<string, QuestionAggregate> = {}

    firebaseEvaluations
      .filter((e) => (e.evaluationStatus as any) === "submitted")
      .forEach((evaluation) => {
        evaluation.responses.forEach((response) => {
          // Process ALL responses for ALL questions from this professor
          if (allProfessorQuestions.some(q => q.id === response.questionId)) {
            const qid = response.questionId
            if (!aggregates[qid]) {
              let baseOptions = Array.isArray(response.options) ? response.options : []
              if ((!baseOptions || baseOptions.length === 0) && response.questionType === "Likert Scale") {
                baseOptions = ["Strongly Agree", "Agree", "Disagree", "Strongly Disagree"]
              }
              const initialCounts: Record<string, number> = {}
              baseOptions.forEach((opt) => {
                initialCounts[String(opt)] = 0
              })
              aggregates[qid] = {
                questionId: qid,
                questionText: response.questionText,
                questionType: response.questionType,
                options: baseOptions,
                counts: initialCounts,
                textResponses: [],
              }
            }
            if (response.questionType === "text") {
              if (response.answer && String(response.answer).trim()) {
                aggregates[qid].textResponses!.push(String(response.answer))
              }
            } else if (response.questionType === "Likert Scale") {
              const answerKey = String(response.answer)
              aggregates[qid].counts[answerKey] = (aggregates[qid].counts[answerKey] || 0) + 1
            } else {
              const answerKey = String(response.answer)
              aggregates[qid].counts[answerKey] = (aggregates[qid].counts[answerKey] || 0) + 1
            }
          }
        })
      })

    setQuestionAggregates(aggregates)

    if (googleChartsLoaded && isQuestionResultsDialogOpen) {
      // Use longer timeout to ensure DOM is fully rendered
      setTimeout(() => {
        Object.values(aggregates).forEach((ag) => {
          const order = ag.options && ag.options.length > 0 ? ag.options : Object.keys(ag.counts)
          // Draw pie chart (donut) in the LEFT container
          drawPieChartForQuestion(ag.questionId, ag.counts, order)
          // Draw bar chart in the RIGHT container  
          drawBarChartForQuestion(ag.questionId, ag.counts, order)
        })
      }, 400)
    }
  }, [firebaseEvaluations, isQuestionResultsDialogOpen, selectedQuestionForResults, googleChartsLoaded, questions, professors])

  // Redraw charts when data changes
  useEffect(() => {
    if (!googleChartsLoaded || !isQuestionResultsDialogOpen) return
    const aggs = Object.values(questionAggregates)
    if (aggs.length === 0) return

    let resizeTimeout: NodeJS.Timeout | null = null

    const draw = () => {
      aggs.forEach((ag) => {
        const order = ag.options && ag.options.length > 0 ? ag.options : Object.keys(ag.counts)
        // Always draw pie chart first (left side), then bar chart (right side)
        drawPieChartForQuestion(ag.questionId, ag.counts, order)
        drawBarChartForQuestion(ag.questionId, ag.counts, order)
      })
    }

    const id = window.setTimeout(draw, 400)

    // Add resize listener to redraw charts when window is resized
    const handleResize = () => {
      if (resizeTimeout) clearTimeout(resizeTimeout)
      resizeTimeout = setTimeout(draw, 100)
    }
    window.addEventListener('resize', handleResize)

    return () => {
      window.clearTimeout(id)
      if (resizeTimeout) clearTimeout(resizeTimeout)
      window.removeEventListener('resize', handleResize)
    }
  }, [questionAggregates, googleChartsLoaded, isQuestionResultsDialogOpen])

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Department Results Section */}
      <div className="border rounded-lg bg-card" data-section="faculties-evaluation-results">
        <div className="pt-4 pb-4 px-4 sm:pt-6 sm:pb-6 sm:px-6">
          {/* Header Section - Improved Design */}
          <div className="pb-4 mb-4 sm:pb-6 sm:mb-8" data-section="faculties-header">
            <div className="flex items-center gap-2 sm:gap-3 mb-1 sm:mb-2" data-section="faculties-header-content">
              <div className="p-1.5 sm:p-2 rounded-lg bg-primary/10" data-section="faculties-header-icon">
                <BarChart3 className="h-5 w-5 sm:h-6 sm:w-6 text-primary" />
              </div>
              <div data-section="faculties-header-text">
                <CardTitle className="text-lg sm:text-xl md:text-2xl font-bold text-foreground">Faculties Evaluation Results</CardTitle>
                <CardDescription className="text-xs sm:text-sm md:text-base mt-0.5 sm:mt-1">Select a department to view evaluation results for professors</CardDescription>
              </div>
            </div>
          </div>

          <div className="space-y-6" data-section="faculties-main-content">
            {/* Search and Export Controls - Improved Design */}
            <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between" data-section="faculties-search-controls">
              <div className="flex-1 max-w-md" data-section="faculties-search-wrapper">
                <div className="relative" data-section="faculties-search-input-container">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search departments or professors..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10 pr-10 h-11 border-2 focus:border-primary/50 transition-colors"
                    data-input="faculties-search"
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
            </div>

            {/* Department Selection - Only show when no department is selected */}
            {!selectedDepartmentForResults && (
              <div className="space-y-6" data-section="faculties-department-selection">
                <div className="flex items-center gap-2" data-section="faculties-section-label">
                  <div className="h-1 w-8 bg-primary rounded-full" data-section="faculties-label-accent"></div>
                  <Label className="text-lg font-bold text-foreground">Select Faculties</Label>
                </div>
                {filteredDepartments.length === 0 ? (
                  <div className="text-center py-12 bg-muted/30 rounded-xl border-2 border-dashed border-border" data-section="faculties-empty-state">
                    <div className="w-20 h-20 bg-muted rounded-full flex items-center justify-center mx-auto mb-4" data-section="faculties-empty-icon">
                      <Search className="h-10 w-10 text-muted-foreground" />
                    </div>
                    <p className="text-foreground font-semibold text-lg" data-section="faculties-empty-title">
                      {searchQuery.trim() ? "No departments found" : "No departments available"}
                    </p>
                    <p className="text-muted-foreground text-sm mt-2" data-section="faculties-empty-description">
                      {searchQuery.trim()
                        ? `No departments match "${searchQuery}". Try a different search term.`
                        : "Add professors first to create departments"}
                    </p>
                    {searchQuery.trim() && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setSearchQuery("")}
                        className="mt-4"
                      >
                        <X className="h-4 w-4 mr-2" />
                        Clear Search
                      </Button>
                    )}
                  </div>
                ) : (
                  <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3" data-section="faculties-department-grid">
                    {/* Individual Department Cards - Improved Design */}
                    {filteredDepartments.map((department, index) => {
                      const colorSchemes = [
                        {
                          gradient: "from-blue-500/10 via-blue-400/5 to-transparent",
                          border: "border-blue-500/30",
                          hoverBorder: "hover:border-blue-500",
                          badge: "bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/20",
                          iconBg: "bg-blue-500/10",
                          textHover: "group-hover:text-blue-700 dark:group-hover:text-blue-400"
                        },
                        {
                          gradient: "from-green-500/10 via-green-400/5 to-transparent",
                          border: "border-green-500/30",
                          hoverBorder: "hover:border-green-500",
                          badge: "bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/20",
                          iconBg: "bg-green-500/10",
                          textHover: "group-hover:text-green-700 dark:group-hover:text-green-400"
                        },
                        {
                          gradient: "from-purple-500/10 via-purple-400/5 to-transparent",
                          border: "border-purple-500/30",
                          hoverBorder: "hover:border-purple-500",
                          badge: "bg-purple-500/10 text-purple-700 dark:text-purple-400 border-purple-500/20",
                          iconBg: "bg-purple-500/10",
                          textHover: "group-hover:text-purple-700 dark:group-hover:text-purple-400"
                        },
                        {
                          gradient: "from-orange-500/10 via-orange-400/5 to-transparent",
                          border: "border-orange-500/30",
                          hoverBorder: "hover:border-orange-500",
                          badge: "bg-orange-500/10 text-orange-700 dark:text-orange-400 border-orange-500/20",
                          iconBg: "bg-orange-500/10",
                          textHover: "group-hover:text-orange-700 dark:group-hover:text-orange-400"
                        },
                        {
                          gradient: "from-pink-500/10 via-pink-400/5 to-transparent",
                          border: "border-pink-500/30",
                          hoverBorder: "hover:border-pink-500",
                          badge: "bg-pink-500/10 text-pink-700 dark:text-pink-400 border-pink-500/20",
                          iconBg: "bg-pink-500/10",
                          textHover: "group-hover:text-pink-700 dark:group-hover:text-pink-400"
                        },
                        {
                          gradient: "from-indigo-500/10 via-indigo-400/5 to-transparent",
                          border: "border-indigo-500/30",
                          hoverBorder: "hover:border-indigo-500",
                          badge: "bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 border-indigo-500/20",
                          iconBg: "bg-indigo-500/10",
                          textHover: "group-hover:text-indigo-700 dark:group-hover:text-indigo-400"
                        },
                      ]
                      const colors = colorSchemes[index % colorSchemes.length]

                      // Get first letter of department name (skip BS, AB, B, Certificate, etc.)
                      const getFirstLetter = (departmentName: string) => {
                        if (!departmentName) return "?"
                        const trimmed = departmentName.trim()
                        const words = trimmed.split(/\s+/)

                        // If starts with BS, AB, B, Certificate, etc., get first letter of next word
                        if (words.length > 1 && /^(BS|AB|B|Certificate)$/i.test(words[0])) {
                          return words[1]?.[0]?.toUpperCase() || trimmed[0]?.toUpperCase() || "?"
                        }
                        return trimmed[0]?.toUpperCase() || "?"
                      }

                      const departmentLetter = getFirstLetter(department)
                      const professorCount = professors.filter(p => p.departmentName === department).length

                      return (
                        <Card
                          key={department}
                          className={`cursor-pointer transition-all duration-300 border-2 ${colors.border} ${colors.hoverBorder} bg-gradient-to-br ${colors.gradient} group hover:shadow-xl hover:scale-[1.02] hover:-translate-y-1 overflow-hidden relative`}
                          onClick={() => setSelectedDepartmentForResults(department)}
                          data-card="department-card"
                          data-department={department.toLowerCase().replace(/\s+/g, '-')}
                        >
                          {/* Decorative corner accent */}
                          <div
                            className={`absolute top-0 right-0 w-20 h-20 ${colors.iconBg} rounded-bl-full opacity-50 group-hover:opacity-100 transition-opacity`}
                            data-element="department-card-corner-accent"
                          ></div>

                          <CardContent className="p-6 relative z-10" data-section="department-card-content">
                            <div className="flex flex-col items-center text-center space-y-5" data-section="department-card-inner">
                              {/* Department Logo - Letter Icon */}
                              <div
                                className={`w-24 h-24 rounded-2xl overflow-hidden shadow-xl border-3 ${colors.border} group-hover:shadow-2xl transition-all duration-300 transform group-hover:scale-110 relative ${colors.iconBg}`}
                                data-element="department-logo-container"
                              >
                                <div
                                  className={`w-full h-full bg-gradient-to-br ${colors.gradient} flex items-center justify-center`}
                                  data-element="department-logo-placeholder"
                                >
                                  <span className={`text-3xl font-bold ${colors.textHover} transition-colors`} data-element="department-logo-initial">
                                    {departmentLetter}
                                  </span>
                                </div>
                                {/* Shine effect on hover */}
                                <div
                                  className="absolute inset-0 bg-gradient-to-br from-white/0 via-white/0 to-white/20 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                                  data-element="department-logo-shine-effect"
                                ></div>
                              </div>

                              {/* Department Info - Enhanced */}
                              <div className="space-y-3 w-full" data-section="department-info">
                                <h3
                                  className={`font-bold text-xl text-foreground ${colors.textHover} transition-colors`}
                                  data-element="department-name"
                                >
                                  {department}
                                </h3>
                                <div className="flex items-center justify-center gap-2" data-element="department-professor-count">
                                  <Badge variant="outline" className={`${colors.badge} font-semibold px-3 py-1`} data-badge="professor-count">
                                    <Users className="h-3 w-3 mr-1.5" />
                                    {professorCount} Professor{professorCount !== 1 ? "s" : ""}
                                  </Badge>
                                </div>
                              </div>

                              {/* Click indicator */}
                              <div
                                className="text-xs text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1"
                                data-element="department-click-indicator"
                              >
                                <span>Click to view</span>
                                <ArrowLeft className="h-3 w-3 rotate-180" />
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      )
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Professors from Selected Department */}
            {selectedDepartmentForResults && (
              <div className="space-y-3 sm:space-y-4">
                <div className="flex flex-col gap-3">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setSelectedDepartmentForResults("")}
                    className="flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm h-8 sm:h-9 px-2.5 sm:px-3 w-fit"
                  >
                    <ArrowLeft className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                    Back to Departments
                  </Button>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-sm sm:text-base md:text-lg font-semibold">
                      Professors in {selectedDepartmentForResults === "all" ? "All Faculties" : selectedDepartmentForResults}
                    </h3>
                    <Badge variant="secondary" className="text-xs sm:text-sm">
                      {professorsByDepartment.length} Professor{professorsByDepartment.length !== 1 ? "s" : ""}
                    </Badge>
                  </div>
                </div>

                {professorsByDepartment.length > 0 ? (
                  <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                    {professorsByDepartment.map((professor, index) => {
                      const borderColors = [
                        "border-l-blue-500",
                        "border-l-green-500",
                        "border-l-purple-500",
                        "border-l-orange-500",
                        "border-l-pink-500",
                        "border-l-indigo-500",
                      ]
                      const borderColor = borderColors[index % borderColors.length]

                      // Get questions count for this professor
                      const professorQuestionsCount = questions.filter(q => q.teacherId === professor.id).length

                      return (
                        <Card
                          key={professor.id}
                          className={`relative bg-white border-2 ${borderColor} rounded-lg overflow-hidden hover:shadow-lg transition-all duration-300`}
                        >
                          <div className="bg-gray-50 border-b border-gray-200 px-3 py-2">
                            <div className="flex items-center gap-2">
                              <div className="w-1.5 h-1.5 bg-blue-500 rounded-full"></div>
                              <span className="text-gray-800 font-bold text-xs uppercase tracking-wide">
                                {professor.departmentName}
                              </span>
                            </div>
                          </div>

                          <CardContent className="p-4">
                            <div className="flex items-start gap-3 mb-4">
                              <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center border-2 border-gray-300">
                                <svg className="w-8 h-8 text-gray-600" fill="currentColor" viewBox="0 0 24 24">
                                  <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
                                </svg>
                              </div>
                              <div className="flex-1">
                                <h3 className="font-bold text-gray-900 text-lg mb-1">{professor.name}</h3>
                                <p className="text-gray-600 text-xs font-medium">Professor</p>
                              </div>
                            </div>

                            <div className="space-y-3 mb-4">
                              <div className="flex items-center gap-2 text-gray-700">
                                <div className="w-1.5 h-1.5 bg-green-500 rounded-full"></div>
                                <span className="text-xs font-medium">{professor.email}</span>
                              </div>
                              <div className="flex items-center gap-2 text-gray-600">
                                <div className="w-1.5 h-1.5 bg-gray-400 rounded-full"></div>
                                <span className="text-xs">{professorQuestionsCount} evaluation question{professorQuestionsCount !== 1 ? "s" : ""}</span>
                              </div>
                            </div>

                            <div className="flex justify-center">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  // Find the first question for this professor to show results
                                  const firstQuestion = questions.find(q => q.teacherId === professor.id)
                                  if (firstQuestion) {
                                    showQuestionResults(firstQuestion)
                                  }
                                }}
                                className="w-full border-blue-300 text-blue-700 hover:bg-blue-50 hover:border-blue-400 transition-all duration-200 text-xs py-1 h-8"
                                disabled={professorQuestionsCount === 0}
                              >
                                <BarChart3 className="h-3 w-3 mr-1" />
                                View Results
                              </Button>
                            </div>
                          </CardContent>
                        </Card>
                      )
                    })}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                      <BarChart3 className="h-8 w-8 text-gray-400" />
                    </div>
                    <p className="text-gray-700 font-medium">No professors found in {selectedDepartmentForResults}</p>
                    <p className="text-gray-500 text-sm mt-2">Add professors to this department to view results</p>
                  </div>
                )}
              </div>
            )}

          </div>
        </div>
      </div>

      {/* Evaluation Results Custom Modal */}
      {isQuestionResultsDialogOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-2 sm:p-4">
          <div className="relative w-full max-w-[calc(100vw-1rem)] sm:max-w-4xl max-h-[95vh] sm:max-h-[90vh] bg-background overflow-hidden flex flex-col border rounded-lg shadow-2xl">
            {/* Custom Header */}
            <div className="bg-gray-800 text-white p-3 sm:p-4 md:p-6 flex-shrink-0">
              <div className="flex items-center justify-between gap-2 sm:gap-4">
                <div className="flex-1 min-w-0">
                  <h1 className="text-base sm:text-lg md:text-xl font-bold text-white flex items-center gap-2">
                    <BarChart3 className="h-4 w-4 sm:h-5 sm:w-5 flex-shrink-0" />
                    <span className="truncate">Student Evaluation Results</span>
                  </h1>
                  <p className="text-gray-300 text-[10px] sm:text-xs md:text-sm mt-0.5 sm:mt-1 hidden sm:block">
                    Complete analysis of all student responses
                  </p>
                </div>
                <button
                  onClick={() => setIsQuestionResultsDialogOpen(false)}
                  className="w-7 h-7 sm:w-8 sm:h-8 md:w-10 md:h-10 rounded-lg flex items-center justify-center hover:bg-gray-700 transition-colors text-white flex-shrink-0"
                >
                  <X className="h-4 w-4 sm:h-4 sm:w-4 md:h-5 md:w-5" />
                </button>
              </div>
            </div>

            {/* Content Area */}
            <div className="flex-1 overflow-y-auto overflow-x-hidden p-2 sm:p-4 md:p-6">
              {Object.values(questionAggregates).length > 0 ? (
                <div className="grid gap-3 sm:gap-4 md:gap-6 w-full max-w-full">
                  {Object.values(questionAggregates).map((q, index) => (
                    <Card key={q.questionId} className="border-2 shadow-md hover:shadow-lg transition-shadow w-full max-w-full overflow-hidden">
                      <CardContent className="p-3 sm:p-4 md:pt-4 w-full max-w-full overflow-hidden">
                        <div className="mb-3 sm:mb-4 flex flex-col sm:flex-row items-start justify-between gap-2 sm:gap-4 pb-2 sm:pb-3 border-b w-full">
                          <div className="flex-1 min-w-0 w-full sm:w-auto">
                            <div className="flex items-center gap-1.5 sm:gap-2 mb-1.5 sm:mb-2 flex-wrap">
                              <Badge variant="secondary" className="bg-blue-500 text-white text-[10px] sm:text-xs px-1.5 sm:px-2 py-0.5">
                                Q{index + 1}
                              </Badge>
                              <Badge variant="outline" className="text-[10px] sm:text-xs px-1.5 sm:px-2 py-0.5">
                                {q.questionType === "text" ? "Text" : "Likert"}
                              </Badge>
                            </div>
                            <div className="text-xs sm:text-sm font-medium break-words">
                              {q.questionText}
                            </div>
                          </div>
                          <div className="text-right bg-blue-50 rounded p-1.5 sm:p-2 border border-blue-200 flex-shrink-0 w-full sm:w-auto">
                            <div className="text-lg sm:text-xl md:text-2xl font-bold text-blue-600">
                              {q.questionType === "text"
                                ? q.textResponses?.length || 0
                                : Object.values(q.counts).reduce((a, b) => a + b, 0)}
                            </div>
                            <div className="text-[10px] sm:text-xs text-muted-foreground">Responses</div>
                          </div>
                        </div>
                        {q.questionType === "text" ? (
                          <div className="space-y-2">
                            {q.textResponses && q.textResponses.length > 0 ? (
                              <div className="space-y-2 max-h-48 overflow-auto pr-2">
                                {q.textResponses.map((txt, i) => (
                                  <div key={i} className="rounded-md border p-2 text-sm bg-background">
                                    {txt}
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <div className="text-sm text-muted-foreground">No text responses yet.</div>
                            )}
                          </div>
                        ) : (
                          <>
                            <div className="flex flex-wrap gap-2 mb-2">
                              {(q.options && q.options.length > 0 ? q.options : Object.keys(q.counts)).map((opt, idx) => {
                                const count = q.counts[opt] || 0
                                const total = Object.values(q.counts).reduce((a, b) => a + b, 0) || 1
                                const pct = Math.round((count / total) * 100)
                                const bg = chartColors[idx % chartColors.length] + "20"
                                const border = chartColors[idx % chartColors.length]
                                return (
                                  <span
                                    key={opt}
                                    className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs"
                                    style={{ backgroundColor: bg, border: `1px solid ${border}`, color: border }}
                                  >
                                    <span className="font-medium">{opt}</span>
                                    <span className="text-muted-foreground" style={{ color: border }}>
                                      {count} ({pct}%)
                                    </span>
                                  </span>
                                )
                              })}
                            </div>
                            <div className="grid grid-cols-2 gap-4 sm:gap-6 w-full">
                              <div className="w-full bg-gradient-to-br from-blue-50 to-indigo-50 rounded-lg p-3 shadow-sm border border-blue-100" id={`pie-chart-${q.questionId}`} style={{ height: "320px" }}>
                                {!googleChartsLoaded && (
                                  <div className="flex items-center justify-center h-full">
                                    <p className="text-muted-foreground text-sm">Loading chart...</p>
                                  </div>
                                )}
                              </div>
                              <div className="w-full bg-gradient-to-br from-slate-50 to-gray-50 rounded-lg p-3 shadow-sm border border-gray-200" id={`bar-chart-${q.questionId}`} style={{ height: "320px" }}>
                                {!googleChartsLoaded && (
                                  <div className="flex items-center justify-center h-full">
                                    <p className="text-muted-foreground text-sm">Loading chart...</p>
                                  </div>
                                )}
                              </div>
                            </div>
                          </>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12">
                  <BarChart3 className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
                  <p className="text-lg font-semibold text-muted-foreground">No evaluation responses found yet.</p>
                  <p className="text-sm text-muted-foreground mt-2">
                    Charts will update automatically when new evaluations are submitted.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

