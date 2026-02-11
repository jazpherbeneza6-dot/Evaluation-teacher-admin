"use client"

/*
 * DashboardOverview - Ito ang main overview page ng admin dashboard
 * 
 * Mga Features:
 * 1. Summary cards na nagpapakita ng key statistics
 * 2. Real-time charts para sa visual data representation
 * 3. Top performing professors list
 * 4. Department-wise completion rates
 * 5. Overall completion percentage
 * 
 * Mga Statistics na Ipinapakita:
 * - Total faculties (departments)
 * - Total professors
 * - Total evaluations submitted
 * - Overall completion rate
 * - Department-wise breakdown
 * - Top 5 performing professors
 * 
 * Paano gumagana:
 * - Kinukuha ang data mula sa props (stats, departments, professors, totalEvaluations)
 * - Ginagamit ang useMemo para sa efficient calculations
 * - I-render ang mga cards, charts, at lists
 * - Real-time updates kada 30 seconds
 */

import { useMemo } from "react"
import { Card, CardContent, CardDescription, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Users, Building2, FileText, TrendingUp, CheckCircle2 } from "lucide-react"
import type { EvaluationStats, Department, Professor } from "@/lib/types"
import { RealTimeCharts } from "@/components/charts/real-time-charts"
import { TopPerformingProfessors } from "./top-performing-professors"

// Interface para sa props ng DashboardOverview
interface DashboardOverviewProps {
  stats: EvaluationStats[] // Array ng evaluation statistics
  departments: Department[] // Array ng departments
  professors: Professor[] // Array ng professors
  totalEvaluations: number // Total number ng submitted evaluations
  totalStudents: number // Total number of registered students
  completedStudents: number // Students who completed ALL assigned evaluations
}

