import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  getDocs,
  getDoc,
  setDoc,
  query,
  where,
  orderBy,
  Timestamp,
  writeBatch,
  onSnapshot,
  Unsubscribe,
} from "firebase/firestore"
import { db } from "./firebase"
import type { Department, Professor, EvaluationSubmission, EvaluationStats, EvaluationQuestion, Post, EvaluationDeadline } from "./types"

// Department operations
export const departmentService = {
  async create(name: string): Promise<string> {
    try {
      const docRef = await addDoc(collection(db, "departments"), {
        name,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      })
      return docRef.id
    } catch (error) {
      console.error("Error creating department:", error)
      throw error
    }
  },

  async getAll(): Promise<Department[]> {
    try {
      const querySnapshot = await getDocs(query(collection(db, "departments"), orderBy("name")))
      const departments = querySnapshot.docs.map((doc) => {
        const data = doc.data()
        // Clean up invalid imageUrl values (like "123123" or other non-URL values)
        // But allow base64 data URIs (data:image/...) which are valid
        let imageUrl = data.imageUrl
        if (imageUrl && typeof imageUrl === 'string') {
          const isValidUrl = imageUrl.startsWith('/api/') ||
            imageUrl.startsWith('http://') ||
            imageUrl.startsWith('https://') ||
            imageUrl.startsWith('/') ||
            imageUrl.startsWith('data:') // Allow base64 data URIs
          if (!isValidUrl) {
            // Invalid imageUrl - remove it
            console.warn(`Invalid imageUrl "${imageUrl}" found for department ${doc.id}, removing it`)
            imageUrl = undefined
            // Update database to remove invalid imageUrl
            updateDoc(doc.ref, { imageUrl: null }).catch(err =>
              console.warn(`Failed to clean invalid imageUrl for department ${doc.id}:`, err)
            )
          }
        }
        return {
          id: doc.id,
          ...doc.data(),
          imageUrl, // Use cleaned imageUrl
          createdAt: doc.data().createdAt.toDate(),
          updatedAt: doc.data().updatedAt.toDate(),
        }
      }) as Department[]

      return departments
    } catch (error) {
      console.error("Error fetching departments:", error)
      return []
    }
  },

  async update(id: string, name: string, imageUrl?: string): Promise<void> {
    const updateData: any = {
      name,
      updatedAt: Timestamp.now(),
    }
    // Update imageUrl if provided and valid
    // Accepts: /api/, http://, https://, /, or data: (base64 data URI)
    // This prevents invalid values like "123123" from being saved
    if (imageUrl !== undefined && imageUrl !== null && imageUrl !== '') {
      const isValidUrl = imageUrl.startsWith('/api/') ||
        imageUrl.startsWith('http://') ||
        imageUrl.startsWith('https://') ||
        imageUrl.startsWith('/') ||
        imageUrl.startsWith('data:') // Allow base64 data URIs
      if (isValidUrl) {
        updateData.imageUrl = imageUrl
      } else {
        // Invalid imageUrl - remove it instead of saving invalid value
        updateData.imageUrl = null
        console.warn(`Invalid imageUrl value "${imageUrl}" for department ${id}, removing it`)
      }
    } else if (imageUrl === null || imageUrl === '') {
      // Explicitly remove imageUrl if null or empty string is passed
      updateData.imageUrl = null
    }
    await updateDoc(doc(db, "departments", id), updateData)
  },

  async delete(id: string): Promise<void> {
    // First delete all professors in this department
    const professorsQuery = query(collection(db, "professors"), where("departmentId", "==", id))
    const professorsSnapshot = await getDocs(professorsQuery)

    const batch = writeBatch(db)
    professorsSnapshot.docs.forEach((doc) => {
      batch.delete(doc.ref)
    })

    // Delete the department
    batch.delete(doc(db, "departments", id))
    await batch.commit()
  },

  async deleteIfEmpty(departmentId: string): Promise<void> {
    try {
      // Check if department has any remaining professors
      const professorsQuery = query(collection(db, "professors"), where("departmentId", "==", departmentId))
      const professorsSnapshot = await getDocs(professorsQuery)

      // If no professors left, delete the department
      if (professorsSnapshot.empty) {
        await deleteDoc(doc(db, "departments", departmentId))
        console.log(`Department ${departmentId} deleted as it became empty`)
      }
    } catch (error) {
      console.error("Error checking/deleting empty department:", error)
      // Don't throw error here as it's not critical for professor deletion
    }
  },
}

