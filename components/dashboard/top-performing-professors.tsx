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

import { useState, useEffect, useMemo, useRef } from "react"
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
import { evaluationQuestionService } from "@/lib/database"
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
  const [sortBy, setSortBy] = useState<"score" | "name" | "department">("score")
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc")

  // Category display names
  const categories = [
    { key: "Instructional Competence", label: "Instructional Competence" },
    { key: "Classroom Management", label: "Classroom Management" },
    { key: "Research", label: "Research" },
    { key: "Student Support & Development", label: "Student Support & Development" },
    { key: "Professionalism & Personal Qualities", label: "Professionalism & Personal Qualities" },
  ]

  // Fetch initial data immediately, then set up real-time listener
  useEffect(() => {
    setIsLoading(true)
    let isMounted = true
    let unsubscribe: (() => void) | null = null

    // Fetch initial data immediately for faster loading
    const loadInitialData = async () => {
      try {
        // Fetch questions and results in parallel
        const [results, questionsData] = await Promise.all([
          evaluationResultsService.getAll(),
          evaluationQuestionService.getActiveQuestions(),
        ])

        if (!isMounted) return

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
    if (score >= 90) return "text-chart-5" // Green for excellent
    if (score >= 80) return "text-primary" // Primary blue for very good
    if (score >= 70) return "text-chart-3" // Yellow for good
    if (score >= 60) return "text-orange-600" // Orange for satisfactory
    return "text-destructive" // Red for needs improvement
  }

  // Get progress bar color based on score - Custom colors per performance level
  const getProgressBarColor = (score: number) => {
    if (score >= 90) return "bg-[#628141]" // Specific green for excellent
    if (score >= 80) return "bg-green-500" // Green for very good
    if (score >= 70) return "bg-chart-3" // Yellow (var(--chart-3)) for good
    if (score >= 60) return "bg-orange-600" // Orange-600 for satisfactory
    return "bg-destructive" // Red (var(--destructive)) for needs improvement
  }

  // Get performance label
  const getPerformanceLabel = (score: number) => {
    if (score >= 90) return "Excellent"
    if (score >= 80) return "Very Good"
    if (score >= 70) return "Good"
    if (score >= 60) return "Satisfactory"
    if (score > 0) return "Needs Improvement"
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
          comparison = b.performanceScore - a.performanceScore
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
    doc.text(`All Professors Performance by Category`, 14, 18)
    doc.setFontSize(10)
    doc.setFont("helvetica", "normal")
    doc.setTextColor(120, 120, 120)
    doc.text(`Generated: ${new Date().toLocaleDateString()}`, 14, 26)

    const colX = [14, 30, 100, 190, 240]
    const colWidths = [14, 68, 88, 48, 40]
    const colHeaders = ["Rank", "Professor", "Department", "Performance", "Score"]
    const rowHeight = 8

    let y = 34
    let isFirstCategory = true

    // Loop through ALL categories
    categories.forEach((category) => {
      const categoryProfessors = allByCategory[category.key] || []
      if (categoryProfessors.length === 0) return

      const sorted = [...categoryProfessors].sort((a, b) => b.performanceScore - a.performanceScore)

      // New page if not enough room for header + at least one row
      if (!isFirstCategory && y > pageHeight - 40) {
        doc.addPage()
        y = 20
      }

      // Category header
      if (!isFirstCategory) y += 6
      doc.setFontSize(12)
      doc.setFont("helvetica", "bold")
      doc.setTextColor(30, 30, 30)
      doc.text(category.label, 14, y)
      y += 4
      doc.setDrawColor(59, 130, 246)
      doc.setLineWidth(0.5)
      doc.line(14, y, pageWidth - 14, y)
      y += 6

      // Table header
      doc.setFillColor(245, 245, 245)
      doc.rect(12, y - 6, pageWidth - 24, rowHeight + 2, "F")
      doc.setFontSize(10)
      doc.setFont("helvetica", "bold")
      doc.setTextColor(60, 60, 60)
      colHeaders.forEach((header, i) => doc.text(header, colX[i], y))

      doc.setFont("helvetica", "normal")
      doc.setTextColor(30, 30, 30)
      y += rowHeight + 2

      sorted.forEach((professor, index) => {
        if (y > pageHeight - 20) {
          doc.addPage()
          y = 20
          doc.setFillColor(245, 245, 245)
          doc.rect(12, y - 6, pageWidth - 24, rowHeight + 2, "F")
          doc.setFontSize(10)
          doc.setFont("helvetica", "bold")
          doc.setTextColor(60, 60, 60)
          colHeaders.forEach((header, i) => doc.text(header, colX[i], y))
          doc.setFont("helvetica", "normal")
          doc.setTextColor(30, 30, 30)
          y += rowHeight + 2
        }

        if (index % 2 === 0) {
          doc.setFillColor(252, 252, 252)
          doc.rect(12, y - 5, pageWidth - 24, rowHeight, "F")
        }

        doc.setFontSize(10)
        doc.text(`${index + 1}`, colX[0], y)
        doc.text(truncateText(professor.professorName || "", colWidths[1]), colX[1], y)
        doc.text(truncateText(professor.departmentName || "", colWidths[2]), colX[2], y)
        doc.text(getPerformanceLabel(professor.performanceScore), colX[3], y)
        doc.text(`${professor.performanceScore}%`, colX[4], y)
        y += rowHeight
      })

      y += 2
      doc.setFontSize(8)
      doc.setTextColor(120, 120, 120)
      doc.text(`${sorted.length} professor${sorted.length !== 1 ? "s" : ""} in ${category.label}`, 14, y)
      y += 6

      isFirstCategory = false
    })

    doc.save(`all_professors_performance_by_category.pdf`)
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
            <CardDescription>Top 3 professors per category based on Strongly Agree and Agree responses from student evaluations</CardDescription>
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
                Top 3 Performing Professors by Category
              </CardTitle>
              <CardDescription>Top 3 professors per category based on Strongly Agree and Agree responses from student evaluations</CardDescription>
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
                      <TrendingUp className="h-5 w-5   text-primary" />
                      All Professors Performance by Category
                    </DialogTitle>
                    <DialogDescription>
                      Complete performance rankings for all professors by category
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
                        variant={sortBy === "name" ? "default" : "outline"}
                        size="sm"
                        onClick={() => handleSort("name")}
                        className="gap-1"
                      >
                        <ArrowUpDown className="h-3 w-3" />
                        Name {sortBy === "name" && (sortOrder === "desc" ? "↓" : "↑")}
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
                          <TableHead className="text-center">Responses</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredAndSortedProfessors.length > 0 ? (
                          filteredAndSortedProfessors.map((professor, index) => (
                            <TableRow key={professor.professorId} className="hover:bg-muted/50">
                              <TableCell>
                                <div className={`flex items-center justify-center w-8 h-8 rounded-full font-bold text-sm ${getRankBadgeColor(index)}`}>
                                  {index + 1}
                                </div>
                              </TableCell>
                              <TableCell>
                                <div className="font-medium">{professor.professorName}</div>
                              </TableCell>
                              <TableCell>
                                <div className="text-sm text-muted-foreground">{professor.departmentName}</div>
                              </TableCell>
                              <TableCell>
                                <div className="space-y-1">
                                  <div className="relative h-2 w-full bg-muted rounded-full overflow-hidden">
                                    <div
                                      className={`h-full transition-all duration-500 ${getProgressBarColor(professor.performanceScore)}`}
                                      style={{ width: `${professor.performanceScore}%` }}
                                    />
                                  </div>
                                  <Badge
                                    variant="outline"
                                    className={`text-xs ${getPerformanceColor(professor.performanceScore)}`}
                                  >
                                    {getPerformanceLabel(professor.performanceScore)}
                                  </Badge>
                                </div>
                              </TableCell>
                              <TableCell className="text-center">
                                <div className={`font-bold ${getPerformanceColor(professor.performanceScore)}`}>
                                  {professor.performanceScore}%
                                </div>
                              </TableCell>
                              <TableCell className="text-center">
                                <div className="text-sm">
                                  <div className="text-chart-5 font-medium">
                                    {professor.positiveResponses}/{professor.totalResponses}
                                  </div>
                                  <div className="text-xs text-muted-foreground">
                                    SA: {professor.stronglyAgreeCount} | A: {professor.agreeCount}
                                  </div>
                                </div>
                              </TableCell>
                            </TableRow>
                          ))
                        ) : (
                          <TableRow>
                            <TableCell colSpan={6} className="text-center py-8">
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
                                <span className="text-muted-foreground">Performance</span>
                                <Badge
                                  variant="outline"
                                  className={`font-semibold ${getPerformanceColor(professor.performanceScore)}`}
                                >
                                  {getPerformanceLabel(professor.performanceScore)}
                                </Badge>
                              </div>
                              <div className="relative">
                                <div className="h-3 w-full bg-muted rounded-full overflow-hidden">
                                  <div
                                    className={`h-full transition-all duration-500 ${getProgressBarColor(professor.performanceScore)}`}
                                    style={{ width: `${professor.performanceScore}%` }}
                                  />
                                </div>
                                <div className="absolute inset-0 flex items-center justify-center">
                                  <span className="text-[10px] font-bold text-white drop-shadow-md">
                                    {professor.performanceScore}%
                                  </span>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Right side: Stats */}
                        <div className="flex-shrink-0 text-right space-y-1">
                          <div className={`font-bold text-2xl ${getPerformanceColor(professor.performanceScore)}`}>
                            {professor.performanceScore}%
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {professor.positiveResponses} positive / {professor.totalResponses} total
                          </div>
                          <div className="text-xs text-chart-5 font-medium">
                            SA: {professor.stronglyAgreeCount} | A: {professor.agreeCount}
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
              <p className="break-words">Based on percentage of positive responses (Strongly Agree + Agree) from student evaluations per category.</p>
              <div className="flex flex-wrap gap-3 mt-2">
                <span className="text-chart-5 font-medium whitespace-nowrap">● Excellent (90-100%)</span>
                <span className="text-primary font-medium whitespace-nowrap">● Very Good (80-89%)</span>
                <span className="text-chart-3 font-medium whitespace-nowrap">● Good (70-79%)</span>
                <span className="text-orange-600 font-medium whitespace-nowrap">● Satisfactory (60-69%)</span>
                <span className="text-destructive font-medium whitespace-nowrap">● Needs Improvement (&lt;60%)</span>
              </div>
              <p className="text-xs italic mt-2 break-words">SA = Strongly Agree, A = Agree</p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}


