/*
 * TYPE DEFINITIONS - Ito ang lahat ng data types na ginagamit sa system
 * 
 * SIMPLE EXPLANATION:
 * 1. Dito naka-define ang lahat ng data structures na ginagamit sa app
 * 2. Para sa TypeScript - para ma-validate ang data types
 * 3. Lahat ng interfaces ay may specific na properties
 * 4. Ginagamit sa buong application para sa type safety
 * 
 * MGA FEATURES:
 * - Department management types
 * - Professor management types
 * - Evaluation system types
 * - Statistics and analytics types
 * - Post management types
 */

// STEP 1: Department interface - para sa department data
export interface Department {
  id: string // Unique ID ng department
  name: string // Pangalan ng department
  imageUrl?: string // URL ng uploaded image (optional)
  createdAt: Date // Kailan ginawa
  updatedAt: Date // Kailan na-update
}

// STEP 2: Professor interface - para sa professor data
export interface Professor {
  id: string // Unique ID ng professor
  name: string // Pangalan ng professor
  email: string // Email address ng professor
  password?: string // Password (optional para sa security - hindi naka-show sa UI)
  departmentId: string // ID ng department na kinabibilangan
  departmentName: string // Pangalan ng department
  status?: "active" | "inactive" // Status ng professor (active o inactive)
  createdAt: Date // Kailan ginawa
  updatedAt: Date // Kailan na-update
}

// STEP 3: EvaluationSubmission interface - para sa evaluation submissions
export interface EvaluationSubmission {
  id: string // Unique ID ng submission
  professorId: string // ID ng professor na na-evaluate
  professorName: string // Pangalan ng professor
  departmentId: string // ID ng department
  departmentName: string // Pangalan ng department
  studentId: string // ID ng student na nag-submit
  LikertScale: {
    teaching_effectiveness: number // Rating para sa teaching effectiveness (1-5)
    course_organization: number // Rating para sa course organization (1-5)
    communication: number // Rating para sa communication (1-5)
    availability: number // Rating para sa availability (1-5)
    overall_satisfaction: number // Overall satisfaction rating (1-5)
  }
  comments?: string // Optional comments mula sa student
  submittedAt: Date // Kailan na-submit
}

// STEP 4: EvaluationStats interface - para sa evaluation statistics
export interface EvaluationStats {
  departmentId: string // ID ng department
  departmentName: string // Pangalan ng department
  professorId: string // ID ng professor
  professorName: string // Pangalan ng professor
  totalStudents: number // Total number ng students
  submittedEvaluations: number // Number ng submitted evaluations
  completionRate: number // Completion rate percentage (0-100)
}

// STEP 5: AdminUser interface - para sa admin users
export interface AdminUser {
  uid: string // Unique ID ng admin user
  email: string // Email address ng admin
  role: "admin" // Role ng user (admin lang)
  createdAt: Date // Kailan ginawa ang account
}

// STEP 6: EvaluationQuestion interface - para sa evaluation questions
export interface EvaluationQuestion {
  id: string // Unique ID ng question
  teacherId: string // ID ng teacher na gumawa ng question
  teacherName: string // Pangalan ng teacher
  teacherEmail?: string // Email ng teacher (optional)
  questionText: string // Text ng question
  questionType: "Likert Scale" | "text" // Type ng question
  options?: string[] // Options para sa multiple choice questions
  isActive: boolean // Kung active ba ang question
  section?: string // Section/category ng question (e.g., "Instructional Competence")
  weight?: string // Weight/importance ng question (e.g., "40%")
  createdAt: Date // Kailan ginawa
  updatedAt: Date // Kailan na-update
}

// STEP 6.1: Excel parsing types
export type ExcelRowData = {
  [key: string]: string | number | boolean | null | undefined // Cell data
}

export type ExcelSheetData = {
  sheetName: string
  data: ExcelRowData[]
  headers: string[]
}