// Professor operations
export const professorService = {
  async create(name: string, email: string, departmentName: string, password?: string): Promise<string> {
    try {
      // Find or create department
      let departmentId = ""
      const departmentsSnapshot = await getDocs(
        query(collection(db, "departments"), where("name", "==", departmentName)),
      )

      if (departmentsSnapshot.empty) {
        // Create new department if it doesn't exist
        departmentId = await departmentService.create(departmentName)
      } else {
        // Use existing department
        departmentId = departmentsSnapshot.docs[0].id
      }

      const professorData: any = {
        name,
        email,
        departmentId,
        departmentName,
        status: "active", // Default status for new professors
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      }

      // Only include password if provided (for security)
      if (password) {
        professorData.password = password
      }

      const docRef = await addDoc(collection(db, "professors"), professorData)
      return docRef.id
    } catch (error) {
      console.error("Error creating professor:", error)
      throw error
    }
  },

  // Batch import professors from Excel (skip duplicates)
  async importProfessors(
    professors: Array<{
      name: string
      email: string
      departmentName: string
      password: string
      subjects?: string[] // Array of subjects (supports multiple subjects)
      subject?: string // Legacy single subject field for backward compatibility
      subjectSections?: Array<{ subject: string; sections: string[]; course?: string }> // Paired subjects with sections and course handle
      handledSection?: string
    }>,
    onProgress?: (current: number, total: number) => void
  ): Promise<{ success: number; skipped: number; errors: string[] }> {
    let successCount = 0
    let skippedCount = 0
    const errors: string[] = []
    const batchSize = 500 // Firestore batch limit

    try {
      // Get all existing emails to check for duplicates
      const existingProfessorsQuery = query(collection(db, "professors"))
      const existingProfessorsSnapshot = await getDocs(existingProfessorsQuery)
      const existingEmails = new Set<string>()

      existingProfessorsSnapshot.docs.forEach(doc => {
        const data = doc.data()
        if (data.email) {
          existingEmails.add(data.email.toLowerCase().trim())
        }
      })

      // Process professors in batches
      const totalProfessors = professors.length
      onProgress?.(0, totalProfessors) // Initialize progress

      for (let i = 0; i < professors.length; i += batchSize) {
        const batch = writeBatch(db)
        let batchOperations = 0

        for (let j = i; j < Math.min(i + batchSize, professors.length); j++) {
          const professor = professors[j]

          // Normalize email for comparison
          const normalizedEmail = professor.email.toLowerCase().trim()

          // Check for duplicates
          if (existingEmails.has(normalizedEmail)) {
            skippedCount++
            errors.push(`Skipped: Email ${professor.email} already exists`)
            // Update progress even for skipped items
            onProgress?.(j + 1, totalProfessors)
            continue
          }

          // Add to set to prevent duplicates within the same import
          existingEmails.add(normalizedEmail)

          // Find or create department
          let departmentId = ""
          const departmentsSnapshot = await getDocs(
            query(collection(db, "departments"), where("name", "==", professor.departmentName))
          )

          if (departmentsSnapshot.empty) {
            departmentId = await departmentService.create(professor.departmentName)
          } else {
            departmentId = departmentsSnapshot.docs[0].id
          }

          // Create professor document
          const professorData: any = {
            name: professor.name.trim(),
            email: professor.email.trim(),
            departmentId,
            departmentName: professor.departmentName.trim(),
            password: professor.password,
            role: "professor",
            status: "active", // Default status for imported professors
            createdAt: Timestamp.now(),
            updatedAt: Timestamp.now(),
          }

          // Handle subjects - store as array in Firestore
          // Supports both new 'subjects' array format and legacy 'subject' string
          if (professor.subjects && professor.subjects.length > 0) {
            professorData.subjects = professor.subjects // Store as array
          } else if (professor.subject) {
            // Legacy support: convert single subject to array
            professorData.subjects = [professor.subject.trim()]
          }

          // Store subject-section pairs if available
          if (professor.subjectSections && professor.subjectSections.length > 0) {
            professorData.subjectSections = professor.subjectSections
          }

          if (professor.handledSection) {
            professorData.handledSection = professor.handledSection.trim()
          }

          const docRef = doc(collection(db, "professors"))
          batch.set(docRef, professorData)
          batchOperations++
          successCount++

          // Update progress after each professor
          onProgress?.(j + 1, totalProfessors)

          console.log(`Adding professor: ${professor.name} (${professor.email})`)
        }

        // Commit batch if it has operations
        if (batchOperations > 0) {
          await batch.commit()
          console.log(`Committed batch: ${batchOperations} professors saved`)
        }
      }

      // Ensure progress is 100% at the end
      onProgress?.(totalProfessors, totalProfessors)

      console.log(`Import complete: ${successCount} added, ${skippedCount} skipped`)
      return { success: successCount, skipped: skippedCount, errors }
    } catch (error) {
      console.error("Error importing professors:", error)
      throw error
    }
  },

  async getAll(): Promise<Professor[]> {
    try {
      const querySnapshot = await getDocs(query(collection(db, "professors"), orderBy("name")))
      const professors = querySnapshot.docs.map((doc) => {
        const data = doc.data()
        // Clean up invalid imageUrl values (like "123123" or other non-URL values)
        // But allow base64 data URIs (data:image/...) which are valid
        let imageUrl = data.imageUrl
        if (imageUrl && typeof imageUrl === 'string') {
          const isValidUrl = imageUrl.startsWith('/api/') ||
            imageUrl.startsWith('http://') ||
            imageUrl.startsWith('https://') ||
            imageUrl.startsWith('/') ||
            imageUrl.startsWith('data:') // Allow base64 data URIs
          if (!isValidUrl) {
            // Invalid imageUrl - remove it
            console.warn(`Invalid imageUrl "${imageUrl}" found for professor ${doc.id}, removing it`)
            imageUrl = undefined
            // Update database to remove invalid imageUrl
            updateDoc(doc.ref, { imageUrl: null }).catch(err =>
              console.warn(`Failed to clean invalid imageUrl for professor ${doc.id}:`, err)
            )
          }
        }
        // Include profilePictureUrl (can be base64 data URI)
        let profilePictureUrl = data.profilePictureUrl
        if (profilePictureUrl && typeof profilePictureUrl === 'string') {
          const isValidUrl = profilePictureUrl.startsWith('/api/') ||
            profilePictureUrl.startsWith('http://') ||
            profilePictureUrl.startsWith('https://') ||
            profilePictureUrl.startsWith('/') ||
            profilePictureUrl.startsWith('data:') // Allow base64 data URIs
          if (!isValidUrl) {
            // Invalid profilePictureUrl - remove it
            console.warn(`Invalid profilePictureUrl "${profilePictureUrl}" found for professor ${doc.id}, removing it`)
            profilePictureUrl = undefined
          }
        }
        return {
          id: doc.id,
          ...data,
          imageUrl, // Use cleaned imageUrl
          profilePictureUrl, // Include profilePictureUrl
          createdAt: doc.data().createdAt.toDate(),
          updatedAt: doc.data().updatedAt.toDate(),
        }
      }) as Professor[]

      return professors
    } catch (error) {
      console.error("Error fetching professors:", error)
      return []
    }
  },

  async getByDepartment(departmentId: string): Promise<Professor[]> {
    try {
      const querySnapshot = await getDocs(
        query(collection(db, "professors"), where("departmentId", "==", departmentId), orderBy("name")),
      )
      return querySnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt.toDate(),
        updatedAt: doc.data().updatedAt.toDate(),
      })) as Professor[]
    } catch (error) {
      console.error("Error fetching professors by department:", error)
      return []
    }
  },

  async update(id: string, name: string, email: string, departmentName: string, imageUrl?: string, password?: string, status?: "active" | "inactive" | "resigned" | "retired"): Promise<void> {
    try {
      // Find or create department
      let departmentId = ""
      const departmentsSnapshot = await getDocs(
        query(collection(db, "departments"), where("name", "==", departmentName)),
      )

      if (departmentsSnapshot.empty) {
        // Create new department if it doesn't exist
        departmentId = await departmentService.create(departmentName)
      } else {
        // Use existing department
        departmentId = departmentsSnapshot.docs[0].id
      }

      const updateData: any = {
        name,
        email,
        departmentId,
        departmentName,
        updatedAt: Timestamp.now(),
      }

      // Update imageUrl if provided and valid
      // Accepts: /api/, http://, https://, /, or data: (base64 data URI)
      // This prevents invalid values like "123123" from being saved
      if (imageUrl !== undefined && imageUrl !== null && imageUrl !== '') {
        const isValidUrl = imageUrl.startsWith('/api/') ||
          imageUrl.startsWith('http://') ||
          imageUrl.startsWith('https://') ||
          imageUrl.startsWith('/') ||
          imageUrl.startsWith('data:') // Allow base64 data URIs
        if (isValidUrl) {
          updateData.imageUrl = imageUrl
        } else {
          // Invalid imageUrl - remove it instead of saving invalid value
          updateData.imageUrl = null
          console.warn(`Invalid imageUrl value "${imageUrl}" for professor ${id}, removing it`)
        }
      } else if (imageUrl === null || imageUrl === '') {
        // Explicitly remove imageUrl if null or empty string is passed
        updateData.imageUrl = null
      }

      // Only update password if provided
      if (password) {
        updateData.password = password
      }

      // Update status if provided
      if (status) {
        updateData.status = status
      }

      await updateDoc(doc(db, "professors", id), updateData)
    } catch (error) {
      console.error("Error updating professor:", error)
      throw error
    }
  },

  // Update professor profile picture (saves as base64 data URI)
  async updateProfilePicture(id: string, profilePictureUrl: string): Promise<void> {
    try {
      const updateData: any = {
        profilePictureUrl,
        updatedAt: Timestamp.now(),
      }
      await updateDoc(doc(db, "professors", id), updateData)
    } catch (error) {
      console.error("Error updating professor profile picture:", error)
      throw error
    }
  },

  // Update professor subject sections (subjects and their handled sections)
  async updateSubjectSections(id: string, subjectSections: Array<{ subject: string; sections: string[]; course?: string }>): Promise<void> {
    try {
      // Extract subjects array from subjectSections
      const subjects = subjectSections.map(ss => ss.subject)

      const updateData: any = {
        subjectSections,
        subjects,
        updatedAt: Timestamp.now(),
      }
      await updateDoc(doc(db, "professors", id), updateData)
    } catch (error) {
      console.error("Error updating professor subject sections:", error)
      throw error
    }
  },

  async delete(id: string): Promise<void> {
    try {
      // Get professor info before deleting
      const professorDoc = await getDoc(doc(db, "professors", id))
      if (!professorDoc.exists()) {
        throw new Error("Professor not found")
      }

      const professorData = professorDoc.data()
      const departmentId = professorData.departmentId
      const professorEmail = professorData.email

      // COMPREHENSIVE DELETION: Delete all related data
      await this.deleteProfessorCompletely(id, professorEmail)

      // Check if department is now empty and delete it if so
      await departmentService.deleteIfEmpty(departmentId)
    } catch (error) {
      console.error("Error deleting professor:", error)
      throw error
    }
  },

  // Real-time listener for professors
  onProfessorsChange(callback: (professors: any[]) => void): Unsubscribe {
    let fallbackUnsubscribe: Unsubscribe | null = null
    let isMainListenerActive = true
    let isUnsubscribed = false
    let mainUnsubscribe: Unsubscribe | null = null

    // Try to use filtered query first, but handle errors gracefully
    try {
      // First try with orderBy
      const professorsQuery = query(
        collection(db, "professors"),
        orderBy("name", "asc")
      )

      mainUnsubscribe = onSnapshot(
        professorsQuery,
        (snapshot) => {
          if (!isMainListenerActive || isUnsubscribed) return

          try {
            const professors = snapshot.docs.map((doc) => {
              const data = doc.data()
              return {
                id: doc.id,
                ...data,
                createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : new Date(),
                updatedAt: data.updatedAt?.toDate ? data.updatedAt.toDate() : new Date(),
              }
            })

            callback(professors)
          } catch (processError: any) {
            // Suppress Firestore internal assertion errors
            const errorMessage = processError?.message || String(processError)
            if (errorMessage.includes('FIRESTORE') && errorMessage.includes('INTERNAL ASSERTION FAILED')) {
              console.warn("Firestore internal error suppressed in professor listener")
              return
            }
            console.error("Error processing professor data:", processError)
            if (!isUnsubscribed) {
              callback([])
            }
          }
        },
        (error: any) => {
          if (isUnsubscribed) return

          // Suppress Firestore internal assertion errors
          const errorMessage = error?.message || String(error)
          if (errorMessage.includes('FIRESTORE') && errorMessage.includes('INTERNAL ASSERTION FAILED')) {
            console.warn("Firestore internal error suppressed, continuing with listener")
            return
          }

          // Check if it's a missing index error
          if (error.code === 'failed-precondition' || error.message?.includes('index')) {
            console.warn("Composite index missing, using fallback query:", error)
          } else {
            console.error("Real-time listener error, using fallback:", error)
          }

          isMainListenerActive = false

          // Unsubscribe from main listener before setting up fallback
          if (mainUnsubscribe) {
            try {
              mainUnsubscribe()
            } catch (unsubError: any) {
              // Suppress errors during unsubscribe
              const unsubErrorMessage = unsubError?.message || String(unsubError)
              if (!unsubErrorMessage.includes('FIRESTORE') || !unsubErrorMessage.includes('INTERNAL ASSERTION FAILED')) {
                console.error("Error unsubscribing main listener:", unsubError)
              }
            }
            mainUnsubscribe = null
          }

          // Use setTimeout to avoid state conflicts
          setTimeout(() => {
            if (isUnsubscribed) return

            try {
              // Fallback: try without orderBy
              const fallbackQuery = query(
                collection(db, "professors")
              )

              fallbackUnsubscribe = onSnapshot(
                fallbackQuery,
                (fallbackSnapshot) => {
                  if (isUnsubscribed) return

                  try {
                    const allDocs = fallbackSnapshot.docs.map((doc) => {
                      const data = doc.data()
                      return {
                        id: doc.id,
                        ...data,
                        createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : new Date(),
                        updatedAt: data.updatedAt?.toDate ? data.updatedAt.toDate() : new Date(),
                      } as any
                    })

                    // Sort manually if needed
                    allDocs.sort((a, b) => {
                      const aName = a.name || ''
                      const bName = b.name || ''
                      return aName.localeCompare(bName)
                    })

                    callback(allDocs)
                  } catch (processError: any) {
                    // Suppress Firestore internal errors
                    const errorMessage = processError?.message || String(processError)
                    if (errorMessage.includes('FIRESTORE') && errorMessage.includes('INTERNAL ASSERTION FAILED')) {
                      console.warn("Firestore internal error suppressed in fallback listener")
                      return
                    }
                    console.error("Error processing fallback data:", processError)
                    if (!isUnsubscribed) {
                      callback([])
                    }
                  }
                },
                (fallbackError: any) => {
                  if (isUnsubscribed) return
                  // Suppress Firestore internal errors
                  const errorMessage = fallbackError?.message || String(fallbackError)
                  if (errorMessage.includes('FIRESTORE') && errorMessage.includes('INTERNAL ASSERTION FAILED')) {
                    console.warn("Firestore internal error suppressed in fallback error handler")
                    return
                  }
                  console.error("Fallback listener also failed:", fallbackError)
                  callback([])
                }
              )
            } catch (fallbackSetupError: any) {
              // Suppress Firestore internal errors
              const errorMessage = fallbackSetupError?.message || String(fallbackSetupError)
              if (errorMessage.includes('FIRESTORE') && errorMessage.includes('INTERNAL ASSERTION FAILED')) {
                console.warn("Firestore internal error suppressed in fallback setup")
                return
              }
              console.error("Error setting up fallback listener:", fallbackSetupError)
              if (!isUnsubscribed) {
                callback([])
              }
            }
          }, 200) // Increased delay to avoid race conditions
        }
      )

      // Return a function that unsubscribes from both listeners
      return () => {
        isUnsubscribed = true
        isMainListenerActive = false

        if (mainUnsubscribe) {
          try {
            mainUnsubscribe()
          } catch (error: any) {
            // Suppress Firestore internal errors during cleanup
            const errorMessage = error?.message || String(error)
            if (!errorMessage.includes('FIRESTORE') || !errorMessage.includes('INTERNAL ASSERTION FAILED')) {
              console.error("Error unsubscribing main listener:", error)
            }
          }
        }

        if (fallbackUnsubscribe) {
          try {
            fallbackUnsubscribe()
          } catch (error: any) {
            // Suppress Firestore internal errors during cleanup
            const errorMessage = error?.message || String(error)
            if (!errorMessage.includes('FIRESTORE') || !errorMessage.includes('INTERNAL ASSERTION FAILED')) {
              console.error("Error unsubscribing fallback listener:", error)
            }
          }
        }
      }
    } catch (setupError: any) {
      // Suppress Firestore internal errors
      const errorMessage = setupError?.message || String(setupError)
      if (!errorMessage.includes('FIRESTORE') || !errorMessage.includes('INTERNAL ASSERTION FAILED')) {
        console.error("Error setting up professor listener:", setupError)
      }
      // Return empty callback if setup fails
      callback([])
      return () => { } // Return empty unsubscribe function
    }
  },

  // Comprehensive deletion function that removes ALL professor-related data
  async deleteProfessorCompletely(professorId: string, professorEmail: string): Promise<void> {
    try {
      // Get professor info before deleting
      const professorDoc = await getDoc(doc(db, "professors", professorId))
      const professorName = professorDoc.exists() ? professorDoc.data().name : null

      // Run all queries in parallel for faster execution
      const [
        evaluationResultsSnapshot,
        evaluationResultsByEmailSnapshot,
        evaluationSubmissionsSnapshot,
        evaluationQuestionsSnapshot,
        postsSnapshot
      ] = await Promise.all([
        getDocs(query(collection(db, "evaluation_results"), where("professorId", "==", professorId))),
        getDocs(query(collection(db, "evaluation_results"), where("professorEmail", "==", professorEmail))),
        getDocs(query(collection(db, "evaluation_results"), where("professorId", "==", professorId))),
        getDocs(query(collection(db, "evaluation_questions"), where("teacherId", "==", professorId))),
        getDocs(query(collection(db, "posts"), where("teacherId", "==", professorId)))
      ])

      // Collect all document references
      const docRefsToDelete: any[] = []
      const seenPaths = new Set<string>()

      // Helper to add ref if not already seen
      const addRefIfUnique = (ref: any) => {
        const path = ref.path
        if (!seenPaths.has(path)) {
          seenPaths.add(path)
          docRefsToDelete.push(ref)
        }
      }

      evaluationResultsSnapshot.docs.forEach((doc) => addRefIfUnique(doc.ref))
      evaluationResultsByEmailSnapshot.docs.forEach((doc) => addRefIfUnique(doc.ref))
      evaluationSubmissionsSnapshot.docs.forEach((doc) => addRefIfUnique(doc.ref))
      evaluationQuestionsSnapshot.docs.forEach((doc) => addRefIfUnique(doc.ref))
      postsSnapshot.docs.forEach((doc) => addRefIfUnique(doc.ref))

      // Add professor document
      const professorRef = doc(db, "professors", professorId)
      addRefIfUnique(professorRef)

      // Process deletions in batches (Firestore limit is 500 per batch)
      const batchSize = 500
      for (let i = 0; i < docRefsToDelete.length; i += batchSize) {
        const batch = writeBatch(db)
        const batchRefs = docRefsToDelete.slice(i, i + batchSize)

        batchRefs.forEach((ref) => {
          batch.delete(ref)
        })

        await batch.commit()
      }

      console.log(`Successfully deleted professor ${professorId} and all related data`)


      // Delete from Firebase Authentication via API endpoint (non-blocking, fire and forget)
      fetch('/api/delete-user-auth', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email: professorEmail })
      }).then((response) => {
        if (response.ok) {
          console.log(`✅ Successfully deleted from Firebase Auth: ${professorEmail}`)
        } else {
          console.warn(`⚠️ Failed to delete from Firebase Auth: ${professorEmail}`)
        }
      }).catch((authError) => {
        console.warn("Could not delete from Firebase Auth (API call failed):", authError)
      })

    } catch (error) {
      console.error("Error in comprehensive professor deletion:", error)
      throw error
    }
  },
}

