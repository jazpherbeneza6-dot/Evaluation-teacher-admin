"use client"

import React, { useState, useEffect, useMemo } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select"
import { Badge } from "../ui/badge"
import { evaluationResultsService } from "../../lib/evaluation-results-service"
import { PieChartIcon, Activity } from "lucide-react"
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip
} from "recharts"
import type { EvaluationStats, Department, Professor, EvaluationResult } from "../../lib/types"

// Mga properties na kailangan para sa RealTimeCharts component
interface RealTimeChartsProps {
  stats: EvaluationStats[]      // Array ng statistics ng mga evaluations
  departments: Department[]      // Listahan ng mga departamento
  professors: Professor[]        // Listahan ng mga propesor
  questionId?: string           // ID ng tanong (optional)
  questionText?: string         // Text ng tanong (optional)
  professorId?: string          // ID ng propesor (optional)
}

// Interface para sa bawat data point ng chart
interface ChartDataPoint {
  name: string           // Pangalan ng propesor (last name lang)
  fullName: string       // Buong pangalan ng propesor
  department: string     // Departamento
  completionRate: number // Porsyento ng nakumpletong evaluations
  submitted: number      // Bilang ng na-submit na evaluations
  total: number         // Kabuuang bilang ng dapat mag-evaluate
  remaining: number     // Bilang ng hindi pa nag-su-submit
}

// Interface para sa summary ng bawat departamento
interface DepartmentSummary {
  name: string          // Pangalan ng departamento
  shortName: string     // Maikling pangalan (unang salita lang)
  completion: number    // Porsyento ng completion
  submitted: number     // Bilang ng na-submit
  total: number        // Kabuuang bilang
  professors: number    // Bilang ng mga propesor
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{
    payload: any;
    color?: string;
    name?: string;
    value: number;
  }>;
  label?: string;
}

