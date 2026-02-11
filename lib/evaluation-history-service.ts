"use client"

/*
 * EVALUATION HISTORY SERVICE - Service para sa pag-manage ng evaluation history
 * 
 * SIMPLE EXPLANATION:
 * 1. I-archive ang mga evaluation results kapag mag-update ng deadline
 * 2. I-store ang history organized by year at date range
 * 3. I-retrieve ang history para sa viewing
 */

import { collection, getDocs, query, orderBy, addDoc, Timestamp, deleteDoc, doc, where } from "firebase/firestore"
import { db } from "./firebase"
import type { EvaluationResult } from "./types"

// Type definition for history document
export interface EvaluationHistoryEntry {
    id: string
    year: number
    startDate: Date
    endDate: Date
    archivedAt: Date
    professorEvaluations: {
        professorId: string
        professorName: string
        departmentName: string
        evaluationCount: number
        evaluations: EvaluationResult[]
    }[]
}

// Type for grouped evaluations by year
export interface HistoryByYear {
    year: number
    periods: {
        id: string
        startDate: Date
        endDate: Date
        archivedAt: Date
        professorCount: number
        totalEvaluations: number
    }[]
}

export const evaluationHistoryService = {
    // Archive all current evaluation results to history
    // Called when deadline is updated
    async archiveEvaluationResults(startDate: Date, endDate: Date): Promise<{ success: boolean; archivedCount: number; error?: string }> {
        try {
            // Get all current evaluation results
            const evaluationsSnapshot = await getDocs(collection(db, "evaluation_results"))

            if (evaluationsSnapshot.empty) {
                console.log("No evaluations to archive")
                return { success: true, archivedCount: 0 }
            }

            // Group evaluations by professor
            const professorMap = new Map<string, {
                professorId: string
                professorName: string
                departmentName: string
                evaluations: EvaluationResult[]
            }>()

            evaluationsSnapshot.docs.forEach((docSnapshot) => {
                const data = docSnapshot.data()
                const professorId = data.professorId || ""

                if (!professorMap.has(professorId)) {
                    professorMap.set(professorId, {
                        professorId,
                        professorName: data.professorName || "Unknown",
                        departmentName: data.departmentName || "Unknown",
                        evaluations: []
                    })
                }

                const evaluation: EvaluationResult = {
                    id: docSnapshot.id,
                    departmentName: data.departmentName || "",
                    evaluationStatus: data.evaluationStatus || "pending",
                    isComplete: data.isComplete || false,
                    professorEmail: data.professorEmail || "",
                    professorId: data.professorId || "",
                    professorName: data.professorName || "",
                    studentEmail: data.studentEmail,
                    studentId: data.studentId,
                    sessionId: data.sessionId,
                    responses: data.responses || [],
                    submittedAt: data.submittedAt?.toDate?.() || undefined,
                    createdAt: data.createdAt?.toDate?.() || new Date(),
                }

                professorMap.get(professorId)!.evaluations.push(evaluation)
            })

            // Create history document
            const professorEvaluations = Array.from(professorMap.values()).map(prof => ({
                professorId: prof.professorId,
                professorName: prof.professorName,
                departmentName: prof.departmentName,
                evaluationCount: prof.evaluations.length,
                evaluations: prof.evaluations
            }))

            const historyDoc = {
                year: startDate.getFullYear(),
                startDate: Timestamp.fromDate(startDate),
                endDate: Timestamp.fromDate(endDate),
                archivedAt: Timestamp.now(),
                professorEvaluations
            }

            // Add to history collection
            await addDoc(collection(db, "evaluation_history"), historyDoc)

            // Delete all original evaluation results
            const deletePromises = evaluationsSnapshot.docs.map(docSnapshot =>
                deleteDoc(doc(db, "evaluation_results", docSnapshot.id))
            )
            await Promise.all(deletePromises)

            const totalArchived = evaluationsSnapshot.docs.length
            console.log(`Successfully archived ${totalArchived} evaluations to history`)

            return { success: true, archivedCount: totalArchived }
        } catch (error) {
            console.error("Error archiving evaluation results:", error)
            return {
                success: false,
                archivedCount: 0,
                error: error instanceof Error ? error.message : "Unknown error occurred"
            }
        }
    },

    // Get all history organized by year
    // Handles BOTH formats:
    // 1. Nested format: { year, startDate, endDate, professorEvaluations: [...] }
    // 2. Flat format: Individual documents with { professorId, professorName, evaluationStatus, ... }
    async getHistoryByYears(): Promise<HistoryByYear[]> {
        try {
            const querySnapshot = await getDocs(collection(db, "evaluation_history"))

            const yearMap = new Map<number, HistoryByYear>()

            // Also track flat documents to group them by evaluation period
            const flatDocsByPeriod = new Map<string, {
                startDate: Date
                endDate: Date
                historyCreatedAt: Date
                professors: Map<string, {
                    professorId: string
                    professorName: string
                    departmentName: string
                    evaluationCount: number
                }>
            }>()

            querySnapshot.docs.forEach((docSnapshot) => {
                const data = docSnapshot.data()

                // Check if this is a nested format (has professorEvaluations array)
                if (data.professorEvaluations && Array.isArray(data.professorEvaluations)) {
                    // NESTED FORMAT - original handling
                    const year = data.year || new Date().getFullYear()

                    if (!yearMap.has(year)) {
                        yearMap.set(year, { year, periods: [] })
                    }

                    const professorEvaluations = data.professorEvaluations || []
                    const totalEvaluations = professorEvaluations.reduce(
                        (sum: number, prof: any) => sum + (prof.evaluationCount || prof.evaluations?.length || 0),
                        0
                    )

                    yearMap.get(year)!.periods.push({
                        id: docSnapshot.id,
                        startDate: data.startDate?.toDate?.() || new Date(),
                        endDate: data.endDate?.toDate?.() || new Date(),
                        archivedAt: data.archivedAt?.toDate?.() || new Date(),
                        professorCount: professorEvaluations.length,
                        totalEvaluations
                    })
                } else {
                    // FLAT FORMAT - individual evaluation document
                    // Group by evaluation period (using startDate + endDate as key)
                    const startDateStr = data.evaluationPeriodStart || ""
                    const endDateStr = data.evaluationPeriodEnd || ""
                    const periodKey = `${startDateStr}_${endDateStr}`

                    const historyCreatedAt = data.historyCreatedAt?.toDate?.() ||
                        data.archivedAt?.toDate?.() ||
                        data.createdAt?.toDate?.() ||
                        new Date()

                    // Parse dates
                    let startDate = new Date()
                    let endDate = new Date()
                    try {
                        if (startDateStr) startDate = new Date(startDateStr)
                        if (endDateStr) endDate = new Date(endDateStr)
                    } catch (e) {
                        console.warn("Could not parse dates:", startDateStr, endDateStr)
                    }

                    if (!flatDocsByPeriod.has(periodKey)) {
                        flatDocsByPeriod.set(periodKey, {
                            startDate,
                            endDate,
                            historyCreatedAt,
                            professors: new Map()
                        })
                    }

                    // Add professor to this period
                    const professorId = data.professorId || ""
                    const periodData = flatDocsByPeriod.get(periodKey)!

                    if (!periodData.professors.has(professorId)) {
                        periodData.professors.set(professorId, {
                            professorId,
                            professorName: data.professorName || "Unknown",
                            departmentName: data.departmentName || "",
                            evaluationCount: 0
                        })
                    }

                    // Increment evaluation count for this professor
                    periodData.professors.get(professorId)!.evaluationCount += 1
                }
            })

            // Convert flat documents to year format
            flatDocsByPeriod.forEach((periodData, periodKey) => {
                const year = periodData.startDate.getFullYear()

                if (!yearMap.has(year)) {
                    yearMap.set(year, { year, periods: [] })
                }

                const professorsArray = Array.from(periodData.professors.values())
                const totalEvaluations = professorsArray.reduce((sum, p) => sum + p.evaluationCount, 0)

                // Use periodKey as ID for flat format periods
                yearMap.get(year)!.periods.push({
                    id: `flat_${periodKey}`,
                    startDate: periodData.startDate,
                    endDate: periodData.endDate,
                    archivedAt: periodData.historyCreatedAt,
                    professorCount: professorsArray.length,
                    totalEvaluations
                })
            })

            // Sort years descending and sort periods within each year by startDate (latest to oldest)
            const result = Array.from(yearMap.values()).sort((a, b) => b.year - a.year)
            result.forEach(yearData => {
                yearData.periods.sort((a, b) => b.startDate.getTime() - a.startDate.getTime())
            })

            return result
        } catch (error) {
            console.error("Error fetching history by years:", error)
            return []
        }
    },


    // Get a specific history period by ID
    // Handles both nested format (direct doc ID) and flat format (flat_periodKey)
    async getHistoryById(historyId: string): Promise<EvaluationHistoryEntry | null> {
        try {
            // Check if this is a flat format ID
            if (historyId.startsWith("flat_")) {
                // FLAT FORMAT - need to query all documents with matching period
                const periodKey = historyId.replace("flat_", "")
                const [startDateStr, endDateStr] = periodKey.split("_")

                const querySnapshot = await getDocs(collection(db, "evaluation_history"))

                // Filter documents matching this period
                const matchingDocs = querySnapshot.docs.filter(docSnapshot => {
                    const data = docSnapshot.data()
                    // Skip nested format docs
                    if (data.professorEvaluations && Array.isArray(data.professorEvaluations)) {
                        return false
                    }
                    const docStartDate = data.evaluationPeriodStart || ""
                    const docEndDate = data.evaluationPeriodEnd || ""
                    return docStartDate === startDateStr && docEndDate === endDateStr
                })

                if (matchingDocs.length === 0) {
                    return null
                }

                // Parse dates
                let startDate = new Date()
                let endDate = new Date()
                let archivedAt = new Date()
                try {
                    if (startDateStr) startDate = new Date(startDateStr)
                    if (endDateStr) endDate = new Date(endDateStr)
                } catch (e) {
                    console.warn("Could not parse dates:", startDateStr, endDateStr)
                }

                // Group by professor
                const professorMap = new Map<string, {
                    professorId: string
                    professorName: string
                    departmentName: string
                    evaluations: any[]
                }>()

                matchingDocs.forEach(docSnapshot => {
                    const data = docSnapshot.data()
                    const professorId = data.professorId || ""

                    if (!professorMap.has(professorId)) {
                        professorMap.set(professorId, {
                            professorId,
                            professorName: data.professorName || "Unknown",
                            departmentName: data.departmentName || "",
                            evaluations: []
                        })
                    }

                    // Get the most recent archivedAt
                    const docArchivedAt = data.historyCreatedAt?.toDate?.() ||
                        data.archivedAt?.toDate?.() ||
                        data.createdAt?.toDate?.() ||
                        new Date()
                    if (docArchivedAt > archivedAt) {
                        archivedAt = docArchivedAt
                    }

                    // Add evaluation
                    professorMap.get(professorId)!.evaluations.push({
                        id: docSnapshot.id,
                        departmentName: data.departmentName || "",
                        evaluationStatus: data.evaluationStatus || "pending",
                        isComplete: data.isComplete || false,
                        professorEmail: data.professorEmail || "",
                        professorId: data.professorId || "",
                        professorName: data.professorName || "",
                        studentEmail: data.studentEmail,
                        studentId: data.studentId,
                        sessionId: data.sessionId,
                        responses: data.responses || [],
                        submittedAt: data.submittedAt?.toDate?.() || undefined,
                        createdAt: data.createdAt?.toDate?.() || new Date(),
                    })
                })

                const professorEvaluations = Array.from(professorMap.values()).map(prof => ({
                    ...prof,
                    evaluationCount: prof.evaluations.length
                }))

                return {
                    id: historyId,
                    year: startDate.getFullYear(),
                    startDate,
                    endDate,
                    archivedAt,
                    professorEvaluations
                }
            }

            // NESTED FORMAT - original handling
            const querySnapshot = await getDocs(collection(db, "evaluation_history"))
            const docSnapshot = querySnapshot.docs.find(d => d.id === historyId)

            if (!docSnapshot) {
                return null
            }

            const data = docSnapshot.data()
            return {
                id: docSnapshot.id,
                year: data.year || new Date().getFullYear(),
                startDate: data.startDate?.toDate?.() || new Date(),
                endDate: data.endDate?.toDate?.() || new Date(),
                archivedAt: data.archivedAt?.toDate?.() || new Date(),
                professorEvaluations: (data.professorEvaluations || []).map((prof: any) => ({
                    professorId: prof.professorId || "",
                    professorName: prof.professorName || "Unknown",
                    departmentName: prof.departmentName || "Unknown",
                    evaluationCount: prof.evaluationCount || prof.evaluations?.length || 0,
                    evaluations: (prof.evaluations || []).map((eval_: any) => ({
                        id: eval_.id || "",
                        departmentName: eval_.departmentName || "",
                        evaluationStatus: eval_.evaluationStatus || "pending",
                        isComplete: eval_.isComplete || false,
                        professorEmail: eval_.professorEmail || "",
                        professorId: eval_.professorId || "",
                        professorName: eval_.professorName || "",
                        studentEmail: eval_.studentEmail,
                        studentId: eval_.studentId,
                        sessionId: eval_.sessionId,
                        responses: eval_.responses || [],
                        submittedAt: eval_.submittedAt?.toDate?.() || undefined,
                        createdAt: eval_.createdAt?.toDate?.() || new Date(),
                    }))
                }))
            }
        } catch (error) {
            console.error("Error fetching history by ID:", error)
            return null
        }
    },


    // Delete a history period
    async deleteHistoryPeriod(historyId: string): Promise<boolean> {
        try {
            await deleteDoc(doc(db, "evaluation_history", historyId))
            return true
        } catch (error) {
            console.error("Error deleting history period:", error)
            return false
        }
    }
}