// Evaluation operations
export const evaluationService = {
  async submit(evaluation: Omit<EvaluationSubmission, "id" | "submittedAt">): Promise<string> {
    const docRef = await addDoc(collection(db, "evaluation_results"), {
      ...evaluation,
      submittedAt: Timestamp.now(),
    })
    return docRef.id
  },

  async getAll(): Promise<EvaluationSubmission[]> {
    try {
      const querySnapshot = await getDocs(query(collection(db, "evaluation_results"), orderBy("submittedAt", "desc")))
      return querySnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
        submittedAt: doc.data().submittedAt.toDate(),
      })) as EvaluationSubmission[]
    } catch (error) {
      console.error("Error fetching evaluations:", error)
      return []
    }
  },

  async getByProfessor(professorId: string): Promise<EvaluationSubmission[]> {
    try {
      const querySnapshot = await getDocs(
        query(collection(db, "evaluation_results"), where("professorId", "==", professorId), orderBy("submittedAt", "desc")),
      )
      return querySnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
        submittedAt: doc.data().submittedAt.toDate(),
      })) as EvaluationSubmission[]
    } catch (error) {
      console.error("Error fetching evaluations by professor:", error)
      // Fallback: try without orderBy if composite index is missing
      try {
        const fallbackQuery = query(collection(db, "evaluation_results"), where("professorId", "==", professorId))
        const fallbackSnapshot = await getDocs(fallbackQuery)
        const results = fallbackSnapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
          submittedAt: doc.data().submittedAt.toDate(),
        })) as EvaluationSubmission[]
        // Sort manually
        return results.sort((a, b) => b.submittedAt.getTime() - a.submittedAt.getTime())
      } catch (fallbackError) {
        console.error("Fallback query also failed:", fallbackError)
        return []
      }
    }
  },

  async getByDepartment(departmentId: string): Promise<EvaluationSubmission[]> {
    try {
      const querySnapshot = await getDocs(
        query(collection(db, "evaluation_results"), where("departmentId", "==", departmentId), orderBy("submittedAt", "desc")),
      )
      return querySnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
        submittedAt: doc.data().submittedAt.toDate(),
      })) as EvaluationSubmission[]
    } catch (error) {
      console.error("Error fetching evaluations by department:", error)
      // Fallback: try without orderBy if composite index is missing
      try {
        const fallbackQuery = query(collection(db, "evaluation_results"), where("departmentId", "==", departmentId))
        const fallbackSnapshot = await getDocs(fallbackQuery)
        const results = fallbackSnapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
          submittedAt: doc.data().submittedAt.toDate(),
        })) as EvaluationSubmission[]
        // Sort manually
        return results.sort((a, b) => b.submittedAt.getTime() - a.submittedAt.getTime())
      } catch (fallbackError) {
        console.error("Fallback query also failed:", fallbackError)
        return []
      }
    }
  },
}

