import { collection, getDocs, query, orderBy, onSnapshot, addDoc, Timestamp, where, getDocs as getDocsQuery } from "firebase/firestore"
import { db } from "./firebase"
import type { EvaluationResult, EvaluationResultStats, EvaluationQuestion } from "./types"
import { evaluationDeadlineService } from "./database"

// Type definition for top professor data
export interface TopProfessorData {
  professorId: string
  professorName: string
  departmentName: string
  stronglyAgreeCount: number
  agreeCount: number
  positiveResponses: number
  totalResponses: number
  averageRating: number
  performanceScore: number
  totalEvaluations: number
}

export const evaluationResultsService = {
  // Create a new evaluation result in Firestore (supports text responses)
  // Checks deadline before allowing submission
  async submit(result: Omit<EvaluationResult, "id" | "createdAt">): Promise<string> {
    try {
      // Check if evaluation deadline has passed
      const isOpen = await evaluationDeadlineService.isEvaluationOpen()
      if (!isOpen) {
        const activeDeadline = await evaluationDeadlineService.getActive()
        if (activeDeadline) {
          const now = new Date()
          const endDate = new Date(activeDeadline.endDate)
          
          if (now > endDate) {
            throw new Error("Evaluation period has ended. Submissions are no longer accepted.")
          } else if (now < new Date(activeDeadline.startDate)) {
            throw new Error("Evaluation period has not started yet.")
          }
        } else {
          throw new Error("No evaluation period is currently active.")
        }
      }
      
      const docRef = await addDoc(collection(db, "evaluation_results"), {
        ...result,
        createdAt: Timestamp.now(),
      })
      return docRef.id
    } catch (error) {
      console.error("Error submitting evaluation result:", error)
      throw error
    }
  },
  // Get all evaluation results from Firebase
  async getAll(): Promise<EvaluationResult[]> {
    try {
      // Use simple query without orderBy to avoid index requirement
      const simpleQuery = collection(db, "evaluation_results")
      
      // Try without orderBy first (no index needed)
      let querySnapshot = await getDocs(simpleQuery)

      const results = querySnapshot.docs.map((doc) => {
        const data = doc.data()
        
        // Try multiple possible field names for student identifier
        const studentEmail = data.studentEmail || data.student_email || data.studentEmailAddress || data.email || undefined
        const studentId = data.studentId || data.student_id || data.studentID || data.userId || data.user_id || undefined
        
        // Extract sessionId from responses array (if available)
        // sessionId is stored in responses[0].sessionId based on Firestore structure
        const responses = data.responses || []
        // Try to get sessionId from top-level first, then from responses array
        let sessionId = data.sessionId || undefined
        if (!sessionId && Array.isArray(responses) && responses.length > 0) {
          // Check each response for sessionId
          for (const response of responses) {
            if (response?.sessionId) {
              sessionId = response.sessionId
              break
            }
          }
        }
        
        return {
          id: doc.id,
          departmentName: data.departmentName || "",
          evaluationStatus: data.evaluationStatus || "pending",
          isComplete: data.isComplete || false,
          professorEmail: data.professorEmail || "",
          professorId: data.professorId || "",
          professorName: data.professorName || "",
          studentEmail: studentEmail,
          studentId: studentId,
          sessionId: sessionId,
          responses: responses.map((r: any) => ({
            answer: r.answer || "",
            options: r.options || [],
            questionId: r.questionId || "",
            questionText: r.questionText || "",
            questionType: r.questionType || "text",
            sessionId: r.sessionId || sessionId || undefined,
          })),
          submittedAt: data.submittedAt?.toDate?.() || undefined,
          createdAt: data.createdAt?.toDate?.() || new Date(),
        } as EvaluationResult
      })

      
      return results
    } catch (error) {
      console.error("❌ Error fetching evaluation results:", error)
      console.error("❌ Error details:", {
        message: (error as any)?.message,
        code: (error as any)?.code,
        name: (error as any)?.name
      })
      console.log("🔄 Trying fallback query...")
      // Try fallback without orderBy if composite index is missing
      try {
        const fallbackSnapshot = await getDocs(collection(db, "evaluation_results"))
        console.log("🔍 Fallback query executed. Docs count:", fallbackSnapshot.docs.length)
        const results = fallbackSnapshot.docs.map((doc) => {
          const data = doc.data()
          
          // Try multiple possible field names for student identifier
          const studentEmail = data.studentEmail || data.student_email || data.studentEmailAddress || data.email || undefined
          const studentId = data.studentId || data.student_id || data.studentID || data.userId || data.user_id || undefined
          
          // Extract sessionId from responses array (if available)
          const responses = data.responses || []
          // Try to get sessionId from top-level first, then from responses array
          let sessionId = data.sessionId || undefined
          if (!sessionId && Array.isArray(responses) && responses.length > 0) {
            // Check each response for sessionId
            for (const response of responses) {
              if (response?.sessionId) {
                sessionId = response.sessionId
                break
              }
            }
          }
          
          return {
            id: doc.id,
            departmentName: data.departmentName || "",
            evaluationStatus: data.evaluationStatus || "pending",
            isComplete: data.isComplete || false,
            professorEmail: data.professorEmail || "",
            professorId: data.professorId || "",
            professorName: data.professorName || "",
            studentEmail: studentEmail,
            studentId: studentId,
            sessionId: sessionId,
            responses: responses.map((r: any) => ({
              answer: r.answer || "",
              options: r.options || [],
              questionId: r.questionId || "",
              questionText: r.questionText || "",
              questionType: r.questionType || "text",
              sessionId: r.sessionId || sessionId || undefined,
            })),
            submittedAt: data.submittedAt?.toDate?.() || undefined,
            createdAt: data.createdAt?.toDate?.() || new Date(),
          } as EvaluationResult
        })
        return results
      } catch (fallbackError) {
        console.error("Fallback query also failed:", fallbackError)
        return []
      }
    }
  },

  // Real-time listener for evaluation results - Uses evaluation_results collection
  onEvaluationResultsChange(callback: (results: EvaluationResult[]) => void): () => void {
    try {
      // Use simple query without orderBy to avoid index requirement
      const collectionRef = collection(db, "evaluation_results")
      
      const unsubscribe = onSnapshot(
        collectionRef,
        (querySnapshot) => {
          try {
            const results = querySnapshot.docs.map((doc) => {
              const data = doc.data()
              
              // Try multiple possible field names for student identifier
              const studentEmail = data.studentEmail || data.student_email || data.studentEmailAddress || data.email || undefined
              const studentId = data.studentId || data.student_id || data.studentID || data.userId || data.user_id || undefined
              
              // Extract sessionId from responses array (if available)
              const responses = data.responses || []
              let sessionId = data.sessionId || undefined
              if (!sessionId && Array.isArray(responses) && responses.length > 0) {
                for (const response of responses) {
                  if (response?.sessionId) {
                    sessionId = response.sessionId
                    break
                  }
                }
              }
              
              return {
              id: doc.id,
                departmentName: data.departmentName || "",
                evaluationStatus: data.evaluationStatus || "pending",
                isComplete: data.isComplete || false,
                professorEmail: data.professorEmail || "",
                professorId: data.professorId || "",
                professorName: data.professorName || "",
                studentEmail: studentEmail,
                studentId: studentId,
                sessionId: sessionId,
                responses: responses.map((r: any) => ({
                  answer: r.answer || "",
                  options: r.options || [],
                  questionId: r.questionId || "",
                  questionText: r.questionText || "",
                  questionType: r.questionType || "text",
                  sessionId: r.sessionId || sessionId || undefined,
                })),
                submittedAt: data.submittedAt?.toDate?.() || undefined,
                createdAt: data.createdAt?.toDate?.() || new Date(),
              } as EvaluationResult
            })

            callback(results)
          } catch (processError: any) {
            // Suppress Firestore internal assertion errors
            const errorMessage = processError?.message || String(processError)
            if (errorMessage.includes('FIRESTORE') && errorMessage.includes('INTERNAL ASSERTION FAILED')) {
              console.warn("Firestore internal error suppressed in evaluation results listener")
              return
            }
            console.error("Error processing evaluation results:", processError)
            callback([])
          }
        },
        (error: any) => {
          // Suppress Firestore internal assertion errors
          const errorMessage = error?.message || String(error)
          if (errorMessage.includes('FIRESTORE') && errorMessage.includes('INTERNAL ASSERTION FAILED')) {
            console.warn("Firestore internal error suppressed, continuing with listener")
            return
          }
          console.error("Error in real-time listener:", error)
          callback([])
        },
      )

      return () => {
        try {
          unsubscribe()
        } catch (unsubError: any) {
          // Suppress Firestore internal errors during cleanup
          const errorMessage = unsubError?.message || String(unsubError)
          if (!errorMessage.includes('FIRESTORE') || !errorMessage.includes('INTERNAL ASSERTION FAILED')) {
            console.error("Error unsubscribing evaluation results listener:", unsubError)
          }
        }
      }
    } catch (error: any) {
      // Suppress Firestore internal errors
      const errorMessage = error?.message || String(error)
      if (!errorMessage.includes('FIRESTORE') || !errorMessage.includes('INTERNAL ASSERTION FAILED')) {
        console.error("Error setting up real-time listener:", error)
      }
      return () => {}
    }
  },

  // Calculate statistics from evaluation results
  calculateStats(results: EvaluationResult[]): EvaluationResultStats[] {
    const departmentMap = new Map<
      string,
      {
        total: number
        completed: number
        pending: number
        professors: Set<string>
        totalResponses: number
      }
    >()

    results.forEach((result) => {
      const dept = result.departmentName
      if (!departmentMap.has(dept)) {
        departmentMap.set(dept, {
          total: 0,
          completed: 0,
          pending: 0,
          professors: new Set(),
          totalResponses: 0,
        })
      }

      const deptData = departmentMap.get(dept)!
      deptData.total++
      deptData.professors.add(result.professorId)
      deptData.totalResponses += result.responses?.length || 0

      if (result.evaluationStatus === "submitted" && result.isComplete) {
        deptData.completed++
      } else {
        deptData.pending++
      }
    })

    return Array.from(departmentMap.entries()).map(([departmentName, data]) => ({
      departmentName,
      totalEvaluations: data.total,
      completedEvaluations: data.completed,
      pendingEvaluations: data.pending,
      completionRate: data.total > 0 ? Math.round((data.completed / data.total) * 100) : 0,
      professorCount: data.professors.size,
      averageResponsesPerEvaluation: data.total > 0 ? Math.round(data.totalResponses / data.total) : 0,
    }))
  },

  // Get evaluation results by professor
  getByProfessor(results: EvaluationResult[], professorId: string): EvaluationResult[] {
    return results.filter((result) => result.professorId === professorId)
  },

  // Get all evaluation results for a specific professor from Firestore
  async getByProfessorId(professorId: string): Promise<EvaluationResult[]> {
    try {
      const querySnapshot = await getDocs(
        query(
          collection(db, "evaluation_results"),
          orderBy("createdAt", "desc")
        )
      )

      const results = querySnapshot.docs
        .map((doc) => ({
          id: doc.id,
          ...doc.data(),
          submittedAt: doc.data().submittedAt?.toDate(),
          createdAt: doc.data().createdAt?.toDate() || new Date(),
        })) as EvaluationResult[]

      return results.filter((result) => result.professorId === professorId)
    } catch (error) {
      console.error("Error fetching evaluation results for professor:", error)
      return []
    }
  },

  // Get evaluation results by department
  getByDepartment(results: EvaluationResult[], departmentName: string): EvaluationResult[] {
    return results.filter((result) => result.departmentName === departmentName)
  },

  // Get response distribution for a specific question
  getResponseDistribution(results: EvaluationResult[], questionText: string): { [key: string]: number } {
    const distribution: { [key: string]: number } = {}

    results.forEach((result) => {
      const response = result.responses?.find((r) => r.questionText === questionText)
      if (response) {
        const answer = response.answer
        distribution[answer] = (distribution[answer] || 0) + 1
      }
    })

    return distribution
  },

  // Calculate top performing professors based on Strongly Agree and Agree responses from evaluation results
  calculateTopPerformingProfessors(results: EvaluationResult[], limit: number = 5) {
    // Group results by professor
    const professorMap = new Map<
      string,
      {
        professorId: string
        professorName: string
        departmentName: string
        stronglyAgreeCount: number
        agreeCount: number
        neutralCount: number
        disagreeCount: number
        stronglyDisagreeCount: number
        totalResponses: number
        totalEvaluations: number
      }
    >()

    // Process all evaluation results
    results.forEach((result) => {
      // Count all evaluations that are submitted OR complete (more lenient check)
      const isValidEvaluation = 
        (result.evaluationStatus && result.evaluationStatus.toLowerCase().includes("submit")) || 
        result.isComplete === true
      
      if (isValidEvaluation) {
        const professorKey = result.professorId

        if (!professorMap.has(professorKey)) {
          professorMap.set(professorKey, {
            professorId: result.professorId,
            professorName: result.professorName,
            departmentName: result.departmentName,
            stronglyAgreeCount: 0,
            agreeCount: 0,
            neutralCount: 0,
            disagreeCount: 0,
            stronglyDisagreeCount: 0,
            totalResponses: 0,
            totalEvaluations: 0,
          })
        }

        const profData = professorMap.get(professorKey)!
        profData.totalEvaluations++

        // Count Strongly Agree and Agree responses from Likert Scale questions
        result.responses?.forEach((response) => {
          if (response.questionType === "Likert Scale" && response.answer) {
            const answer = response.answer.toString().trim()
            profData.totalResponses++

            // Count based on answer text
            if (answer === "Strongly Agree") {
              profData.stronglyAgreeCount++
            } else if (answer === "Agree") {
              profData.agreeCount++
            } else if (answer === "Neutral" || answer === "Neither Agree nor Disagree") {
              profData.neutralCount++
            } else if (answer === "Disagree") {
              profData.disagreeCount++
            } else if (answer === "Strongly Disagree") {
              profData.stronglyDisagreeCount++
            }
          }
        })
      }
    })

    // Calculate performance scores based on positive responses
    const topProfessors = Array.from(professorMap.values())
      .map((prof) => {
        // Calculate positive response count (Strongly Agree + Agree)
        const positiveResponses = prof.stronglyAgreeCount + prof.agreeCount
        
        // Calculate performance score as percentage of positive responses
        const performanceScore = prof.totalResponses > 0
          ? Math.round((positiveResponses / prof.totalResponses) * 100)
          : 0

        // Calculate average rating (weighted: SA=5, A=4, N=3, D=2, SD=1)
        const totalWeightedScore = 
          (prof.stronglyAgreeCount * 5) +
          (prof.agreeCount * 4) +
          (prof.neutralCount * 3) +
          (prof.disagreeCount * 2) +
          (prof.stronglyDisagreeCount * 1)
        
        const averageRating = prof.totalResponses > 0
          ? Math.round((totalWeightedScore / prof.totalResponses) * 100) / 100
          : 0

        return {
          professorId: prof.professorId,
          professorName: prof.professorName,
          departmentName: prof.departmentName,
          stronglyAgreeCount: prof.stronglyAgreeCount,
          agreeCount: prof.agreeCount,
          positiveResponses: positiveResponses,
          totalResponses: prof.totalResponses,
          averageRating: averageRating,
          performanceScore: performanceScore,
          totalEvaluations: prof.totalEvaluations,
        }
      })
      .filter((prof) => {
        // Only include professors with at least 1 evaluation and some responses
        return prof.totalEvaluations > 0 && prof.totalResponses > 0
      })
      .filter((prof) => {
        // Only include professors with at least 1 positive response (exclude 0% scores)
        return prof.performanceScore > 0 && prof.positiveResponses > 0
      })
      .sort((a, b) => {
        // Sort by performance score (descending), then by total positive responses (descending)
        if (b.performanceScore !== a.performanceScore) {
          return b.performanceScore - a.performanceScore
        }
        return b.positiveResponses - a.positiveResponses
      })
      .slice(0, limit) // Get exactly top 5 (or less if fewer than 5 have data)

    return topProfessors
  },

  // Normalize section name to standard category name
  normalizeCategoryName(section: string | undefined): string {
    if (!section) return "Other"
    
    const normalized = section.trim()
    const lower = normalized.toLowerCase()
    
    // Map various section name formats to standard category names
    if (lower.includes("instructional") && lower.includes("competence")) {
      return "Instructional Competence"
    }
    if (lower.includes("classroom") && lower.includes("management")) {
      return "Classroom Management"
    }
    if (lower.includes("research")) {
      return "Research"
    }
    if (lower.includes("student") && (lower.includes("support") || lower.includes("development"))) {
      return "Student Support & Development"
    }
    if (lower.includes("professionalism") || (lower.includes("personal") && lower.includes("qualities"))) {
      return "Professionalism & Personal Qualities"
    }
    
    return normalized
  },

  // Calculate top 3 performing professors per category
  calculateTopPerformingProfessorsByCategory(
    results: EvaluationResult[],
    questions: EvaluationQuestion[],
    limit: number = 3
  ): { [category: string]: TopProfessorData[] } {
    // Create a map from questionId to category
    const questionToCategoryMap = new Map<string, string>()
    questions.forEach((q) => {
      if (q.id && q.section) {
        const category = this.normalizeCategoryName(q.section)
        questionToCategoryMap.set(q.id, category)
      }
    })

    // Also map by questionText as fallback (in case questionId doesn't match)
    const questionTextToCategoryMap = new Map<string, string>()
    questions.forEach((q) => {
      if (q.questionText && q.section) {
        const category = this.normalizeCategoryName(q.section)
        questionTextToCategoryMap.set(q.questionText.trim().toLowerCase(), category)
      }
    })

    // Define the 5 main categories
    const categories = [
      "Instructional Competence",
      "Classroom Management",
      "Research",
      "Student Support & Development",
      "Professionalism & Personal Qualities",
    ]

    // Initialize category maps
    const categoryMaps = new Map<
      string,
      Map<
        string,
        {
          professorId: string
          professorName: string
          departmentName: string
          stronglyAgreeCount: number
          agreeCount: number
          neutralCount: number
          disagreeCount: number
          stronglyDisagreeCount: number
          totalResponses: number
          evaluationIds: Set<string> // Track unique evaluation IDs per category
        }
      >
    >()

    categories.forEach((cat) => {
      categoryMaps.set(cat, new Map())
    })

    // Process all evaluation results
    results.forEach((result) => {
      const isValidEvaluation =
        (result.evaluationStatus && result.evaluationStatus.toLowerCase().includes("submit")) ||
        result.isComplete === true

      if (isValidEvaluation) {
        // Track which categories this evaluation contributes to
        const categoriesInThisEvaluation = new Set<string>()

        // Process each response and group by category
        result.responses?.forEach((response) => {
          if (response.questionType === "Likert Scale" && response.answer) {
            // Try to find category by questionId first
            let category = questionToCategoryMap.get(response.questionId || "")
            
            // If not found, try by questionText
            if (!category && response.questionText) {
              category = questionTextToCategoryMap.get(response.questionText.trim().toLowerCase())
            }

            // If still not found, skip this response
            if (!category || !categories.includes(category)) {
              return
            }

            categoriesInThisEvaluation.add(category)
            const professorKey = result.professorId
            const categoryMap = categoryMaps.get(category)!

            if (!categoryMap.has(professorKey)) {
              categoryMap.set(professorKey, {
                professorId: result.professorId,
                professorName: result.professorName,
                departmentName: result.departmentName,
                stronglyAgreeCount: 0,
                agreeCount: 0,
                neutralCount: 0,
                disagreeCount: 0,
                stronglyDisagreeCount: 0,
                totalResponses: 0,
                evaluationIds: new Set(),
              })
            }

            const profData = categoryMap.get(professorKey)!
            profData.totalResponses++

            const answer = response.answer.toString().trim()
            if (answer === "Strongly Agree") {
              profData.stronglyAgreeCount++
            } else if (answer === "Agree") {
              profData.agreeCount++
            } else if (answer === "Neutral" || answer === "Neither Agree nor Disagree") {
              profData.neutralCount++
            } else if (answer === "Disagree") {
              profData.disagreeCount++
            } else if (answer === "Strongly Disagree") {
              profData.stronglyDisagreeCount++
            }
          }
        })

        // Count unique evaluations per category (only if this evaluation has responses in that category)
        categoriesInThisEvaluation.forEach((category) => {
          const categoryMap = categoryMaps.get(category)!
          const profData = categoryMap.get(result.professorId)
          if (profData && result.id) {
            profData.evaluationIds.add(result.id)
          }
        })
      }
    })

    // Calculate top 3 per category
    const result: { [category: string]: TopProfessorData[] } = {}

    categories.forEach((category) => {
      const categoryMap = categoryMaps.get(category)!
      const topProfessors = Array.from(categoryMap.values())
        .map((prof) => {
          const positiveResponses = prof.stronglyAgreeCount + prof.agreeCount
          const performanceScore = prof.totalResponses > 0
            ? Math.round((positiveResponses / prof.totalResponses) * 100)
            : 0
          const totalWeightedScore =
            prof.stronglyAgreeCount * 5 +
            prof.agreeCount * 4 +
            prof.neutralCount * 3 +
            prof.disagreeCount * 2 +
            prof.stronglyDisagreeCount * 1
          const averageRating = prof.totalResponses > 0
            ? Math.round((totalWeightedScore / prof.totalResponses) * 100) / 100
            : 0

          return {
            professorId: prof.professorId,
            professorName: prof.professorName,
            departmentName: prof.departmentName,
            stronglyAgreeCount: prof.stronglyAgreeCount,
            agreeCount: prof.agreeCount,
            positiveResponses: positiveResponses,
            totalResponses: prof.totalResponses,
            averageRating: averageRating,
            performanceScore: performanceScore,
            totalEvaluations: prof.evaluationIds.size, // Count unique evaluations
          } as TopProfessorData
        })
        .filter((prof) => prof.totalResponses > 0)
        .sort((a, b) => {
          if (b.performanceScore !== a.performanceScore) {
            return b.performanceScore - a.performanceScore
          }
          return b.positiveResponses - a.positiveResponses
        })
        .slice(0, limit)

      result[category] = topProfessors
    })

    return result
  },
}