// Main component para sa real-time na charts at display ng evaluation results
export function RealTimeCharts({ 
  stats, 
  departments, 
  professors,
  questionId,
  questionText,
  professorId 
}: RealTimeChartsProps) {
  // State variables para sa component
  const [selectedDepartment, setSelectedDepartment] = useState<string>("all")             // Napiling departamento
  const [evaluationsData, setEvaluationsData] = useState<EvaluationResult[]>([])         // Data ng mga evaluations
  const [questionResponses, setQuestionResponses] = useState<{[key: string]: number}>({}) // Mga sagot sa tanong
  const [isLoading, setIsLoading] = useState(true)                                       // Loading indicator

  // Effect hook para mag-load ng data at i-update ito kada 30 seconds
  useEffect(() => {
    // Function para i-load ang evaluation data mula sa service
    const loadEvaluations = async () => {
      try {
        // Kunin lahat ng evaluations
        const evaluations = await evaluationResultsService.getAll()
        setEvaluationsData(evaluations)
        
        // Kung may specific na tanong at propesor
        if (questionId && professorId) {
          const responses: {[key: string]: number} = {}
          // I-filter ang mga evaluation para sa specific na propesor at submitted na
          evaluations
            .filter(evaluation => 
              evaluation.professorId === professorId && 
              evaluation.evaluationStatus === "submitted"
            )
            .forEach(evaluation => {
              const response = evaluation.responses?.find(r => r.questionId === questionId)
              if (response?.answer && response.questionType !== "text") {
                // For rating questions, group them into ranges
                if (response.questionType === "Likert Scale") {
                  const rating = parseInt(response.answer)
                  if (!isNaN(rating)) {
                    const ratingRange = `${Math.floor((rating - 1) / 2) * 2 + 1}-${Math.min(Math.floor((rating - 1) / 2) * 2 + 2, 4)}`
                    responses[ratingRange] = (responses[ratingRange] || 0) + 1
                  }
                }
              }
            })
          setQuestionResponses(responses)
        }
      } catch (error) {
        console.error("Error loading evaluations:", error)
      } finally {
        setIsLoading(false)
      }
    }

    loadEvaluations()
    const refreshInterval = setInterval(loadEvaluations, 30000)
    return () => clearInterval(refreshInterval)
  }, [questionId, professorId])

  // I-compute ang data para sa charts, gagamitin ang useMemo para sa performance
  const chartData = useMemo(() => {
    // Kung walang stats data, return empty array
    if (!stats?.length) return []
    // I-filter ang stats base sa napiling departamento
    const filtered = selectedDepartment === "all" 
      ? stats 
      : stats.filter((stat) => stat.departmentId === selectedDepartment)
    
    // I-convert ang stats data sa format na kailangan ng chart
    return filtered.map((stat): ChartDataPoint => ({
      name: stat.professorName.split(" ").slice(-1)[0],
      fullName: stat.professorName,
      department: stat.departmentName,
      completionRate: stat.completionRate,
      submitted: stat.submittedEvaluations,
      total: stat.totalStudents,
      remaining: stat.totalStudents - stat.submittedEvaluations,
    }))
  }, [stats, selectedDepartment])

  // I-compute ang summary ng bawat departamento
  const departmentSummary = useMemo(() => {
    // Kung walang departments o stats data, return empty array
    if (!departments?.length || !stats?.length) return []
    
    // Gumawa ng summary para sa bawat departamento
    return departments
      .map((dept): DepartmentSummary => {
        // Kunin ang stats para sa kasalukuyang departamento
        const deptStats = stats.filter((stat) => stat.departmentId === dept.id)
        // Calculate ang kabuuang bilang ng submissions
        const totalSubmitted = deptStats.reduce((sum, stat) => sum + stat.submittedEvaluations, 0)
        // Calculate ang kabuuang bilang ng dapat mag-submit
        const totalPossible = deptStats.reduce((sum, stat) => sum + stat.totalStudents, 0)
        // Calculate ang average completion rate
        const avgCompletion = totalPossible > 0 ? Math.round((totalSubmitted / totalPossible) * 100) : 0

        return {
          name: dept.name,
          shortName: dept.name.split(" ")[0],
          completion: avgCompletion,
          submitted: totalSubmitted,
          total: totalPossible,
          professors: deptStats.length,
        }
      })
      .sort((a, b) => b.completion - a.completion)
  }, [departments, stats])

  const CustomTooltip: React.FC<CustomTooltipProps> = ({ active, payload, label }) => {
    if (active && payload?.length) {
      return (
        <div className="bg-card border border-border rounded-lg p-3 shadow-lg">
          <p className="font-medium">{label || payload[0].name}</p>
          {payload.map((entry, index) => (
            <p key={index} className="text-sm" style={{ color: entry.color }}>
              {entry.name}: {entry.value}
              {entry.name?.includes("Rate") ? "%" : ""}
            </p>
          ))}
        </div>
      )
    }
    return null
  }

  // Ipakita ang loading state kung nag-lo-load pa o kulang ang data
  if (isLoading || !stats || !departments) {
    return (
      <div className="space-y-6">
        <Badge variant="outline" className="gap-1">
          <Activity className="h-3 w-3" />
          Nag-lo-load...
        </Badge>
        <Card>
          <CardContent className="h-[300px] flex items-center justify-center">
            <div className="text-muted-foreground">Nag-lo-load ang data ng chart...</div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex gap-4 items-center">
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {questionId && questionText ? (
          <Card className="md:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                {evaluationsData.find(e => e.responses.find(r => r.questionId === questionId))?.responses.find(r => r.questionId === questionId)?.questionType === "text" ? (
                  <div className="h-5 w-5" /> // Placeholder for text responses
                ) : (
                  <PieChartIcon className="h-5 w-5" />
                )}
                {evaluationsData.find(e => e.responses.find(r => r.questionId === questionId))?.responses.find(r => r.questionId === questionId)?.questionType === "text" ? (
                  "Text Responses"
                ) : (
                  "Question Response Distribution"
                )}
              </CardTitle>
              <CardDescription>
                Response distribution for: {questionText}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {evaluationsData.find(e => e.responses.find(r => r.questionId === questionId))?.responses.find(r => r.questionId === questionId)?.questionType === "text" ? (
                <div className="space-y-4">
                  {evaluationsData
                    .filter(evaluation => evaluation.professorId === professorId && evaluation.evaluationStatus === "submitted")
                    .flatMap(evaluation => evaluation.responses)
                    .filter(response => response.questionId === questionId)
                    .map((response, index) => (
                      <div key={index} className="p-4 rounded-lg border bg-card">
                        <p className="text-sm text-muted-foreground">{response.answer}</p>
                      </div>
                    ))}
                </div>
              ) : (
                <div className="h-[300px]">
                  {Object.keys(questionResponses).length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={Object.entries(questionResponses).map(([answer, count], index) => ({
                            name: answer,
                            value: count,
                            color: `hsl(var(--chart-${(index % 5) + 1}))`
                          }))}
                          cx="50%"
                          cy="50%"
                          labelLine={false}
                          label={(props: any) => `${props.name}: ${props.value}`}
                          outerRadius={120}
                          fill="#8884d8"
                          dataKey="value"
                          animationDuration={1000}
                        >
                          {Object.entries(questionResponses).map(([answer, _], index) => (
                            <Cell 
                              key={`cell-${index}`} 
                              fill={`hsl(var(--chart-${(index % 5) + 1}))`}
                            />
                          ))}
                        </Pie>
                        <Tooltip content={<CustomTooltip />} />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-full flex items-center justify-center">
                      <div className="text-muted-foreground">No responses available</div>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        ) : null}
      </div>
    </div>
  )
}