// Evaluation question operations
export const evaluationQuestionService = {
  // Always write to Firestore so questions are truly saved and visible in dashboard
  async create(questionData: Omit<EvaluationQuestion, "id" | "createdAt" | "updatedAt">): Promise<string> {
    const docRef = await addDoc(collection(db, "evaluation_questions"), {
      ...questionData,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    })
    return docRef.id
  },

  // Real-time listener for questions
  onQuestionsChange(callback: (questions: EvaluationQuestion[]) => void): () => void {
    const q = query(collection(db, "evaluation_questions"), orderBy("createdAt", "desc"))
    const unsubscribe = onSnapshot(
      q,
      (snap) => {
        const items = snap.docs.map((d) => ({
          id: d.id,
          ...(d.data() as any),
          createdAt: d.data().createdAt?.toDate?.() ?? new Date(),
          updatedAt: d.data().updatedAt?.toDate?.() ?? new Date(),
        })) as EvaluationQuestion[]
        callback(items)
      },
      (err) => {
        console.error("onQuestionsChange error:", err)
        callback([])
      },
    )
    return unsubscribe
  },

  async getAll(): Promise<EvaluationQuestion[]> {
    const querySnapshot = await getDocs(query(collection(db, "evaluation_questions"), orderBy("createdAt", "desc")))
    return querySnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
      createdAt: doc.data().createdAt.toDate(),
      updatedAt: doc.data().updatedAt.toDate(),
    })) as EvaluationQuestion[]
  },

  async getByPost(postId: string): Promise<EvaluationQuestion[]> {
    const querySnapshot = await getDocs(
      query(collection(db, "evaluation_questions"), where("postId", "==", postId), orderBy("createdAt", "desc")),
    )
    return querySnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
      createdAt: doc.data().createdAt.toDate(),
      updatedAt: doc.data().updatedAt.toDate(),
    })) as EvaluationQuestion[]
  },

  async getByTeacher(teacherId: string): Promise<EvaluationQuestion[]> {
    const querySnapshot = await getDocs(
      query(collection(db, "evaluation_questions"), where("teacherId", "==", teacherId), orderBy("createdAt", "desc")),
    )
    return querySnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
      createdAt: doc.data().createdAt.toDate(),
      updatedAt: doc.data().updatedAt.toDate(),
    })) as EvaluationQuestion[]
  },

  async update(id: string, questionData: Omit<EvaluationQuestion, "id" | "createdAt" | "updatedAt">): Promise<void> {
    await updateDoc(doc(db, "evaluation_questions", id), {
      ...questionData,
      updatedAt: Timestamp.now(),
    })
  },

  async delete(id: string): Promise<void> {
    await deleteDoc(doc(db, "evaluation_questions", id))
  },

  async getBySection(section: string): Promise<EvaluationQuestion[]> {
    const querySnapshot = await getDocs(
      query(collection(db, "evaluation_questions"), where("section", "==", section), orderBy("createdAt", "desc")),
    )
    return querySnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
      createdAt: doc.data().createdAt.toDate(),
      updatedAt: doc.data().updatedAt.toDate(),
    })) as EvaluationQuestion[]
  },

  async getSectionStats(): Promise<{ [section: string]: { count: number; weight: string } }> {
    const questions = await this.getAll()
    const sectionStats: { [section: string]: { count: number; weight: string } } = {}

    questions.forEach((question) => {
      if (question.section) {
        if (!sectionStats[question.section]) {
          sectionStats[question.section] = {
            count: 0,
            weight: question.weight || '0%'
          }
        }
        sectionStats[question.section].count++
      }
    })

    return sectionStats
  },

  async getActiveQuestions(): Promise<EvaluationQuestion[]> {
    // Use simple query without orderBy to avoid index requirement
    const querySnapshot = await getDocs(
      query(collection(db, "evaluation_questions"), where("isActive", "==", true)),
    )
    const questions = querySnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
      createdAt: doc.data().createdAt?.toDate() || new Date(),
      updatedAt: doc.data().updatedAt?.toDate() || new Date(),
    })) as EvaluationQuestion[]

    // Sort in memory by createdAt descending
    return questions.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
  },
}

// Question type operations (ensures a canonical list of types exists)
export const questionTypeService = {
  async createIfMissing(name: "Likert Scale" | "text"): Promise<string | null> {
    try {
      const existing = await getDocs(query(collection(db, "question_types"), where("name", "==", name)))
      if (!existing.empty) {
        return null
      }

      const docRef = await addDoc(collection(db, "question_types"), {
        name,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      })
      return docRef.id
    } catch (error) {
      console.warn("questionTypeService.createIfMissing failed:", error)
      return null
    }
  },

  async getAll(): Promise<{ id: string; name: string; createdAt: Date; updatedAt: Date }[]> {
    try {
      const snap = await getDocs(query(collection(db, "question_types"), orderBy("name")))
      return snap.docs.map((d) => ({
        id: d.id,
        ...(d.data() as any),
        createdAt: (d.data() as any).createdAt?.toDate?.() ?? new Date(),
        updatedAt: (d.data() as any).updatedAt?.toDate?.() ?? new Date(),
      }))
    } catch (error) {
      console.warn("questionTypeService.getAll failed:", error)
      return []
    }
  },

  // Real-time listener for question types
  onChange(callback: (types: { id: string; name: string; createdAt: Date; updatedAt: Date }[]) => void): () => void {
    const q = query(collection(db, "question_types"), orderBy("name"))
    const unsubscribe = onSnapshot(
      q,
      (snap) => {
        const items = snap.docs.map((d) => ({
          id: d.id,
          ...(d.data() as any),
          createdAt: (d.data() as any).createdAt?.toDate?.() ?? new Date(),
          updatedAt: (d.data() as any).updatedAt?.toDate?.() ?? new Date(),
        }))
        callback(items)
      },
      (err) => {
        console.error("onQuestionTypesChange error:", err)
        callback([])
      },
    )
    return unsubscribe
  },
}

