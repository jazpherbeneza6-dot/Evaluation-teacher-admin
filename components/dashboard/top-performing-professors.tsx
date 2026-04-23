"use client"

/*
 * TopPerformingProfessors - Graphical representation of top performing professors by category
 * 
 * Features:
 * - Shows top 3 professors per category (Instructional Competence, Classroom Management, Research, Student Support & Development, Professionalism & Personal Qualities)
 * - Graphical bars showing performance scores
 * - Displays total evaluations for each professor
 * - Real-time updates from database
 * - Beautiful gradient design with animations
 */

import { useState, useEffect, useMemo, useRef, Fragment } from "react"
import { Card, CardContent, CardDescription, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Trophy, Award, Star, TrendingUp, MoreHorizontal, Search, ArrowUpDown, FileDown } from "lucide-react"
import jsPDF from "jspdf"
import { evaluationResultsService, type TopProfessorData } from "@/lib/evaluation-results-service"
import { evaluationQuestionService, evaluationDeadlineService } from "@/lib/database"
import type { EvaluationResult, EvaluationQuestion } from "@/lib/types"

export function TopPerformingProfessors() {
  const [topByCategory, setTopByCategory] = useState<{ [category: string]: TopProfessorData[] }>({})
  const [allByCategory, setAllByCategory] = useState<{ [category: string]: TopProfessorData[] }>({})
  const [questions, setQuestions] = useState<EvaluationQuestion[]>([])
  const questionsRef = useRef<EvaluationQuestion[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isViewAllOpen, setIsViewAllOpen] = useState(false)
  const [selectedCategory, setSelectedCategory] = useState<string>("")
  const [searchTerm, setSearchTerm] = useState("")
  const [activeSemester, setActiveSemester] = useState<string>("")
  const [sortBy, setSortBy] = useState<"score" | "name" | "department">("score")
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc")

  // Category display names
  const categories = [
    { key: "Instructional Competence", label: "Instructional Competence" },
    { key: "Classroom Management", label: "Classroom Management" },
    { key: "Student Support & Development", label: "Student Support & Development" },
    { key: "Professionalism & Personal Qualities", label: "Professionalism & Personal Qualities" },
    { key: "Research", label: "Research" },
  ]

  // Fetch initial data immediately, then set up real-time listener
  useEffect(() => {
    setIsLoading(true)
    let isMounted = true
    let unsubscribe: (() => void) | null = null

    // Fetch initial data immediately for faster loading
    const loadInitialData = async () => {
      try {
        // Fetch questions, results and active deadline in parallel
        const [results, questionsData, activeDeadline] = await Promise.all([
          evaluationResultsService.getAll(),
          evaluationQuestionService.getActiveQuestions(),
          evaluationDeadlineService.getActive()
        ])

        if (!isMounted) return

        if (activeDeadline) {
          setActiveSemester(activeDeadline.semester)
        }

        // Calculate top 3 per category
        const topByCat = evaluationResultsService.calculateTopPerformingProfessorsByCategory(results, questionsData, 3)

        // Calculate all professors per category (no limit)
        const allByCat = evaluationResultsService.calculateTopPerformingProfessorsByCategory(results, questionsData, 999)

        setTopByCategory(topByCat)
        setAllByCategory(allByCat)
        setQuestions(questionsData)
        questionsRef.current = questionsData
        setIsLoading(false)
      } catch (error) {
        console.error("Error loading initial top performing professors:", error)
        if (isMounted) {
          setTopByCategory({})
          setAllByCategory({})
          setQuestions([])
          setIsLoading(false)
        }
      }
    }

    // Load initial data first
    loadInitialData()

    // Then set up real-time listener for updates
    unsubscribe = evaluationResultsService.onEvaluationResultsChange(async (results) => {
      if (!isMounted) return

      try {
        // Fetch questions if not already loaded
        let currentQuestions = questionsRef.current
        if (currentQuestions.length === 0) {
          currentQuestions = await evaluationQuestionService.getActiveQuestions()
          if (isMounted) {
            setQuestions(currentQuestions)
            questionsRef.current = currentQuestions
          }
        }

        // Calculate top 3 per category
        const topByCat = evaluationResultsService.calculateTopPerformingProfessorsByCategory(results, currentQuestions, 3)

        // Calculate all professors per category (no limit)
        const allByCat = evaluationResultsService.calculateTopPerformingProfessorsByCategory(results, currentQuestions, 999)

        if (isMounted) {
          setTopByCategory(topByCat)
          setAllByCategory(allByCat)
          setIsLoading(false)
        }
      } catch (error) {
        console.error("Error processing top performing professors:", error)
        if (isMounted) {
          setTopByCategory({})
          setAllByCategory({})
          setIsLoading(false)
        }
      }
    })

    // Cleanup on unmount
    return () => {
      isMounted = false
      if (unsubscribe) {
        unsubscribe()
      }
    }
  }, [])

  // Get medal icon based on rank - Using system colors (for top 3)
  const getMedalIcon = (index: number) => {
    switch (index) {
      case 0:
        return <Trophy className="h-5 w-5 text-primary drop-shadow-sm" /> // Primary blue for #1
      case 1:
        return <Award className="h-5 w-5 text-chart-1 drop-shadow-sm" /> // Chart blue for #2
      case 2:
        return <Award className="h-5 w-5 text-chart-2 drop-shadow-sm" /> // Deep blue for #3
      default:
        return <Star className="h-5 w-5 text-chart-3 drop-shadow-sm" /> // Yellow for others
    }
  }

  // Get gradient color based on rank - Using system color palette with lighter opacity for white background (for top 3)
  const getGradientClass = (index: number) => {
    switch (index) {
      case 0:
        return "from-primary/8 via-primary/5 to-transparent" // Very light primary blue gradient for #1
      case 1:
        return "from-chart-1/8 via-chart-1/5 to-transparent" // Very light chart blue gradient for #2
      case 2:
        return "from-chart-2/8 via-chart-2/5 to-transparent" // Very light deep blue gradient for #3
      default:
        return "from-chart-3/8 via-chart-3/5 to-transparent" // Very light yellow gradient for others
    }
  }

  // Get rank badge color - Using system primary and chart colors (for top 3)
  const getRankBadgeColor = (index: number) => {
    switch (index) {
      case 0:
        return "bg-primary text-primary-foreground ring-2 ring-primary/30 shadow-md" // Primary blue for #1
      case 1:
        return "bg-chart-1 text-white ring-2 ring-chart-1/30 shadow-md" // Chart blue for #2
      case 2:
        return "bg-chart-2 text-white ring-2 ring-chart-2/30 shadow-md" // Deep blue for #3
      default:
        return "bg-muted text-muted-foreground ring-1 ring-border shadow-sm" // Muted for others
    }
  }

  // Get performance color based on score - Using system colors
  const getPerformanceColor = (score: number) => {
    if (score >= 4.5) return "text-chart-5" // Green for excellent
    if (score >= 3.5) return "text-primary" // Primary blue for very good
    if (score >= 2.5) return "text-chart-3" // Yellow for good
    if (score >= 1.5) return "text-orange-600" // Orange for satisfactory
    return "text-destructive" // Red for needs improvement
  }

  // Get progress bar color based on score - Custom colors per performance level
  const getProgressBarColor = (score: number) => {
    if (score >= 4.5) return "bg-[#628141]" // Specific green for excellent
    if (score >= 3.5) return "bg-green-500" // Green for very good
    if (score >= 2.5) return "bg-chart-3" // Yellow (var(--chart-3)) for good
    if (score >= 1.5) return "bg-orange-600" // Orange-600 for satisfactory
    return "bg-destructive" // Red (var(--destructive)) for needs improvement
  }

  // Get performance label
  const getPerformanceLabel = (score: number) => {
    if (score >= 4.5) return "Excellent"
    if (score >= 3.5) return "Very Satisfactory"
    if (score >= 2.5) return "Satisfactory"
    if (score >= 1.5) return "Fair"
    if (score > 0) return "Poor"
    return "No Data"
  }

  // Filter and sort all professors for the "View All" dialog
  const filteredAndSortedProfessors = useMemo(() => {
    if (!selectedCategory || !allByCategory[selectedCategory]) return []

    let filtered = allByCategory[selectedCategory]

    // Filter by search term
    if (searchTerm.trim()) {
      const term = searchTerm.trim().toLowerCase()
      filtered = filtered.filter((prof) =>
        prof.professorName.toLowerCase().includes(term) ||
        prof.departmentName.toLowerCase().includes(term)
      )
    }

    // Sort
    filtered = [...filtered].sort((a, b) => {
      let comparison = 0
      switch (sortBy) {
        case "score":
          comparison = b.averageRating - a.averageRating
          if (comparison === 0) comparison = a.professorName.localeCompare(b.professorName)
          break
        case "name":
          comparison = a.professorName.localeCompare(b.professorName)
          break
        case "department":
          comparison = a.departmentName.localeCompare(b.departmentName)
          break
      }
      return sortOrder === "asc" ? -comparison : comparison
    })

    return filtered
  }, [allByCategory, selectedCategory, searchTerm, sortBy, sortOrder])

  const handleSort = (column: "score" | "name" | "department") => {
    if (sortBy === column) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc")
    } else {
      setSortBy(column)
      setSortOrder("desc")
    }
  }

  // Export ALL categories data to PDF (all sections in one file)
  const exportToPDF = () => {
    const hasAnyData = categories.some(cat => (allByCategory[cat.key]?.length || 0) > 0)
    if (!hasAnyData) return

    const doc = new jsPDF({ orientation: "landscape" })
    const pageWidth = doc.internal.pageSize.getWidth()
    const pageHeight = doc.internal.pageSize.getHeight()

    // Helper: truncate text to fit within a max width (in PDF units)
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
    doc.text(`All Professors Performance by ${sortBy === "department" ? "Department" : "Category"}`, 14, 18)
    doc.setFontSize(10)
    doc.setFont("helvetica", "normal")
    doc.setTextColor(120, 120, 120)
    doc.text(`Generated: ${new Date().toLocaleDateString()}`, 14, 26)

    const colX_grouped = [14, 30, 190, 240]
    const colWidths_grouped = [14, 150, 48, 40]
    const colHeaders_grouped = ["Rank", "Professor", "Performance", "Score"]

    const colX_flat = [14, 30, 110, 190, 240]
    const colWidths_flat = [14, 75, 75, 48, 40]
    const colHeaders_flat = ["Rank", "Professor", "Department", "Performance", "Score"]

    const isGrouped = sortBy === "department"
    const colX = isGrouped ? colX_grouped : colX_flat
    const colWidths = isGrouped ? colWidths_grouped : colWidths_flat
    const colHeaders = isGrouped ? colHeaders_grouped : colHeaders_flat
    const rowHeight = 8

    let y = 34
    let isFirstCategory = true

    // Loop through ALL categories
    categories.forEach((category) => {
      const categoryProfessors = allByCategory[category.key] || []
      if (categoryProfessors.length === 0) return

      // Pre-calculate global ranks for this category with tie-breaker
      const globalSorted = [...categoryProfessors].sort((a, b) => {
        const scoreDiff = b.averageRating - a.averageRating
        if (scoreDiff !== 0) return scoreDiff
        return a.professorName.localeCompare(b.professorName)
      })
      const rankMap = new Map<string, number>()
      globalSorted.forEach((p, i) => rankMap.set(p.professorId, i + 1))

      // Group professors by department within this category
      const deptGroups = categoryProfessors.reduce((acc, p) => {
        const dept = p.departmentName || "General"
        if (!acc[dept]) acc[dept] = []
        acc[dept].push(p)
        return acc
      }, {} as { [key: string]: TopProfessorData[] })

      // Sort departments by the global rank of their best professor (min rank)
      const sortedDepts = Object.keys(deptGroups).sort((a, b) => {
        const minRankA = Math.min(...deptGroups[a].map(p => rankMap.get(p.professorId) || 999))
        const minRankB = Math.min(...deptGroups[b].map(p => rankMap.get(p.professorId) || 999))
        return minRankA - minRankB
      })

      // New page if not enough room for category header + at least one department divider and row
      if (!isFirstCategory && y > pageHeight - 50) {
        doc.addPage()
        y = 20
      }

      // Category header - Premium Slate 900
      if (!isFirstCategory) y += 8
      doc.setFontSize(14)
      doc.setFont("helvetica", "bold")
      doc.setTextColor(15, 23, 42)
      doc.text(category.label, 14, y)
      y += 4
      doc.setDrawColor(30, 80, 160) // Professional Blue
      doc.setLineWidth(1)
      doc.line(14, y, pageWidth - 14, y)
      y += 12

      let isHeaderOnPage = false

      if (isGrouped) {
        // Grouped rendering (Department dividers)
        sortedDepts.forEach((dept) => {
          const deptProfs = [...deptGroups[dept]].sort((a, b) => b.performanceScore - a.performanceScore)

          if (y > pageHeight - 35) {
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

          doc.setFillColor(239, 246, 255)
          doc.rect(12, y - 5, pageWidth - 24, rowHeight, "F")
          doc.setFont("helvetica", "bold")
          doc.setFontSize(9)
          doc.setTextColor(30, 58, 138)
          doc.text(`DEPARTMENT: ${truncateText(dept.toUpperCase(), 220)}`, 14, y)
          y += rowHeight

          deptProfs.forEach((professor, index) => {
            if (y > pageHeight - 20) {
              doc.addPage()
              y = 20
              isHeaderOnPage = false
              doc.setFillColor(241, 245, 249)
              doc.rect(12, y - 6, pageWidth - 24, rowHeight + 2, "F")
              doc.setFontSize(9)
              doc.setFont("helvetica", "bold")
              doc.setTextColor(71, 85, 105)
              colHeaders.forEach((header, i) => doc.text(header.toUpperCase(), colX[i], y))
              y += rowHeight + 2
              isHeaderOnPage = true

              doc.setFillColor(239, 246, 255)
              doc.rect(12, y - 5, pageWidth - 24, rowHeight, "F")
              doc.setFont("helvetica", "bold")
              doc.setTextColor(30, 58, 138)
              doc.text(`DEPARTMENT: ${truncateText(dept.toUpperCase(), 180)} (CONT...)`, 14, y)
              y += rowHeight
            }

            if (index % 2 !== 0) {
              doc.setFillColor(248, 250, 252)
              doc.rect(12, y - 5, pageWidth - 24, rowHeight, "F")
            }

            doc.setFont("helvetica", "normal").setTextColor(15, 23, 42).setFontSize(10)
            const rank = rankMap.get(professor.professorId) || 0
            doc.text(`${rank}`, colX[0], y)
            doc.text(truncateText(professor.professorName || "", colWidths[1]), colX[1], y)

            const label = getPerformanceLabel(professor.averageRating)
            if (label === "Excellent") doc.setTextColor(21, 128, 61)
            else if (label === "Very Satisfactory") doc.setTextColor(37, 99, 235)
            else if (label === "Satisfactory") doc.setTextColor(180, 83, 9)
            else doc.setTextColor(220, 38, 38)

            doc.text(label, colX[2], y)
            doc.setTextColor(15, 23, 42).setFont("helvetica", "bold")
            doc.text(`${professor.averageRating.toFixed(2)}`, colX[3], y)
            doc.setFont("helvetica", "normal")
            y += rowHeight
          })
          y += 4
        })
      } else {
        // Flat rendering (Global ranking with Department column)
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
          if (label === "Excellent") doc.setTextColor(21, 128, 61)
          else if (label === "Very Satisfactory") doc.setTextColor(37, 99, 235)
          else if (label === "Satisfactory") doc.setTextColor(180, 83, 9)
          else doc.setTextColor(220, 38, 38)

          doc.text(label, colX[3], y)
          doc.setTextColor(15, 23, 42).setFont("helvetica", "bold")
          doc.text(`${professor.averageRating.toFixed(2)}`, colX[4], y)
          doc.setFont("helvetica", "normal")
          y += rowHeight
        })
      }

      y += 2
      doc.setFontSize(8)
      doc.setTextColor(100, 116, 139) // Slate 500
      doc.text(`${categoryProfessors.length} professor${categoryProfessors.length !== 1 ? "s" : ""} in ${category.label}`, 14, y)
      y += 12

      isFirstCategory = false
    })

    doc.save(`all_professors_performance_by_${sortBy === "department" ? "department" : "category"}_${new Date().toISOString().split('T')[0]}.pdf`)
  }

  // Get total count of all professors across all categories
  const totalProfessorsCount = useMemo(() => {
    return Object.values(allByCategory).reduce((sum, profs) => sum + profs.length, 0)
  }, [allByCategory])

  if (isLoading) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="pb-4 border-b border-border mb-6">
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-primary" />
              Top 3 Performing Professors by Category
            </CardTitle>
            <CardDescription>Top 3 professors per category based on Excellent and Very Satisfactory responses from student evaluations</CardDescription>
          </div>
          <div className="space-y-4">
            {[...Array(3)].map((_, index) => (
              <div
                key={index}
                className="h-24 rounded-lg bg-muted/50 animate-pulse"
              />
            ))}
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardContent className="pt-6 pb-6">
        <div className="pb-4 border-b border-border mb-6">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-primary" />
                <span>Top 3 Performing Professors by Category</span>
                {activeSemester && (
                  <Badge variant="secondary" className="bg-primary/10 text-primary border-primary/20 font-semibold">
                    {activeSemester === "1st" ? "1st Sem" : "2nd Sem"}
                  </Badge>
                )}
              </CardTitle>
              <CardDescription>Top 3 professors per category based on Excellent and Very Satisfactory responses from student evaluations</CardDescription>
            </div>
            {totalProfessorsCount > 0 && (
              <Dialog open={isViewAllOpen} onOpenChange={setIsViewAllOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm" className="gap-2">
                    <MoreHorizontal className="h-4 w-4" />
                    View All
                  </Button>
                </DialogTrigger>
                <DialogContent style={{ width: 'calc(100vw - 40px)', maxWidth: 'calc(100vw - 40px)' }} className="max-h-[90vh] flex flex-col">
                  <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                      <TrendingUp className="h-5 w-5 text-primary" />
                      <span>All Professors Performance by {sortBy === "department" ? "Department" : "Category"}</span>
                      {activeSemester && (
                        <Badge variant="secondary" className="ml-2 bg-primary/10 text-primary border-primary/20 animate-in fade-in zoom-in duration-300">
                          {activeSemester === "1st" ? "1st Semester" : "2nd Semester"}
                        </Badge>
                      )}
                    </DialogTitle>
                    <DialogDescription>
                      Complete performance rankings for all professors by {sortBy === "department" ? "department" : "category"}
                    </DialogDescription>
                  </DialogHeader>

                  {/* Export PDF Button */}
                  <div className="flex justify-end -mt-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={exportToPDF}
                      disabled={!categories.some(cat => (allByCategory[cat.key]?.length || 0) > 0)}
                      className="gap-2"
                    >
                      <FileDown className="h-4 w-4" />
                      Export All PDF
                    </Button>
                  </div>

                  {/* Category Selection */}
                  <div className="pb-4 border-b">
                    <Tabs value={selectedCategory} onValueChange={setSelectedCategory} className="w-full">
                      <TabsList className="grid w-full grid-cols-5">
                        {categories.map((cat) => (
                          <TabsTrigger key={cat.key} value={cat.key} className="text-xs">
                            {cat.label.split(" ")[0]}
                          </TabsTrigger>
                        ))}
                      </TabsList>
                    </Tabs>
                  </div>

                  {/* Search and Sort Controls */}
                  <div className="flex flex-col sm:flex-row gap-4 pb-4 border-b">
                    <div className="flex-1 relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Search by name or department..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-9"
                      />
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant={sortBy === "score" ? "default" : "outline"}
                        size="sm"
                        onClick={() => handleSort("score")}
                        className="gap-1"
                      >
                        <ArrowUpDown className="h-3 w-3" />
                        Score {sortBy === "score" && (sortOrder === "desc" ? "↓" : "↑")}
                      </Button>
                      <Button
                        variant={sortBy === "department" ? "default" : "outline"}
                        size="sm"
                        onClick={() => handleSort("department")}
                        className="gap-1"
                      >
                        <ArrowUpDown className="h-3 w-3" />
                        Dept {sortBy === "department" && (sortOrder === "desc" ? "↓" : "↑")}
                      </Button>
                    </div>
                  </div>

                  {/* Professors Table */}
                  <div className="flex-1 overflow-y-auto min-h-0">
                    <Table>
                      <TableHeader className="sticky top-0 bg-background z-10">
                        <TableRow>
                          <TableHead className="w-[60px]">Rank</TableHead>
                          <TableHead>Professor</TableHead>
                          <TableHead>Department</TableHead>
                          <TableHead className="text-center">Performance</TableHead>
                          <TableHead className="text-center">Score</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredAndSortedProfessors.length > 0 ? (
                          (() => {
                            // Pre-calculate global ranks based on SCORE, with name TIE-BREAKER
                            const scoreSortedProfessors = [...filteredAndSortedProfessors].sort((a, b) => {
                              const scoreDiff = b.averageRating - a.averageRating
                              if (scoreDiff !== 0) return scoreDiff
                              return a.professorName.localeCompare(b.professorName)
                            })
                            const rankMap = new Map<string, number>()
                            scoreSortedProfessors.forEach((p, i) => rankMap.set(p.professorId, i + 1))

                            // CONDITIONAL GROUPING: Only group by department if sortBy is 'department'
                            if (sortBy === "department") {
                              const groups: { [dept: string]: TopProfessorData[] } = {}
                              filteredAndSortedProfessors.forEach(p => {
                                const dept = p.departmentName || "General"
                                if (!groups[dept]) groups[dept] = []
                                groups[dept].push(p)
                              })

                              // Sort departments by their #1 ranked professor's global rank (min rank)
                              const sortedDepts = Object.keys(groups).sort((a, b) => {
                                const minRankA = Math.min(...groups[a].map(p => rankMap.get(p.professorId) || 999))
                                const minRankB = Math.min(...groups[b].map(p => rankMap.get(p.professorId) || 999))
                                return minRankA - minRankB
                              })

                              return sortedDepts.map(dept => (
                                <Fragment key={dept}>
                                  <TableRow className="bg-primary/5 hover:bg-primary/5 border-l-4 border-l-primary/40">
                                    <TableCell colSpan={5} className="py-2 px-4 shadow-sm">
                                      <div className="flex items-center gap-2">
                                        <div className="w-1.5 h-1.5 rounded-full bg-primary/60" />
                                        <span className="font-bold text-primary/80 text-[10px] uppercase tracking-widest">FACULTY: {dept}</span>
                                        <span className="text-[10px] text-muted-foreground font-normal">
                                          ({groups[dept].length} professor{groups[dept].length !== 1 ? 's' : ''})
                                        </span>
                                      </div>
                                    </TableCell>
                                  </TableRow>
                                  {groups[dept].map((professor) => (
                                    <TableRow key={professor.professorId} className="hover:bg-muted/50 transition-colors">
                                      <TableCell>
                                        <div className={`flex items-center justify-center w-8 h-8 rounded-full font-bold text-sm shadow-sm ${getRankBadgeColor((rankMap.get(professor.professorId) || 1) - 1)}`}>
                                          {rankMap.get(professor.professorId)}
                                        </div>
                                      </TableCell>
                                      <TableCell>
                                        <div className="font-medium text-sm sm:text-base">{professor.professorName}</div>
                                      </TableCell>
                                      <TableCell>
                                        <div className="text-xs sm:text-sm text-muted-foreground truncate max-w-[150px]">{professor.departmentName}</div>
                                      </TableCell>
                                      <TableCell>
                                        <div className="space-y-1 w-full max-w-[250px]">
                                          <div className="relative h-2.5 w-full bg-muted rounded-full overflow-hidden shadow-inner">
                                            <div
                                              className={`h-full transition-all duration-700 ease-out ${getProgressBarColor(professor.averageRating)}`}
                                              style={{ width: `${(professor.averageRating / 5) * 100}%` }}
                                            />
                                          </div>
                                          <Badge
                                            variant="outline"
                                            className={`text-[10px] h-4 font-semibold ${getPerformanceColor(professor.averageRating)} border-current/20`}
                                          >
                                            {getPerformanceLabel(professor.averageRating)}
                                          </Badge>
                                        </div>
                                      </TableCell>
                                      <TableCell className="text-center">
                                        <div className={`font-bold text-sm sm:text-base ${getPerformanceColor(professor.averageRating)}`}>
                                          {professor.averageRating.toFixed(2)}
                                        </div>
                                      </TableCell>
                                    </TableRow>
                                  ))}
                                </Fragment>
                              ))
                            }

                            // DEFAULT: Flat list (No grouping headers)
                            return filteredAndSortedProfessors.map((professor) => (
                              <TableRow key={professor.professorId} className="hover:bg-muted/50 transition-colors">
                                <TableCell>
                                  <div className={`flex items-center justify-center w-8 h-8 rounded-full font-bold text-sm shadow-sm ${getRankBadgeColor((rankMap.get(professor.professorId) || 1) - 1)}`}>
                                    {rankMap.get(professor.professorId)}
                                  </div>
                                </TableCell>
                                <TableCell>
                                  <div className="font-medium text-sm sm:text-base">{professor.professorName}</div>
                                </TableCell>
                                <TableCell>
                                  <div className="text-xs sm:text-sm text-muted-foreground truncate max-w-[150px]">{professor.departmentName}</div>
                                </TableCell>
                                <TableCell>
                                  <div className="space-y-1 w-full max-w-[250px]">
                                    <div className="relative h-2.5 w-full bg-muted rounded-full overflow-hidden shadow-inner">
                                      <div
                                        className={`h-full transition-all duration-700 ease-out ${getProgressBarColor(professor.averageRating)}`}
                                        style={{ width: `${(professor.averageRating / 5) * 100}%` }}
                                      />
                                    </div>
                                    <Badge
                                      variant="outline"
                                      className={`text-[10px] h-4 font-semibold ${getPerformanceColor(professor.averageRating)} border-current/20`}
                                    >
                                      {getPerformanceLabel(professor.averageRating)}
                                    </Badge>
                                  </div>
                                </TableCell>
                                <TableCell className="text-center">
                                  <div className={`font-bold text-sm sm:text-base ${getPerformanceColor(professor.averageRating)}`}>
                                    {professor.averageRating.toFixed(2)}
                                  </div>
                                </TableCell>
                              </TableRow>
                            ))
                          })()
                        ) : (
                          <TableRow>
                            <TableCell colSpan={5} className="text-center py-8">
                              <div className="text-muted-foreground">
                                {searchTerm ? "No professors found matching your search." : "No evaluation data available."}
                              </div>
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </div>

                  {/* Summary Footer */}
                  {filteredAndSortedProfessors.length > 0 && selectedCategory && (
                    <div className="pt-4 border-t text-sm text-muted-foreground">
                      Showing {filteredAndSortedProfessors.length} of {allByCategory[selectedCategory]?.length || 0} professors in {selectedCategory}
                      {searchTerm && ` matching "${searchTerm}"`}
                    </div>
                  )}
                </DialogContent>
              </Dialog>
            )}
          </div>
        </div>

        {/* Category Tabs */}
        <Tabs defaultValue={categories[0].key} className="w-full">
          <TabsList className="grid w-full grid-cols-5 mb-6 h-auto p-1.5 bg-muted/30 gap-1.5 rounded-lg">
            {categories.map((cat) => (
              <TabsTrigger
                key={cat.key}
                value={cat.key}
                className="text-[11px] sm:text-xs px-2 sm:px-3 py-2.5 sm:py-3 font-medium transition-all duration-200 data-[state=active]:bg-background data-[state=active]:shadow-md data-[state=active]:text-foreground data-[state=active]:font-semibold data-[state=inactive]:text-muted-foreground hover:text-foreground hover:bg-muted/50 whitespace-normal break-words leading-tight rounded-md min-h-[44px] flex items-center justify-center text-center"
              >
                <span className="block">{cat.label}</span>
              </TabsTrigger>
            ))}
          </TabsList>

          {categories.map((category) => (
            <TabsContent key={category.key} value={category.key} className="space-y-4 mt-0 mb-0">
              {topByCategory[category.key] && topByCategory[category.key].length > 0 ? (
                topByCategory[category.key].slice(0, 3).map((professor, index) => (
                  <div
                    key={`${professor.professorId}-${index}`}
                    className={`relative overflow-hidden rounded-lg border border-border transition-all duration-300 hover:shadow-lg hover:scale-[1.02] bg-white dark:bg-card bg-gradient-to-r ${getGradientClass(index)}`}
                  >
                    <div className="p-4">
                      <div className="flex items-start justify-between gap-4">
                        {/* Left side: Rank, Medal, and Professor Info */}
                        <div className="flex items-start gap-4 flex-1 min-w-0">
                          {/* Rank Badge */}
                          <div className={`flex-shrink-0 flex items-center justify-center w-12 h-12 rounded-full font-bold text-xl shadow-lg ${getRankBadgeColor(index)}`}>
                            {index + 1}
                          </div>

                          {/* Medal Icon */}
                          <div className="flex-shrink-0 mt-3">
                            {getMedalIcon(index)}
                          </div>

                          {/* Professor Details */}
                          <div className="flex-1 min-w-0 space-y-2">
                            <div>
                              <h3 className="font-semibold text-base text-foreground break-words">
                                {professor.professorName}
                              </h3>
                              <p className="text-sm text-muted-foreground break-words">
                                {professor.departmentName}
                              </p>
                            </div>

                            {/* Performance Bar */}
                            <div className="space-y-1.5">
                              <div className="flex items-center justify-between text-xs">
                                <span className="text-muted-foreground">Average Score</span>
                                <Badge
                                  variant="outline"
                                  className={`font-semibold ${getPerformanceColor(professor.averageRating)}`}
                                >
                                  {getPerformanceLabel(professor.averageRating)}
                                </Badge>
                              </div>
                              <div className="relative">
                                <div className="h-3 w-full bg-muted rounded-full overflow-hidden">
                                  <div
                                    className={`h-full transition-all duration-500 ${getProgressBarColor(professor.averageRating)}`}
                                    style={{ width: `${(professor.averageRating / 5) * 100}%` }}
                                  />
                                </div>
                                <div className="absolute inset-0 flex items-center justify-center">
                                  <span className="text-[10px] font-bold text-white drop-shadow-md">
                                    {professor.averageRating.toFixed(2)}
                                  </span>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Right side: Stats */}
                        <div className="flex-shrink-0 text-right space-y-1">
                          <div className={`font-bold text-2xl ${getPerformanceColor(professor.averageRating)}`}>
                            {professor.averageRating.toFixed(2)}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {professor.totalResponses} responses
                          </div>
                          <div className="text-xs text-chart-5 font-medium">
                            E: {professor.excellentCount} | VS: {professor.verySatisfactoryCount}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {professor.totalEvaluations} respondent{professor.totalEvaluations !== 1 ? 's' : ''}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Bottom gradient line for visual effect */}
                    <div className={`h-1 bg-gradient-to-r ${getGradientClass(index)}`} />
                  </div>
                ))
              ) : (
                /* Empty state for category */
                <div className="text-center py-12 space-y-4">
                  <div className="flex justify-center">
                    <Trophy className="h-16 w-16 text-muted-foreground/50" />
                  </div>
                  <div>
                    <p className="text-muted-foreground font-medium">No evaluation data available for {category.label} yet.</p>
                    <p className="text-xs text-muted-foreground mt-2">
                      Top performing professors in this category will appear here once students submit their evaluations.
                    </p>
                  </div>
                </div>
              )}
            </TabsContent>
          ))}
        </Tabs>

        {/* Legend */}
        {Object.values(topByCategory).some(profs => profs.length > 0) && (
          <div className="mt-6 mb-0 pt-4 pb-0 border-t border-border">
            <div className="text-xs text-muted-foreground space-y-2">
              <p className="font-medium">Performance Calculation:</p>
              <p className="break-words">Based on the weighted Average Score (1.00 - 5.00) from student evaluations per category.</p>
              <div className="flex flex-wrap gap-3 mt-2">
                <span className="text-destructive font-medium whitespace-nowrap">● Poor (&lt; 1.50)</span>
                <span className="text-orange-600 font-medium whitespace-nowrap">● Fair (1.50 - 2.49)</span>
                <span className="text-chart-3 font-medium whitespace-nowrap">● Satisfactory (2.50 - 3.49)</span>
                <span className="text-primary font-medium whitespace-nowrap">● Very Satisfactory (3.50 - 4.49)</span>
                <span className="text-chart-5 font-medium whitespace-nowrap">● Excellent (4.50 - 5.00)</span>
              </div>
              <p className="text-xs italic mt-2 break-words">E = Excellent, VS = Very Satisfactory</p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}


