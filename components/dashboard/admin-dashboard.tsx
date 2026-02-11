"use client"

/*
 *   Admin Dashboard ito yung  control center ng evaluation system.
 * 
 *  ang makikita mo dito
 * 1. Overview - para makita mo ang summary ng lahat ng data 
 * 2. Professors - dito mo makikita ang listahan ng teachers 
 * 3. Questions - dito naman ang mga evaluation questions yung 
 * 
 * Mga Cool Features:
 * - Auto-refresh every 30 seconds (para updated ka palagi!)
 * - May sidebar para madaling lumipat sa iba't ibang pages
 * - Naka-save lahat sa Firebase database
 * 
 * Para sa Admin lang to ha! Dito mo kontrolin ang buong system 😊
 */

import { useState, useEffect } from "react"
import { useAuth } from "@/hooks/use-auth"
import { FilterProvider } from "@/hooks/use-filters"
import { statsService, evaluationQuestionService, professorService, departmentService, studentService } from "@/lib/database"
import { DashboardHeader } from "./dashboard-header"
import { DashboardSidebar, type ActiveView } from "./dashboard-sidebar"
import { DashboardOverview } from "./dashboard-overview"
import { ProfessorManagement } from "./professor-management"
import { EvaluationQuestionManagement } from "./evaluation-question-management"
import { EvaluationDurationManagement } from "./evaluation-duration-management"
import { EvaluationResultsManagement } from "./evaluation-results-management"
import {
  parseExcelQuestions,
  validateParsedQuestions,
  convertToDatabaseFormat,
  type ExcelQuestionParseResult,
  type ParsedQuestion,
  type EvaluationSection
} from "@/lib/excel-parser"
import { StudentManagement } from "./student-management"
import { EvaluationHistoryManagement } from "./evaluation-history-management"
import type { EvaluationStats, EvaluationQuestion, Professor, Department } from "@/lib/types"