// Post operations service
export const postService = {
  async create(title: string, description: string, teacherId: string): Promise<string> {
    try {
      // Find teacher to get teacher name
      const professors = await professorService.getAll()
      const teacher = professors.find((p) => p.id === teacherId)
      if (!teacher) {
        throw new Error("Teacher not found")
      }

      const docRef = await addDoc(collection(db, "posts"), {
        title,
        description,
        teacherId,
        teacherName: teacher.name,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      })
      return docRef.id
    } catch (error) {
      console.error("Error creating post:", error)
      throw error
    }
  },

  async getAll(): Promise<Post[]> {
    try {
      const querySnapshot = await getDocs(query(collection(db, "posts"), orderBy("createdAt", "desc")))
      return querySnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt.toDate(),
        updatedAt: doc.data().updatedAt.toDate(),
      })) as Post[]
    } catch (error) {
      console.error("Error fetching posts:", error)
      return []
    }
  },

  async getByTeacher(teacherId: string): Promise<Post[]> {
    try {
      const querySnapshot = await getDocs(
        query(collection(db, "posts"), where("teacherId", "==", teacherId), orderBy("createdAt", "desc")),
      )
      return querySnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt.toDate(),
        updatedAt: doc.data().updatedAt.toDate(),
      })) as Post[]
    } catch (error) {
      console.error("Error fetching posts for teacher:", error)
      return []
    }
  },

  async update(id: string, title: string, description: string): Promise<void> {
    await updateDoc(doc(db, "posts", id), {
      title,
      description,
      updatedAt: Timestamp.now(),
    })
  },

  async delete(id: string): Promise<void> {
    // First delete all questions associated with this post
    const questionsQuery = query(collection(db, "evaluation_questions"), where("postId", "==", id))
    const questionsSnapshot = await getDocs(questionsQuery)

    const batch = writeBatch(db)
    questionsSnapshot.docs.forEach((doc) => {
      batch.delete(doc.ref)
    })

    // Delete the post
    batch.delete(doc(db, "posts", id))
    await batch.commit()
  },
}