export function DashboardOverview({ stats, departments, professors, totalEvaluations, totalStudents, completedStudents }: DashboardOverviewProps) {
  // useMemo para sa efficient calculations - hindi magre-recalculate unless mag-change ang dependencies
  const overviewData = useMemo(() => {
    // Calculate overall completion rate
    // Total submitted evaluations = sum of all submitted evaluations across all professors
    const totalSubmittedEvaluations = stats.reduce((sum, stat) => sum + stat.submittedEvaluations, 0)

    // Total possible evaluations = sum of totalStudents for all professors
    // Since each professor has the same totalStudents (all students), this equals professors × students
    const totalPossibleEvaluations = stats.reduce((sum, stat) => sum + stat.totalStudents, 0)

    // Calculate overall completion rate based on actual submitted vs possible
    const overallCompletionRate =
      totalPossibleEvaluations > 0 ? Math.round((totalSubmittedEvaluations / totalPossibleEvaluations) * 100) : 0

    // Kalkulahin ang department-wise completion rates
    const departmentStats = departments.map((dept) => {
      // Kunin ang stats para sa specific department
      const deptStats = stats.filter((stat) => stat.departmentId === dept.id)
      // Kalkulahin ang total evaluations at possible evaluations para sa department
      const deptEvaluations = deptStats.reduce((sum, stat) => sum + stat.submittedEvaluations, 0)
      const deptPossible = deptStats.reduce((sum, stat) => sum + stat.totalStudents, 0)
      const completionRate = deptPossible > 0 ? Math.round((deptEvaluations / deptPossible) * 100) : 0

      return {
        name: dept.name,
        completionRate,
        evaluations: deptEvaluations,
        professors: deptStats.length,
      }
    })

    // Kunin ang top 5 performing professors
    const topProfessors = stats
      .sort((a, b) => b.completionRate - a.completionRate) // Sort by completion rate (highest first)
      .slice(0, 5) // Kunin lang ang top 5
      .map((stat) => ({
        name: stat.professorName,
        department: stat.departmentName,
        completionRate: stat.completionRate,
        evaluations: stat.submittedEvaluations,
      }))

    return {
      totalEvaluations: totalSubmittedEvaluations, // Use calculated total submitted
      totalSubmittedEvaluations,
      totalPossibleEvaluations,
      overallCompletionRate,
      departmentStats,
      topProfessors,
    }
  }, [stats, departments, totalEvaluations])

  // Chart colors para sa visual consistency
  const chartColors = [
    "hsl(var(--chart-1))",
    "hsl(var(--chart-2))",
    "hsl(var(--chart-3))",
    "hsl(var(--chart-4))",
    "hsl(var(--chart-5))",
  ]

  // Calculate accurate completion rate based on students who completed ALL assigned evaluations
  const clampedRate = totalStudents > 0 ? Math.min(Math.round((completedStudents / totalStudents) * 100), 100) : 0

  return (
    <div className="space-y-6">
      {/* Header section with progress bar on the right */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold text-foreground">Dashboard Overview</h2>
          <p className="text-muted-foreground">Real-time evaluation completion statistics</p>
        </div>

        {/* Overall Evaluation Completion - Compact on the right */}
        <div className="flex items-center gap-3 min-w-[280px]">
          <div className="flex flex-col gap-1 flex-1">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">Overall Evaluation Completion</span>
            </div>
            <Progress
              value={clampedRate}
              className={`h-2 ${clampedRate >= 75 ? '[&>[data-slot=progress-indicator]]:bg-emerald-500' :
                clampedRate >= 50 ? '[&>[data-slot=progress-indicator]]:bg-blue-500' :
                  clampedRate >= 25 ? '[&>[data-slot=progress-indicator]]:bg-amber-500' : '[&>[data-slot=progress-indicator]]:bg-red-500'
                }`}
            />
          </div>
          <span className={`text-lg font-bold min-w-[3rem] text-right ${clampedRate >= 75 ? 'text-emerald-600' :
            clampedRate >= 50 ? 'text-blue-600' :
              clampedRate >= 25 ? 'text-amber-600' : 'text-red-600'
            }`}>
            {clampedRate}%
          </span>
        </div>
      </div>

      {/* Overview Cards - 4 na cards na nagpapakita ng key metrics */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {/* Card 1: Total Faculties */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between pb-2 border-b border-border mb-4">
              <div className="flex items-center gap-2">
                <CardTitle className="text-sm font-medium">Total faculties</CardTitle>
                <Building2 className="h-4 w-4 text-muted-foreground" />
              </div>
            </div>
            <div className="text-2xl font-bold">{departments.length}</div>
            <p className="text-xs text-muted-foreground">Active faculties</p>
          </CardContent>
        </Card>

        {/* Card 2: Total Professors */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between pb-2 border-b border-border mb-4">
              <div className="flex items-center gap-2">
                <CardTitle className="text-sm font-medium">Total Professors</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </div>
            </div>
            <div className="text-2xl font-bold">{professors.length}</div>
            <p className="text-xs text-muted-foreground">Registered professors</p>
          </CardContent>
        </Card>

        {/* Card 3: Total Evaluations */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between pb-2 border-b border-border mb-4">
              <div className="flex items-center gap-2">
                <CardTitle className="text-sm font-medium">Total of Respondents</CardTitle>
                <FileText className="h-4 w-4 text-muted-foreground" />
              </div>
            </div>
            <div className="text-2xl font-bold">{overviewData.totalEvaluations}</div>
            <p className="text-xs text-muted-foreground">Unique students who completed evaluations</p>
          </CardContent>
        </Card>

        {/* Card 4: Registered Respondents */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between pb-2 border-b border-border mb-4">
              <div className="flex items-center gap-2">
                <CardTitle className="text-sm font-medium">Registered Respondents</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </div>
            </div>
            <div className="text-2xl font-bold">{totalStudents}</div>
            <p className="text-xs text-muted-foreground">Students registered to answer evaluations</p>
          </CardContent>
        </Card>
      </div>

      {/* Real-time Charts - I-render lang kung may department data */}
      {departments.length > 0 && <RealTimeCharts stats={stats} departments={departments} professors={professors} />}

      {/* Top Performing Professors Section - New graphical component */}
      <TopPerformingProfessors />
    </div>
  )
}
