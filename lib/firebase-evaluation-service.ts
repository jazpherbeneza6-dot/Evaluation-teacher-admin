import { db } from "./firebase"
import { collection, query, where, onSnapshot, getDocs, addDoc, Timestamp } from "firebase/firestore"
import { evaluationDeadlineService } from "./database"

export interface FirebaseEvaluationResult {
  id: string
  departmentName: string
  evaluationStatus: "submitted" | "pending" | "in-progress"
  isComplete: boolean
  professorEmail: string
  professorId: string
  professorName: string
  responses: {
    answer: string
    options: string[]
    questionId: string
    questionText: string
    questionType: string
    section?: string
  }[]
  createdAt?: Date
}

export class FirebaseEvaluationService {
  private collectionName = "evaluation_results"

  // Get evaluations for a specific professor with real-time updates
  subscribeToEvaluationsByProfessor(professorId: string, callback: (evaluations: FirebaseEvaluationResult[]) => void) {
    const q = query(collection(db, this.collectionName), where("professorId", "==", professorId))

    return onSnapshot(q, (snapshot) => {
      const evaluations: FirebaseEvaluationResult[] = []
      snapshot.forEach((doc) => {
        const data = doc.data()
        evaluations.push({
          id: doc.id,
          ...data,
          createdAt: data.createdAt?.toDate() || new Date(),
        } as FirebaseEvaluationResult)
      })

      evaluations.sort((a, b) => (b.createdAt?.getTime() || 0) - (a.createdAt?.getTime() || 0))
      callback(evaluations)
    })
  }

  // Get evaluations by professor email (alternative lookup)
  subscribeToEvaluationsByEmail(professorEmail: string, callback: (evaluations: FirebaseEvaluationResult[]) => void) {
    const q = query(collection(db, this.collectionName), where("professorEmail", "==", professorEmail))

    return onSnapshot(q, (snapshot) => {
      const evaluations: FirebaseEvaluationResult[] = []
      snapshot.forEach((doc) => {
        const data = doc.data()
        evaluations.push({
          id: doc.id,
          ...data,
          createdAt: data.createdAt?.toDate() || new Date(),
        } as FirebaseEvaluationResult)
      })

      evaluations.sort((a, b) => (b.createdAt?.getTime() || 0) - (a.createdAt?.getTime() || 0))
      callback(evaluations)
    })
  }

  // Get all evaluations with real-time updates
  subscribeToAllEvaluations(callback: (evaluations: FirebaseEvaluationResult[]) => void) {
    const q = query(collection(db, this.collectionName))

    return onSnapshot(q, (snapshot) => {
      const evaluations: FirebaseEvaluationResult[] = []
      snapshot.forEach((doc) => {
        const data = doc.data()
        evaluations.push({
          id: doc.id,
          ...data,
          createdAt: data.createdAt?.toDate() || new Date(),
        } as FirebaseEvaluationResult)
      })

      evaluations.sort((a, b) => (b.createdAt?.getTime() || 0) - (a.createdAt?.getTime() || 0))
      callback(evaluations)
    })
  }

  // Create/submit a new evaluation result document (persists text responses)
  // Checks deadline before allowing submission
  async submitEvaluationResult(result: Omit<FirebaseEvaluationResult, "id" | "createdAt">): Promise<string> {
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

    const docRef = await addDoc(collection(db, this.collectionName), {
      ...result,
      createdAt: Timestamp.now(),
    })
    return docRef.id
  }

  // Static method to get evaluations once (no real-time)
  async getEvaluationsByProfessor(professorId: string): Promise<FirebaseEvaluationResult[]> {
    const q = query(collection(db, this.collectionName), where("professorId", "==", professorId))

    const snapshot = await getDocs(q)
    const evaluations: FirebaseEvaluationResult[] = []

    snapshot.forEach((doc) => {
      const data = doc.data()
      evaluations.push({
        id: doc.id,
        ...data,
        createdAt: data.createdAt?.toDate() || new Date(),
      } as FirebaseEvaluationResult)
    })

    return evaluations
  }
}

export const firebaseEvaluationService = new FirebaseEvaluationService()