// Real-time student listener
export const studentService = {
  // Real-time listener for students
  onStudentsChange(callback: (students: any[]) => void): Unsubscribe {
    let fallbackUnsubscribe: Unsubscribe | null = null
    let isMainListenerActive = true
    let isUnsubscribed = false
    let mainUnsubscribe: Unsubscribe | null = null
    let fallbackTimeout: NodeJS.Timeout | null = null

    // Try to use filtered query first, but handle errors gracefully
    try {
      // First try with orderBy
      const studentsQuery = query(
        collection(db, "users"),
        where("role", "==", "student"),
        orderBy("createdAt", "desc")
      )

      mainUnsubscribe = onSnapshot(
        studentsQuery,
        (snapshot) => {
          // Early return checks
          if (!isMainListenerActive || isUnsubscribed) return

          try {
            const students = snapshot.docs.map((doc) => {
              const data = doc.data()
              return {
                id: doc.id,
                ...data,
                createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : new Date(),
                updatedAt: data.updatedAt?.toDate ? data.updatedAt.toDate() : new Date(),
              }
            })

            // Only call callback if not unsubscribed
            if (!isUnsubscribed) {
              callback(students)
            }
          } catch (processError: any) {
            // Suppress Firestore internal assertion errors
            const errorMessage = processError?.message || String(processError)
            if (errorMessage.includes('FIRESTORE') && errorMessage.includes('INTERNAL ASSERTION FAILED')) {
              console.warn("Firestore internal error suppressed in student listener")
              return
            }
            console.error("Error processing student data:", processError)
            if (!isUnsubscribed) {
              callback([])
            }
          }
        },
        (error: any) => {
          // Early return if already unsubscribed
          if (isUnsubscribed) return

          // Suppress Firestore internal assertion errors
          const errorMessage = error?.message || String(error)
          if (errorMessage.includes('FIRESTORE') && errorMessage.includes('INTERNAL ASSERTION FAILED')) {
            console.warn("Firestore internal error suppressed, continuing with listener")
            return
          }

          // Check if it's a missing index error
          if (error.code === 'failed-precondition' || error.message?.includes('index')) {
            console.warn("Composite index missing, using fallback query:", error)
          } else {
            console.error("Real-time listener error, using fallback:", error)
          }

          // Mark main listener as inactive
          isMainListenerActive = false

          // Unsubscribe from main listener before setting up fallback
          if (mainUnsubscribe) {
            try {
              mainUnsubscribe()
            } catch (unsubError: any) {
              // Suppress errors during unsubscribe
              const unsubErrorMessage = unsubError?.message || String(unsubError)
              if (!unsubErrorMessage.includes('FIRESTORE') || !unsubErrorMessage.includes('INTERNAL ASSERTION FAILED')) {
                console.error("Error unsubscribing main listener:", unsubError)
              }
            }
            mainUnsubscribe = null
          }

          // Clear any existing fallback timeout
          if (fallbackTimeout) {
            clearTimeout(fallbackTimeout)
            fallbackTimeout = null
          }

          // Use setTimeout to avoid state conflicts - increased delay
          fallbackTimeout = setTimeout(() => {
            // Double check if still subscribed
            if (isUnsubscribed) {
              fallbackTimeout = null
              return
            }

            try {
              // Fallback: try without orderBy
              const fallbackQuery = query(
                collection(db, "users"),
                where("role", "==", "student")
              )

              fallbackUnsubscribe = onSnapshot(
                fallbackQuery,
                (fallbackSnapshot) => {
                  // Early return check
                  if (isUnsubscribed) return

                  try {
                    const allDocs = fallbackSnapshot.docs.map((doc) => {
                      const data = doc.data()
                      return {
                        id: doc.id,
                        ...data,
                        createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : new Date(),
                        updatedAt: data.updatedAt?.toDate ? data.updatedAt.toDate() : new Date(),
                      } as any
                    })

                    // Sort manually if needed
                    allDocs.sort((a, b) => {
                      const aDate = a.createdAt instanceof Date ? a.createdAt.getTime() : 0
                      const bDate = b.createdAt instanceof Date ? b.createdAt.getTime() : 0
                      return bDate - aDate
                    })

                    // Only call callback if not unsubscribed
                    if (!isUnsubscribed) {
                      callback(allDocs)
                    }
                  } catch (processError: any) {
                    // Suppress Firestore internal errors
                    const errorMessage = processError?.message || String(processError)
                    if (errorMessage.includes('FIRESTORE') && errorMessage.includes('INTERNAL ASSERTION FAILED')) {
                      console.warn("Firestore internal error suppressed in fallback listener")
                      return
                    }
                    console.error("Error processing fallback data:", processError)
                    if (!isUnsubscribed) {
                      callback([])
                    }
                  }
                },
                (fallbackError: any) => {
                  // Early return check
                  if (isUnsubscribed) return

                  // Suppress Firestore internal errors
                  const errorMessage = fallbackError?.message || String(fallbackError)
                  if (errorMessage.includes('FIRESTORE') && errorMessage.includes('INTERNAL ASSERTION FAILED')) {
                    console.warn("Firestore internal error suppressed in fallback error handler")
                    return
                  }
                  console.error("Fallback listener also failed:", fallbackError)
                  if (!isUnsubscribed) {
                    callback([])
                  }
                }
              )
            } catch (fallbackSetupError: any) {
              // Suppress Firestore internal errors
              const errorMessage = fallbackSetupError?.message || String(fallbackSetupError)
              if (errorMessage.includes('FIRESTORE') && errorMessage.includes('INTERNAL ASSERTION FAILED')) {
                console.warn("Firestore internal error suppressed in fallback setup")
                return
              }
              console.error("Error setting up fallback listener:", fallbackSetupError)
              if (!isUnsubscribed) {
                callback([])
              }
            } finally {
              fallbackTimeout = null
            }
          }, 300) // Increased delay to avoid race conditions
        }
      )

      // Return a function that unsubscribes from both listeners
      return () => {
        // Mark as unsubscribed first to prevent any callbacks
        isUnsubscribed = true
        isMainListenerActive = false

        // Clear fallback timeout if it exists
        if (fallbackTimeout) {
          clearTimeout(fallbackTimeout)
          fallbackTimeout = null
        }

        // Unsubscribe from main listener
        if (mainUnsubscribe) {
          try {
            mainUnsubscribe()
          } catch (error: any) {
            // Suppress Firestore internal errors during unsubscribe
            const errorMessage = error?.message || String(error)
            if (!errorMessage.includes('FIRESTORE') || !errorMessage.includes('INTERNAL ASSERTION FAILED')) {
              console.error("Error unsubscribing main listener:", error)
            }
          }
          mainUnsubscribe = null
        }

        // Unsubscribe from fallback listener
        if (fallbackUnsubscribe) {
          try {
            fallbackUnsubscribe()
          } catch (error: any) {
            // Suppress Firestore internal errors during unsubscribe
            const errorMessage = error?.message || String(error)
            if (!errorMessage.includes('FIRESTORE') || !errorMessage.includes('INTERNAL ASSERTION FAILED')) {
              console.error("Error unsubscribing fallback listener:", error)
            }
          }
          fallbackUnsubscribe = null
        }
      }
    } catch (setupError) {
      console.error("Error setting up student listener:", setupError)
      // Return empty callback if setup fails
      callback([])
      return () => { } // Return empty unsubscribe function
    }
  },
  async create(firstName: string, lastName: string, suffix: string, studentId: string, email: string, password: string, yearLevel: string, course: string, section: string, subject?: string, status?: string, accountStatus?: string): Promise<string> {
    try {
      // Check if student ID already exists
      const existingStudentQuery = query(
        collection(db, "users"),
        where("studentId", "==", studentId)
      )
      const existingStudentSnapshot = await getDocs(existingStudentQuery)

      if (!existingStudentSnapshot.empty) {
        throw new Error("Student ID already exists. Please use a different student ID.")
      }

      // Check if email already exists
      const existingEmailQuery = query(
        collection(db, "users"),
        where("email", "==", email)
      )
      const existingEmailSnapshot = await getDocs(existingEmailQuery)

      if (!existingEmailSnapshot.empty) {
        throw new Error("Email already exists. Please use a different email address.")
      }

      const studentData: any = {
        firstName,
        lastName,
        suffix: suffix || "",
        studentId,
        email,
        password,
        yearLevel,
        course,
        section,
        role: "student",
        accountStatus: accountStatus || "active", // Default to active
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      }

      // Add optional fields if provided
      if (subject) {
        studentData.subject = subject
      }
      if (status) {
        studentData.status = status
      }

      const docRef = await addDoc(collection(db, "users"), studentData)
      return docRef.id
    } catch (error) {
      console.error("Error creating student:", error)
      throw error
    }
  },

  // Batch import students from Excel (skip duplicates)
  async importStudents(students: Array<{
    firstName: string
    lastName: string
    suffix: string
    studentId: string
    email: string
    password: string
    yearLevel: string
    course: string
    section: string
    subjects?: string[] // Array of enrolled subjects (supports multiple subjects)
    subject?: string // Legacy single subject field for backward compatibility
    status?: string
    accountStatus?: string
  }>): Promise<{ success: number; skipped: number; errors: string[] }> {
    let successCount = 0
    let skippedCount = 0
    const errors: string[] = []
    const batchSize = 500 // Firestore batch limit

    try {
      // Get all existing emails and studentIds to check for duplicates
      const existingUsersQuery = query(collection(db, "users"), where("role", "==", "student"))
      const existingUsersSnapshot = await getDocs(existingUsersQuery)
      const existingEmails = new Set<string>()
      const existingStudentIds = new Set<string>()

      existingUsersSnapshot.docs.forEach(doc => {
        const data = doc.data()
        if (data.email) existingEmails.add(data.email.toLowerCase())
        if (data.studentId) existingStudentIds.add(data.studentId)
      })

      // Process students in batches
      for (let i = 0; i < students.length; i += batchSize) {
        const batch = writeBatch(db)
        let batchOperations = 0

        for (let j = i; j < Math.min(i + batchSize, students.length); j++) {
          const student = students[j]

          // Check for duplicates
          if (existingEmails.has(student.email.toLowerCase())) {
            skippedCount++
            errors.push(`Skipped: Email ${student.email} already exists`)
            continue
          }

          if (existingStudentIds.has(student.studentId)) {
            skippedCount++
            errors.push(`Skipped: Student ID ${student.studentId} already exists`)
            continue
          }

          // Add to sets to prevent duplicates within the same import
          existingEmails.add(student.email.toLowerCase())
          existingStudentIds.add(student.studentId)

          // Create student document
          const studentData: any = {
            firstName: student.firstName,
            lastName: student.lastName,
            suffix: student.suffix || "",
            studentId: student.studentId,
            email: student.email,
            password: student.password,
            yearLevel: student.yearLevel,
            course: student.course,
            section: student.section,
            role: "student",
            accountStatus: student.accountStatus || "active", // Default to active
            createdAt: Timestamp.now(),
            updatedAt: Timestamp.now(),
          }

          // Handle subjects - store as array in Firestore
          // Supports both new 'subjects' array format and legacy 'subject' string
          if (student.subjects && student.subjects.length > 0) {
            studentData.subjects = student.subjects // Store as array
          } else if (student.subject) {
            // Legacy support: convert single subject to array
            studentData.subjects = [student.subject]
          }

          if (student.status) {
            studentData.status = student.status
          }

          const docRef = doc(collection(db, "users"))
          batch.set(docRef, studentData)
          batchOperations++
          successCount++
        }

        // Commit batch if it has operations
        if (batchOperations > 0) {
          await batch.commit()
        }
      }

      return { success: successCount, skipped: skippedCount, errors }
    } catch (error) {
      console.error("Error importing students:", error)
      throw error
    }
  },

  async update(id: string, firstName: string, lastName: string, suffix: string, studentId: string, email: string, yearLevel: string, course: string, section: string, password?: string, subject?: string, status?: string, accountStatus?: string): Promise<void> {
    try {
      // Only check for duplicate student ID if a non-empty studentId is provided
      if (studentId && studentId.trim() !== "") {
        const existingStudentQuery = query(
          collection(db, "users"),
          where("studentId", "==", studentId)
        )
        const existingStudentSnapshot = await getDocs(existingStudentQuery)

        // Filter out the current student being updated
        const duplicateStudentId = existingStudentSnapshot.docs.find(doc => doc.id !== id)
        if (duplicateStudentId) {
          throw new Error("Student ID already exists. Please use a different student ID.")
        }
      }

      // Check if email already exists (excluding current student)
      const existingEmailQuery = query(
        collection(db, "users"),
        where("email", "==", email)
      )
      const existingEmailSnapshot = await getDocs(existingEmailQuery)

      // Filter out the current student being updated
      const duplicateEmail = existingEmailSnapshot.docs.find(doc => doc.id !== id)
      if (duplicateEmail) {
        throw new Error("Email already exists. Please use a different email address.")
      }

      const updateData: any = {
        firstName,
        lastName,
        suffix: suffix || "",
        email,
        yearLevel,
        course,
        section,
        updatedAt: Timestamp.now(),
      }

      // Only update studentId if a non-empty value is provided
      if (studentId && studentId.trim() !== "") {
        updateData.studentId = studentId
      }

      // Only update password if provided
      if (password) {
        updateData.password = password

        // Update password in Firebase Authentication (synchronous - must complete)
        // This ensures the user can login immediately after password change
        try {
          const response = await fetch('/api/update-user-password', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              email: email,
              password: password
            })
          })

          if (!response.ok) {
            const errorData = await response.json()
            console.error('Failed to update password in Firebase Auth:', errorData.error)
            // Don't throw error - we'll still update Firestore
            // But log it so we know there's an issue
          } else {
            console.log('Password updated in Firebase Auth successfully')
          }
        } catch (authError) {
          console.error('Error updating password in Firebase Auth:', authError)
          // Continue with Firestore update even if Auth update fails
          // The password is still saved in Firestore and can be used for fallback auth
        }
      }

      // Add optional fields if provided
      if (subject !== undefined) {
        // Parse comma-separated subjects string into array
        const subjectsArray = subject ? subject.split(',').map(s => s.trim()).filter(s => s) : []
        updateData.subjects = subjectsArray // Save as array
        updateData.subject = subject // Also save as legacy string for backward compatibility
      }
      if (status !== undefined) {
        updateData.status = status
      }
      if (accountStatus !== undefined) {
        updateData.accountStatus = accountStatus
      }

      await updateDoc(doc(db, "users", id), updateData)
    } catch (error) {
      console.error("Error updating student:", error)
      throw error
    }
  },

  async getAll(): Promise<any[]> {
    try {
      // Try filtered query first
      let students = []

      try {
        const querySnapshot = await getDocs(
          query(collection(db, "users"), where("role", "==", "student"), orderBy("createdAt", "desc"))
        )

        students = querySnapshot.docs.map((doc) => {
          const data = doc.data()
          return {
            id: doc.id,
            ...data,
            createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : new Date(),
            updatedAt: data.updatedAt?.toDate ? data.updatedAt.toDate() : new Date(),
          }
        })
      } catch (filterError) {
        // Fallback: Get all documents and filter manually (index may not exist)
        const allDocsQuery = query(collection(db, "users"))
        const allDocsSnapshot = await getDocs(allDocsQuery)

        const allDocs = allDocsSnapshot.docs.map((doc) => {
          const data = doc.data()
          return {
            id: doc.id,
            ...data,
            createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : new Date(),
            updatedAt: data.updatedAt?.toDate ? data.updatedAt.toDate() : new Date(),
          } as any
        })

        // Filter for students
        students = allDocs.filter((doc: any) =>
          doc.role === "student" ||
          doc.studentId ||
          (doc.firstName && doc.lastName && doc.email && !doc.departmentId)
        )
      }

      return students
    } catch (error) {
      console.error("Error fetching students:", error)
      return []
    }
  },

  async delete(id: string): Promise<void> {
    try {
      await deleteDoc(doc(db, "users", id))
    } catch (error) {
      console.error("Error deleting student:", error)
      throw error
    }
  },
}