export function AdminDashboard() {
  const { user } = useAuth()
  // Load activeView from localStorage on mount, default to "overview"
  const [activeView, setActiveView] = useState<ActiveView>(() => {
    if (typeof window !== 'undefined') {
      const savedView = localStorage.getItem('adminDashboardActiveView') as ActiveView | null
      // Validate that saved view is a valid ActiveView
      const validViews: ActiveView[] = ["overview", "professors", "evaluation-questions", "evaluation-duration", "evaluation-results", "students"]
      if (savedView && validViews.includes(savedView)) {
        return savedView
      }
    }
    return "overview"
  })
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const [stats, setStats] = useState<EvaluationStats[]>([])
  const [evaluationQuestions, setEvaluationQuestions] = useState<EvaluationQuestion[]>([])
  const [professors, setProfessors] = useState<Professor[]>([])
  const [departments, setDepartments] = useState<Department[]>([])
  const [totalEvaluations, setTotalEvaluations] = useState<number>(0)
  const [totalStudents, setTotalStudents] = useState<number>(0)
  const [completedStudents, setCompletedStudents] = useState<number>(0)

  // Ito ang function para i-refresh ang data sa dashboard
  // Para updated palagi ang information na nakikita mo!
  const refreshData = async () => {
    try {

      // Kukuha ng bagong data mula sa database:
      // 1. Stats - mga numbers at charts
      // 2. Questions - listahan ng evaluation questions
      // 3. Professors - listahan ng teachers
      // 4. Total evaluations - actual count from Firebase
      const [statsData, questionsData, professorsData, departmentsData, totalEvals, studentsData, fullCompletion] = await Promise.all([
        statsService.calculateStats(),
        evaluationQuestionService.getAll(),
        professorService.getAll(),
        departmentService.getAll(),
        statsService.getTotalEvaluationCount(),
        studentService.getAll(),
        statsService.getFullCompletionCount(),
      ])

      setStats(statsData)
      setEvaluationQuestions(questionsData)
      setProfessors(professorsData)
      setDepartments(departmentsData)
      setTotalEvaluations(totalEvals)
      setTotalStudents(studentsData.length)
      setCompletedStudents(fullCompletion.completedStudents)
    } catch (error) {
      console.error("Error refreshing dashboard data:", (error as any)?.message || error)
    }
  }

  useEffect(() => {
    const loadData = async () => {
      try {

        const [statsData, questionsData, professorsData, departmentsData, totalEvals, studentsData, fullCompletion] = await Promise.all([
          statsService.calculateStats(),
          evaluationQuestionService.getAll(),
          professorService.getAll(),
          departmentService.getAll(),
          statsService.getTotalEvaluationCount(),
          studentService.getAll(),
          statsService.getFullCompletionCount(),
        ])

        setStats(statsData)
        setEvaluationQuestions(questionsData)
        setProfessors(professorsData)
        setDepartments(departmentsData)
        setTotalEvaluations(totalEvals)
        setTotalStudents(studentsData.length)
        setCompletedStudents(fullCompletion.completedStudents)
      } catch (error) {
        console.error("Error loading dashboard data:", (error as any)?.message || error)
      }
    }

    loadData()

    const dataRefreshInterval = setInterval(async () => {
      try {
        const [newStats, newQuestions, newProfessors, newDepartments, newTotalEvals, newStudentsData, newFullCompletion] = await Promise.all([
          statsService.calculateStats(),
          evaluationQuestionService.getAll(),
          professorService.getAll(),
          departmentService.getAll(),
          statsService.getTotalEvaluationCount(),
          studentService.getAll(),
          statsService.getFullCompletionCount(),
        ])
        setStats(newStats)
        setEvaluationQuestions(newQuestions)
        setProfessors(newProfessors)
        setDepartments(newDepartments)
        setTotalEvaluations(newTotalEvals)
        setTotalStudents(newStudentsData.length)
        setCompletedStudents(newFullCompletion.completedStudents)
      } catch (error) {
        console.error("Error refreshing stats:", (error as any)?.message || error)
      }
    }, 30000)

    return () => {
      clearInterval(dataRefreshInterval)
    }
  }, [])

  // Dito pinipili kung anong page ang ipapakita base sa active view
  // May pito na pages tayo:
  // 1. Overview - para sa summary at charts
  // 2. Professors - para sa pag-manage ng teachers
  // 3. Evaluation Questions - para sa pag-edit ng mga tanong
  // 4. Evaluation Duration - para sa pag-set ng evaluation time at deadline
  // 5. Evaluation Results - para sa pag-view ng Faculties Evaluation Results
  // 6. Students - para sa pag-manage ng student accounts
  const renderContent = () => {
    switch (activeView) {
      case "overview":
        return <DashboardOverview stats={stats} departments={departments} professors={professors} totalEvaluations={totalEvaluations} totalStudents={totalStudents} completedStudents={completedStudents} />
      case "professors":
        return <ProfessorManagement professors={professors} departments={departments} onRefresh={refreshData} />
      case "evaluation-questions":
        return (
          <EvaluationQuestionManagement
            questions={evaluationQuestions}
            professors={professors}
            onRefresh={refreshData}
          />
        )
      case "evaluation-duration":
        return <EvaluationDurationManagement />
      case "evaluation-results":
        return <EvaluationResultsManagement questions={evaluationQuestions} professors={professors} />
      case "students":
        return <StudentManagement onRefresh={refreshData} />
      case "evaluation-history":
        return <EvaluationHistoryManagement questions={evaluationQuestions} professors={professors} />
      default:
        return <DashboardOverview stats={stats} departments={departments} professors={professors} totalEvaluations={totalEvaluations} totalStudents={totalStudents} completedStudents={completedStudents} />
    }
  }

  // Ito ang main layout ng admin dashboard
  // May Header sa taas, Sidebar sa kaliwa, at Content sa gitna
  return (
    <FilterProvider>
      {/* Ito ang container ng buong dashboard, may magandang gradient background */}
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
        {/* Header - dito makikita ang user info at search */}
        <DashboardHeader user={user} onMenuClick={() => setIsMobileMenuOpen(true)} />
        <div className="flex">
          {/* Sidebar - dito ang navigation para sa iba't ibang pages */}
          <DashboardSidebar
            activeView={activeView}
            onViewChange={(view) => {
              setActiveView(view)
              // Save activeView to localStorage para ma-restore pagkatapos ng refresh
              if (typeof window !== 'undefined') {
                localStorage.setItem('adminDashboardActiveView', view)
              }
              setIsMobileMenuOpen(false)
            }}
            isMobileOpen={isMobileMenuOpen}
            onMobileClose={() => setIsMobileMenuOpen(false)}
          />
          <main className="flex-1 p-4 sm:p-6 lg:p-8 w-full min-w-0">
            <div className="max-w-7xl mx-auto">{renderContent()}</div>
          </main>
        </div>
      </div>
    </FilterProvider>
  )
}
