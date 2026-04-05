import { collection, getDocs, query, orderBy, onSnapshot, addDoc, Timestamp, where, getDocs as getDocsQuery, deleteDoc, doc } from "firebase/firestore"
import { db } from "./firebase"
import type { EvaluationResult, EvaluationResultStats, EvaluationQuestion } from "./types"
import { evaluationDeadlineService } from "./database"

// Type definition for top professor data
export interface TopProfessorData {
  professorId: string
  professorName: string
  departmentName: string
  excellentCount: number
  verySatisfactoryCount: number
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
            options: Array.isArray(r.options) ? r.options : [],
            questionId: r.questionId || "",
            questionText: r.questionText || "",
            questionType: r.questionType || "text",
            sessionId: r.sessionId || sessionId || undefined,
          })),
          submittedAt: data.submittedAt?.toDate?.() || undefined,
          createdAt: data.createdAt?.toDate?.() || new Date(),
        } as EvaluationResult
      })

      console.log(`✅ Loaded ${results.length} evaluation results from evaluation_results collection`)
      if (results.length > 0) {
        const sampleResult = results[0]
        console.log(`📊 Sample result:`, {
          professorName: sampleResult.professorName,
          responsesCount: sampleResult.responses?.length || 0,
          firstResponse: sampleResult.responses?.[0] ? {
            answer: sampleResult.responses[0].answer,
            answerType: typeof sampleResult.responses[0].answer,
            options: sampleResult.responses[0].options,
            questionType: sampleResult.responses[0].questionType
          } : null
        })
      }

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
      return () => { }
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

  // Get evaluation statistics by student section for a specific professor
  // Returns total unique students and breakdown by section
  async getEvaluationStatsByProfessor(professorId: string): Promise<{
    totalStudents: number
    sectionBreakdown: { section: string; count: number }[]
  }> {
    try {
      // Get all evaluation results for this professor
      const evaluationsSnapshot = await getDocs(
        query(
          collection(db, "evaluation_results"),
          where("professorId", "==", professorId)
        )
      )

      if (evaluationsSnapshot.empty) {
        return { totalStudents: 0, sectionBreakdown: [] }
      }

      // Get unique student identifiers from evaluations
      const studentIdentifiers = new Set<string>()
      const studentEmails: string[] = []

      evaluationsSnapshot.docs.forEach((doc) => {
        const data = doc.data()
        // Use sessionId, studentId, or studentEmail as unique identifier
        const identifier = data.sessionId || data.studentId || data.studentEmail
        if (identifier && !studentIdentifiers.has(identifier)) {
          studentIdentifiers.add(identifier)
          if (data.studentEmail) {
            studentEmails.push(data.studentEmail)
          }
        }
      })

      // Now fetch student data to get sections
      const sectionCounts = new Map<string, number>()

      // Fetch students by email (in batches of 10 due to Firestore 'in' limitation)
      for (let i = 0; i < studentEmails.length; i += 10) {
        const batch = studentEmails.slice(i, i + 10)
        if (batch.length > 0) {
          try {
            const studentsSnapshot = await getDocs(
              query(
                collection(db, "users"),
                where("email", "in", batch)
              )
            )

            studentsSnapshot.docs.forEach((doc) => {
              const studentData = doc.data()
              const section = studentData.section || "Unknown Section"
              sectionCounts.set(section, (sectionCounts.get(section) || 0) + 1)
            })
          } catch (batchError) {
            console.warn("Error fetching student batch:", batchError)
          }
        }
      }

      // If we couldn't match students by email, count as "Unknown Section"
      const matchedCount = Array.from(sectionCounts.values()).reduce((sum, count) => sum + count, 0)
      const unmatchedCount = studentIdentifiers.size - matchedCount
      if (unmatchedCount > 0) {
        sectionCounts.set("Unknown Section", (sectionCounts.get("Unknown Section") || 0) + unmatchedCount)
      }

      // Convert to array and sort by count (descending)
      const sectionBreakdown = Array.from(sectionCounts.entries())
        .map(([section, count]) => ({ section, count }))
        .sort((a, b) => b.count - a.count)

      return {
        totalStudents: studentIdentifiers.size,
        sectionBreakdown
      }
    } catch (error) {
      console.error("Error fetching evaluation stats by professor:", error)
      return { totalStudents: 0, sectionBreakdown: [] }
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

  // Calculate top performing professors based on Excellent and Very Satisfactory responses from evaluation results
  calculateTopPerformingProfessors(results: EvaluationResult[], limit: number = 5) {
    // Group results by professor
    const professorMap = new Map<
      string,
      {
        professorId: string
        professorName: string
        departmentName: string
        excellentCount: number
        verySatisfactoryCount: number
        satisfactoryCount: number
        fairCount: number
        poorCount: number
        totalResponses: number
        totalEvaluations: number
        sectionAverages: Record<string, { weightedSum: number; count: number }>
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
            excellentCount: 0,
            verySatisfactoryCount: 0,
            satisfactoryCount: 0,
            fairCount: 0,
            poorCount: 0,
            totalResponses: 0,
            totalEvaluations: 0,
            sectionAverages: {},
          })
        }

        const profData = professorMap.get(professorKey)!
        profData.totalEvaluations++

        // Count Excellent and Very Satisfactory responses from Likert Scale questions
        result.responses?.forEach((response) => {
          if (response.questionType === "Likert Scale" && response.answer) {
            profData.totalResponses++

            // Parse answer - can be either index (number/string) or text
            let answerText = ""
            const answerValue = response.answer.toString().trim()

            // Check if answer is a numeric index (0, 1, 2, 3, etc.)
            const answerIndex = parseInt(answerValue, 10)
            if (!isNaN(answerIndex) && response.options && Array.isArray(response.options) && response.options.length > answerIndex) {
              // Answer is an index, get the text from options array
              answerText = response.options[answerIndex]?.trim() || ""
            } else {
              // Answer is already text
              answerText = answerValue
            }

            // Track section averages for weighted ranking
            const section = response.section || "Other"
            if (!profData.sectionAverages[section]) {
              profData.sectionAverages[section] = { weightedSum: 0, count: 0 }
            }

            // Count based on answer text (case-insensitive)
            const normalizedAnswer = answerText.toLowerCase()
            let score = 0

            if (normalizedAnswer === "excellent" || normalizedAnswer === "5") {
              profData.excellentCount++
              score = 5
            } else if (normalizedAnswer === "very satisfactory" || normalizedAnswer === "verysatisfactory" || normalizedAnswer === "4") {
              profData.verySatisfactoryCount++
              score = 4
            } else if (normalizedAnswer === "satisfactory" || normalizedAnswer === "3") {
              profData.satisfactoryCount++
              score = 3
            } else if (normalizedAnswer === "fair" || normalizedAnswer === "2") {
              profData.fairCount++
              score = 2
            } else if (normalizedAnswer === "poor" || normalizedAnswer === "1") {
              profData.poorCount++
              score = 1
            }

            if (score > 0) {
              profData.sectionAverages[section].weightedSum += score
              profData.sectionAverages[section].count++
            }
          }
        })
      }
    })

    // Calculate performance scores based on the new weighted section-based rating
    const topProfessors = Array.from(professorMap.values())
      .map((prof) => {
        // Calculate the Final Rating based on weighted section averages
        // Formula: Σ (Average per Area × Weight per Area)
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

        let totalWeightedRating = 0
        let totalResponsesInWeightedSections = 0

        Object.entries(prof.sectionAverages).forEach(([sec, data]) => {
          const cleanName = this.normalizeCategoryName(sec)
          const weight = weights[cleanName] || 0
          if (weight > 0 && data.count > 0) {
            const avg = data.weightedSum / data.count
            totalWeightedRating += avg * weight
            totalResponsesInWeightedSections += data.count
          }
        })

        // Use the weighted rating if we have section data, otherwise fallback to global average
        // But for consistency with the new formula, we primarily use the weighted one.
        let finalRating = totalWeightedRating
        
        // If no sections matched but we have total responses, use a simple average
        if (totalWeightedRating === 0 && prof.totalResponses > 0) {
          const totalWeightedScore =
            prof.excellentCount * 5 +
            prof.verySatisfactoryCount * 4 +
            prof.satisfactoryCount * 3 +
            prof.fairCount * 2 +
            prof.poorCount * 1
          finalRating = totalWeightedScore / prof.totalResponses
        }

        // Performance score (percentage) for legacy compatibility or secondary sorting
        const positiveResponses = prof.excellentCount + prof.verySatisfactoryCount
        const performancePercentage = prof.totalResponses > 0
          ? Math.round((positiveResponses / prof.totalResponses) * 100)
          : 0

        return {
          professorId: prof.professorId,
          professorName: prof.professorName,
          departmentName: prof.departmentName,
          excellentCount: prof.excellentCount,
          verySatisfactoryCount: prof.verySatisfactoryCount,
          positiveResponses: positiveResponses,
          totalResponses: prof.totalResponses,
          averageRating: Math.round(finalRating * 100) / 100,
          performanceScore: performancePercentage,
          totalEvaluations: prof.totalEvaluations,
        }
      })
      .filter((prof) => {
        // Only include professors with at least 1 evaluation and some responses
        return prof.totalEvaluations > 0 && prof.totalResponses > 0
      })
      .sort((a, b) => {
        // Sort by weighted rating (descending), then by percentage
        if (b.averageRating !== a.averageRating) {
          return b.averageRating - a.averageRating
        }
        return b.performanceScore - a.performanceScore
      })
      .slice(0, limit)

    return topProfessors
  },

  // Normalize section name to standard category name
  normalizeCategoryName(section: string | undefined): string {
    if (!section) return "Other"

    const normalized = section.trim()
    const lower = normalized.toLowerCase()

    // Map various section name formats to standard category names
    if ((lower.includes("instructional") && lower.includes("competence")) || lower.startsWith("a.")) {
      return "Instructional Competence"
    }
    if ((lower.includes("classroom") && lower.includes("management")) || lower.startsWith("b.")) {
      return "Classroom Management"
    }
    if ((lower.includes("personal") && lower.includes("professional") && lower.includes("qualities")) || lower.startsWith("c.") || lower.includes("professionalism")) {
      return "Professionalism & Personal Qualities"
    }
    if ((lower.includes("student") && lower.includes("engagement") && lower.includes("assessment")) || lower.startsWith("d.") || lower.includes("support")) {
      return "Student Support & Development"
    }
    if (lower.includes("research") || lower.startsWith("e.")) {
      return "Research"
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

    // Define the 5 main categories (matching UI keys)
    const categories = [
      "Instructional Competence",
      "Classroom Management",
      "Professionalism & Personal Qualities",
      "Student Support & Development",
      "Research",
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
          excellentCount: number
          verySatisfactoryCount: number
          satisfactoryCount: number
          fairCount: number
          poorCount: number
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
                excellentCount: 0,
                verySatisfactoryCount: 0,
                satisfactoryCount: 0,
                fairCount: 0,
                poorCount: 0,
                totalResponses: 0,
                evaluationIds: new Set(),
              })
            }

            const profData = categoryMap.get(professorKey)!
            profData.totalResponses++

            // Parse answer - can be either index (number/string) or text
            let answerText = ""
            const answerValue = response.answer.toString().trim()

            // Check if answer is a numeric index (0, 1, 2, 3, etc.)
            const answerIndex = parseInt(answerValue, 10)
            if (!isNaN(answerIndex) && response.options && Array.isArray(response.options) && response.options.length > answerIndex) {
              // Answer is an index, get the text from options array
              answerText = response.options[answerIndex]?.trim() || ""
            } else {
              // Answer is already text
              answerText = answerValue
            }

            // Count based on answer text (case-insensitive)
            const normalizedAnswer = answerText.toLowerCase()
            if (normalizedAnswer === "excellent" || normalizedAnswer === "5") {
              profData.excellentCount++
            } else if (normalizedAnswer === "very satisfactory" || normalizedAnswer === "verysatisfactory" || normalizedAnswer === "4") {
              profData.verySatisfactoryCount++
            } else if (normalizedAnswer === "satisfactory" || normalizedAnswer === "3") {
              profData.satisfactoryCount++
            } else if (normalizedAnswer === "fair" || normalizedAnswer === "2") {
              profData.fairCount++
            } else if (normalizedAnswer === "poor" || normalizedAnswer === "1") {
              profData.poorCount++
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
          const positiveResponses = prof.excellentCount + prof.verySatisfactoryCount
          const performanceScore = prof.totalResponses > 0
            ? Math.round((positiveResponses / prof.totalResponses) * 100)
            : 0
          const totalWeightedScore =
            prof.excellentCount * 5 +
            prof.verySatisfactoryCount * 4 +
            prof.satisfactoryCount * 3 +
            prof.fairCount * 2 +
            prof.poorCount * 1
          const averageRating = prof.totalResponses > 0
            ? Math.round((totalWeightedScore / prof.totalResponses) * 100) / 100
            : 0

          return {
            professorId: prof.professorId,
            professorName: prof.professorName,
            departmentName: prof.departmentName,
            excellentCount: prof.excellentCount,
            verySatisfactoryCount: prof.verySatisfactoryCount,
            positiveResponses: positiveResponses,
            totalResponses: prof.totalResponses,
            averageRating: averageRating,
            performanceScore: performanceScore,
            totalEvaluations: prof.evaluationIds.size, // Count unique evaluations
          } as TopProfessorData
        })
        .filter((prof) => prof.totalResponses > 0)
        .sort((a, b) => {
          if (b.averageRating !== a.averageRating) {
            return b.averageRating - a.averageRating
          }
          return b.performanceScore - a.performanceScore
        })
        .slice(0, limit)

      result[category] = topProfessors
    })

    return result
  },

  // Clear all evaluation results - called when a new evaluation deadline is set
  // This resets the data so professors see fresh statistics for the new period
  async clearAllEvaluationResults(): Promise<{ success: boolean; deletedCount: number; error?: string }> {
    try {
      const collectionRef = collection(db, "evaluation_results")
      const querySnapshot = await getDocs(collectionRef)

      if (querySnapshot.empty) {
        return { success: true, deletedCount: 0 }
      }

      let deletedCount = 0
      const deletePromises: Promise<void>[] = []

      // Delete all documents in batches
      querySnapshot.docs.forEach((docSnapshot) => {
        deletePromises.push(
          deleteDoc(doc(db, "evaluation_results", docSnapshot.id))
            .then(() => {
              deletedCount++
            })
        )
      })

      await Promise.all(deletePromises)

      console.log(`Successfully cleared ${deletedCount} evaluation results`)
      return { success: true, deletedCount }
    } catch (error) {
      console.error("Error clearing evaluation results:", error)
      return {
        success: false,
        deletedCount: 0,
        error: error instanceof Error ? error.message : "Unknown error occurred"
      }
    }
  },
}