// Statistics calculations
export const statsService = {
  async calculateStats(): Promise<EvaluationStats[]> {
    try {
      // Import evaluation results service
      const { evaluationResultsService } = await import("./evaluation-results-service")

      const [professors, evaluationResults, students] = await Promise.all([
        professorService.getAll(),
        evaluationResultsService.getAll(),
        studentService.getAll()
      ])

      // Get total number of students
      const totalStudents = students.length

      // Filter only submitted and complete evaluations
      const submittedResults = evaluationResults.filter(
        (result) => result.evaluationStatus === "submitted" && result.isComplete
      )

      // Calculate stats for each professor
      const stats: EvaluationStats[] = professors.map((professor) => {
        // Count submitted and complete evaluations for this professor
        const professorEvaluations = submittedResults.filter(
          (result) => result.professorId === professor.id
        )

        // Each evaluation result document represents one student's complete evaluation for one professor
        // Count unique documents (each document = 1 student evaluation)
        const submittedCount = professorEvaluations.length

        // Calculate total students who should evaluate this professor
        // Since all students should evaluate all professors, use total students
        // If no students exist, set to 1 to avoid division by zero
        const totalStudentsForProfessor = totalStudents > 0 ? totalStudents : 1

        // Calculate completion rate (percentage of students who submitted)
        const completionRate = totalStudentsForProfessor > 0
          ? Math.round((submittedCount / totalStudentsForProfessor) * 100)
          : 0

        return {
          departmentId: professor.departmentId,
          departmentName: professor.departmentName,
          professorId: professor.id,
          professorName: professor.name,
          totalStudents: totalStudentsForProfessor,
          submittedEvaluations: submittedCount,
          completionRate: Math.min(completionRate, 100), // Cap at 100%
        }
      })

      return stats
    } catch (error) {
      console.error("Error calculating stats:", error)
      return []
    }
  },

  async getTotalEvaluationCount(): Promise<number> {
    try {
      const { evaluationResultsService } = await import("./evaluation-results-service")
      const evaluationResults = await evaluationResultsService.getAll()

      // Count only submitted and complete evaluations
      // Check multiple possible values for evaluationStatus
      const submittedEvaluations = evaluationResults.filter((result) => {
        // Check evaluationStatus - can be "submitted", "complete", or other values
        const status = (result.evaluationStatus || "").toLowerCase().trim()
        const isSubmitted = status.includes("submit") || status === "complete" || status === "done"

        // Check isComplete flag - must be explicitly true
        const isComplete = result.isComplete === true

        // More lenient: accept if EITHER condition is met (not both)
        // This catches more evaluations that are actually complete
        return isSubmitted || isComplete
      })


      // Count UNIQUE students who have completed at least one evaluation
      // Each student should only be counted once, regardless of how many professors they evaluated
      const uniqueStudents = new Set<string>()
      let studentsWithSessionId = 0
      let studentsWithId = 0
      let studentsWithEmail = 0
      let studentsWithoutId = 0

      submittedEvaluations.forEach((result) => {
        // Priority 1: Use sessionId if available (most reliable for identifying unique students)
        // sessionId is stored in responses array and identifies a student's evaluation session
        // Same sessionId = same student, even if they evaluated multiple professors
        if (result.sessionId && result.sessionId.trim() !== "") {
          uniqueStudents.add(result.sessionId.trim())
          studentsWithSessionId++
        }
        // Priority 2: Use studentId if available
        else if (result.studentId && result.studentId.trim() !== "") {
          uniqueStudents.add(result.studentId.trim())
          studentsWithId++
        }
        // Priority 3: Use studentEmail if available
        else if (result.studentEmail && result.studentEmail.trim() !== "") {
          uniqueStudents.add(result.studentEmail.trim().toLowerCase())
          studentsWithEmail++
        }
        // Fallback: Always count the evaluation even without identifier
        // Use document ID to ensure each submitted evaluation is counted
        else {
          // Count each evaluation as unique based on document ID
          uniqueStudents.add(result.id)
          studentsWithoutId++
        }
      })

      const uniqueStudentCount = uniqueStudents.size

      // Warn if we don't have student identifiers
      if (studentsWithoutId === submittedEvaluations.length && submittedEvaluations.length > 0) {
        console.warn(`⚠️ No student identifiers found in evaluation results. Consider using sessionId, studentId, or studentEmail.`)
      }

      return uniqueStudentCount
    } catch (error) {
      console.warn("Error getting total evaluation count:", error)
      return 0
    }
  },

  async getDepartmentStats(): Promise<{
    [departmentId: string]: { name: string; totalRate: number; professorCount: number }
  }> {
    const stats = await this.calculateStats()
    const departmentStats: { [departmentId: string]: { name: string; totalRate: number; professorCount: number } } = {}

    stats.forEach((stat) => {
      if (!departmentStats[stat.departmentId]) {
        departmentStats[stat.departmentId] = {
          name: stat.departmentName,
          totalRate: 0,
          professorCount: 0,
        }
      }
      departmentStats[stat.departmentId].totalRate += stat.completionRate
      departmentStats[stat.departmentId].professorCount += 1
    })

    // Calculate average completion rate per department
    Object.keys(departmentStats).forEach((deptId) => {
      const dept = departmentStats[deptId]
      dept.totalRate = Math.round(dept.totalRate / dept.professorCount)
    })

    return departmentStats
  },

  // Calculate how many students have completed ALL their assigned evaluations
  // Uses the same Eval Progress logic as student-management.tsx
  async getFullCompletionCount(): Promise<{ completedStudents: number; totalStudentsWithAssignments: number }> {
    try {
      const { evaluationResultsService } = await import("./evaluation-results-service")

      const [students, professors, evaluationResults] = await Promise.all([
        studentService.getAll(),
        professorService.getAll(),
        evaluationResultsService.getAll()
      ])

      // Filter only submitted/complete evaluations
      const submittedResults = evaluationResults.filter(
        (result) => result.isComplete || result.evaluationStatus === 'submitted'
      )

      // Filter active professors only
      const activeProfessors = professors.filter(
        (prof) => prof.status !== 'resigned' && prof.status !== 'inactive'
      )

      let completedStudents = 0
      let totalStudentsWithAssignments = 0

      students.forEach((student: any) => {
        // Get student's enrolled subjects
        const studentSubjects: string[] = student.subjects && student.subjects.length > 0
          ? student.subjects
          : student.subject
            ? [student.subject]
            : []

        if (studentSubjects.length === 0) return

        const studentSection = student.section
        if (!studentSection) return

        // Find all professors assigned to this student (same logic as Eval Progress)
        const assignedEvaluations: { professorId: string; subject: string }[] = []

        activeProfessors.forEach((prof: any) => {
          const profSubjectSections = prof.subjectSections || []

          profSubjectSections.forEach((ss: any) => {
            const subjectMatch = studentSubjects.some(
              (s: string) => s.toLowerCase().trim() === ss.subject.toLowerCase().trim()
            )
            const sectionMatch = (ss.sections || []).some(
              (sec: string) => sec.toLowerCase().trim() === studentSection.toLowerCase().trim()
            )

            if (subjectMatch && sectionMatch) {
              assignedEvaluations.push({ professorId: prof.id, subject: ss.subject })
            }
          })
        })

        // Skip students with no assigned professors
        if (assignedEvaluations.length === 0) return

        totalStudentsWithAssignments++

        // Check if student completed ALL assigned evaluations
        const allComplete = assignedEvaluations.every(({ professorId }) => {
          return submittedResults.some((er) => {
            const emailMatch = er.studentEmail?.toLowerCase() === student.email?.toLowerCase()
            const profMatch = er.professorId === professorId
            return emailMatch && profMatch
          })
        })

        if (allComplete) {
          completedStudents++
        }
      })

      return { completedStudents, totalStudentsWithAssignments }
    } catch (error) {
      console.error("Error calculating full completion count:", error)
      return { completedStudents: 0, totalStudentsWithAssignments: 0 }
    }
  },
}

// Evaluation deadline operations
// Uses a single document with fixed ID "current" to store the deadline
const DEADLINE_DOC_ID = "current"