// STEP 6.2: Evaluation sections with weights
export type EvaluationSection = {
  name: string
  weight: string
  questions: ParsedQuestion[]
}

export type EvaluationSectionWeights = {
  InstructionalCompetenceWeight: string
  ClassroomManagementWeight: string
  ProfessionalismandPersonalQualitiesWeight: string
  StudentSupportandDevelopmentWeight: string
  ResearchWeight: string
}

// STEP 6.3: Updated parsed question type for Excel parsing
export type ParsedQuestion = {
  questionText: string
  filipinoTranslation?: string
  questionNumber?: number
  section?: string
  weight?: string
  rowIndex?: number
  sheetName?: string
  professorEmail?: string
  professorName?: string
}

export type ExcelQuestionParseResult = {
  totalQuestions: number
  sections: EvaluationSection[]
  questions: ParsedQuestion[]
  rawData: {
    sheets: ExcelSheetData[]
    totalSheets: number
    totalRows: number
  }
}

// STEP 7: EvaluationResponse interface - para sa evaluation responses
export interface EvaluationResponse {
  id: string // Unique ID ng response
  questionId: string // ID ng question na sinasagot
  studentId: string // ID ng student na sumagot
  teacherId: string // ID ng teacher na may question
  response: string | number // Sagot ng student (string o number)
  submittedAt: Date // Kailan na-submit ang response
}

// STEP 8: Post interface - para sa posts/announcements
export interface Post {
  id: string // Unique ID ng post
  teacherId: string // ID ng teacher na gumawa ng post
  teacherName: string // Pangalan ng teacher
  title: string // Title ng post
  description?: string // Optional description ng post
  createdAt: Date // Kailan ginawa
  updatedAt: Date // Kailan na-update
}

// STEP 9: EvaluationResult interface - para sa evaluation results
export interface EvaluationResult {
  id: string // Unique ID ng result
  departmentName: string // Pangalan ng department
  evaluationStatus: "submitted" | "pending" | "in_progress" // Status ng evaluation
  isComplete: boolean // Kung complete na ba ang evaluation
  professorEmail: string // Email ng professor
  professorId: string // ID ng professor
  professorName: string // Pangalan ng professor
  studentEmail?: string // Email ng student (optional - para sa unique student counting)
  studentId?: string // ID ng student (optional - para sa unique student counting)
  sessionId?: string // Session ID ng student (from responses array - para sa unique student counting)
  responses: EvaluationResultResponse[] // Array ng responses
  submittedAt?: Date // Kailan na-submit (optional)
  createdAt: Date // Kailan ginawa
}

// STEP 10: EvaluationResultResponse interface - para sa individual responses
export interface EvaluationResultResponse {
  answer: string // Sagot ng student
  options: string[] // Available options para sa question
  questionId: string // ID ng question
  questionText: string // Text ng question
  questionType: "Likert Scale" | "text" // Type ng question
  sessionId?: string // Session ID ng student (optional - para sa unique student identification)
}

// STEP 11: EvaluationResultStats interface - para sa evaluation statistics
export interface EvaluationResultStats {
  departmentName: string // Pangalan ng department
  totalEvaluations: number // Total number ng evaluations
  completedEvaluations: number // Number ng completed evaluations
  pendingEvaluations: number // Number ng pending evaluations
  completionRate: number // Completion rate percentage (0-100)
  professorCount: number // Number ng professors
  averageResponsesPerEvaluation: number // Average responses per evaluation
}

// STEP 12: EvaluationDeadline interface - para sa evaluation deadline
export interface EvaluationDeadline {
  id: string // Unique ID ng deadline
  startDate: Date // Kailan magsisimula ang evaluation period
  endDate: Date // Kailan matatapos ang evaluation period (deadline)
  isActive: boolean // Kung active ba ang deadline
  createdAt: Date // Kailan ginawa
  updatedAt: Date // Kailan na-update
}