export const evaluationDeadlineService = {
  // Create or update the single deadline document
  async create(startDate: Date, endDate: Date, isActive: boolean = true): Promise<string> {
    try {
      console.log("🔵 Saving deadline to Firestore:", {
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        isActive,
        documentId: DEADLINE_DOC_ID,
      })

      const deadlineRef = doc(db, "evaluation_deadlines", DEADLINE_DOC_ID)

      // Check if document exists
      const deadlineDoc = await getDoc(deadlineRef)
      const exists = deadlineDoc.exists()

      console.log("🔵 Deadline document exists:", exists)

      // Convert dates to Firestore Timestamp
      const startTimestamp = Timestamp.fromDate(startDate)
      const endTimestamp = Timestamp.fromDate(endDate)

      const deadlineData = {
        startDate: startTimestamp,
        endDate: endTimestamp,
        isActive,
        updatedAt: Timestamp.now(),
        ...(exists ? {} : { createdAt: Timestamp.now() }),
      }

      console.log("🔵 Deadline data to save:", {
        startDate: startTimestamp.toDate().toISOString(),
        endDate: endTimestamp.toDate().toISOString(),
        isActive,
      })

      if (exists) {
        // Update existing document - Reset evaluation results for new evaluation period
        console.log("🔵 Updating existing deadline document...")
        console.log("🔄 Resetting evaluation results for new evaluation period...")

        // Reset all evaluation results when deadline is updated
        await this.resetEvaluationResults()

        await updateDoc(deadlineRef, deadlineData)
        console.log("✅ Deadline updated successfully and evaluation results reset")
      } else {
        // Create new document if it doesn't exist
        console.log("🔵 Creating new deadline document...")
        await setDoc(deadlineRef, deadlineData)
        console.log("✅ Deadline created successfully")
      }

      // Verify the save by reading it back immediately
      await new Promise(resolve => setTimeout(resolve, 100)) // Small delay to ensure write completes
      const verifyDoc = await getDoc(deadlineRef)
      if (verifyDoc.exists()) {
        const data = verifyDoc.data()
        const verifiedStart = data.startDate?.toDate?.()
        const verifiedEnd = data.endDate?.toDate?.()
        console.log("✅ Verified saved deadline:", {
          startDate: verifiedStart?.toISOString(),
          endDate: verifiedEnd?.toISOString(),
          isActive: data.isActive,
        })

        // Double-check that the dates match what we tried to save
        if (verifiedStart && verifiedEnd) {
          const startDiff = Math.abs(verifiedStart.getTime() - startDate.getTime())
          const endDiff = Math.abs(verifiedEnd.getTime() - endDate.getTime())
          if (startDiff > 1000 || endDiff > 1000) {
            console.warn("⚠️ Date mismatch detected (within 1 second tolerance)")
          }
        }
      } else {
        console.error("❌ Verification failed: Document does not exist after save")
        throw new Error("Failed to verify deadline was saved - document does not exist")
      }

      return DEADLINE_DOC_ID
    } catch (error) {
      console.error("❌ Error creating/updating evaluation deadline:", error)
      console.error("Error details:", {
        message: (error as any)?.message,
        code: (error as any)?.code,
        stack: (error as any)?.stack,
      })
      throw error
    }
  },

  async getAll(): Promise<EvaluationDeadline[]> {
    try {
      console.log("🔵 Fetching all deadlines from Firestore...")
      const deadlineRef = doc(db, "evaluation_deadlines", DEADLINE_DOC_ID)
      const deadlineDoc = await getDoc(deadlineRef)

      if (!deadlineDoc.exists()) {
        console.log("🔵 No deadline document found in getAll()")
        return []
      }

      const data = deadlineDoc.data()
      const deadline = {
        id: deadlineDoc.id,
        startDate: data.startDate?.toDate?.() || new Date(data.startDate),
        endDate: data.endDate?.toDate?.() || new Date(data.endDate),
        isActive: data.isActive ?? true,
        createdAt: data.createdAt?.toDate?.() || new Date(),
        updatedAt: data.updatedAt?.toDate?.() || new Date(),
      } as EvaluationDeadline

      console.log("✅ Fetched deadline in getAll():", {
        id: deadline.id,
        startDate: deadline.startDate.toISOString(),
        endDate: deadline.endDate.toISOString(),
        isActive: deadline.isActive,
      })

      return [deadline]
    } catch (error) {
      console.error("❌ Error fetching evaluation deadlines:", error)
      console.error("Error details:", {
        message: (error as any)?.message,
        code: (error as any)?.code,
      })
      return []
    }
  },

  async getActive(): Promise<EvaluationDeadline | null> {
    try {
      console.log("🔵 Fetching active deadline from Firestore...")
      const deadlineRef = doc(db, "evaluation_deadlines", DEADLINE_DOC_ID)
      const deadlineDoc = await getDoc(deadlineRef)

      if (!deadlineDoc.exists()) {
        console.log("🔵 No deadline document found")
        return null
      }

      const data = deadlineDoc.data()

      console.log("🔵 Deadline document data:", {
        isActive: data.isActive,
        startDate: data.startDate?.toDate?.()?.toISOString(),
        endDate: data.endDate?.toDate?.()?.toISOString(),
      })

      // Only return if isActive is true
      if (!data.isActive) {
        console.log("🔵 Deadline is not active")
        return null
      }

      const deadline = {
        id: deadlineDoc.id,
        startDate: data.startDate?.toDate?.() || new Date(data.startDate),
        endDate: data.endDate?.toDate?.() || new Date(data.endDate),
        isActive: data.isActive ?? true,
        createdAt: data.createdAt?.toDate?.() || new Date(),
        updatedAt: data.updatedAt?.toDate?.() || new Date(),
      } as EvaluationDeadline

      console.log("✅ Active deadline found:", {
        id: deadline.id,
        startDate: deadline.startDate.toISOString(),
        endDate: deadline.endDate.toISOString(),
        isActive: deadline.isActive,
      })

      return deadline
    } catch (error) {
      console.error("❌ Error fetching active evaluation deadline:", error)
      console.error("Error details:", {
        message: (error as any)?.message,
        code: (error as any)?.code,
      })
      return null
    }
  },

  async update(id: string, startDate: Date, endDate: Date, isActive: boolean): Promise<void> {
    try {
      console.log("🔵 Updating deadline via update method:", {
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        isActive,
      })
      // Always update the single document (ignore id parameter, use DEADLINE_DOC_ID)
      const deadlineRef = doc(db, "evaluation_deadlines", DEADLINE_DOC_ID)
      await updateDoc(deadlineRef, {
        startDate: Timestamp.fromDate(startDate),
        endDate: Timestamp.fromDate(endDate),
        isActive,
        updatedAt: Timestamp.now(),
      })
      console.log("✅ Deadline updated via update method")
    } catch (error) {
      console.error("❌ Error updating deadline:", error)
      throw error
    }
  },

  async deactivateAll(): Promise<void> {
    try {
      // Just deactivate the single document
      const deadlineRef = doc(db, "evaluation_deadlines", DEADLINE_DOC_ID)
      const deadlineDoc = await getDoc(deadlineRef)

      if (deadlineDoc.exists()) {
        await updateDoc(deadlineRef, {
          isActive: false,
          updatedAt: Timestamp.now(),
        })
      }
    } catch (error) {
      console.error("Error deactivating deadline:", error)
      throw error
    }
  },

  async delete(id: string): Promise<void> {
    // Delete the single document
    const deadlineRef = doc(db, "evaluation_deadlines", DEADLINE_DOC_ID)
    await deleteDoc(deadlineRef)
  },

  // Reset all evaluation results when a new evaluation period starts
  async resetEvaluationResults(): Promise<void> {
    try {
      console.log("🔄 Starting evaluation results reset...")

      // Get all evaluation results
      const resultsSnapshot = await getDocs(collection(db, "evaluation_results"))
      const batchSize = 500 // Firestore batch limit
      const results = resultsSnapshot.docs

      console.log(`🔄 Found ${results.length} evaluation results to delete`)

      if (results.length === 0) {
        console.log("✅ No evaluation results to reset")
        return
      }

      // Delete in batches
      for (let i = 0; i < results.length; i += batchSize) {
        const batch = writeBatch(db)
        const batchDocs = results.slice(i, i + batchSize)

        batchDocs.forEach((doc) => {
          batch.delete(doc.ref)
        })

        await batch.commit()
        console.log(`🔄 Deleted batch ${Math.floor(i / batchSize) + 1} (${batchDocs.length} documents)`)
      }

      console.log(`✅ Successfully reset ${results.length} evaluation results`)
    } catch (error) {
      console.error("❌ Error resetting evaluation results:", error)
      throw error
    }
  },

  // Check if current date is within evaluation period
  async isEvaluationOpen(): Promise<boolean> {
    try {
      const activeDeadline = await this.getActive()
      if (!activeDeadline) return false

      const now = new Date()
      return now >= activeDeadline.startDate && now <= activeDeadline.endDate
    } catch (error) {
      console.error("Error checking if evaluation is open:", error)
      return false
    }
  },
}
