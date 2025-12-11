// Excel Parser for Teacher Evaluation System
// This file contains functions to parse Excel files and extract evaluation questions

import * as XLSX from 'xlsx'

// STEP 1: Types para sa parsed data
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

export type ExcelSheetData = {
  sheetName: string
  data: { [key: string]: string | number | boolean | null | undefined }[]
  headers: string[]
}

export type ExcelParseResult = {
  sheets: ExcelSheetData[]
  totalSheets: number
  totalRows: number
}

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

export type ExcelQuestionParseResult = {
  totalQuestions: number
  sections: EvaluationSection[]
  questions: ParsedQuestion[]
  rawData: ExcelParseResult
}

// STEP 2: Function para mag-read ng Excel file
export async function readExcelFile(file: File): Promise<ExcelParseResult> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()

    reader.onload = (e) => {
      try {
        const arrayBuffer = e.target?.result as ArrayBuffer
        const workbook = XLSX.read(arrayBuffer, { type: 'array' })
        const sheets: ExcelSheetData[] = []
        let totalRows = 0

        // Process each sheet
        workbook.SheetNames.forEach((sheetName) => {
          const worksheet = workbook.Sheets[sheetName]
          const jsonData = XLSX.utils.sheet_to_json(worksheet, {
            header: 1,
            defval: null,
            blankrows: false
          }) as any[][]

          // Extract headers from first row
          const headers: string[] = []
          if (jsonData.length > 0) {
            jsonData[0].forEach((header, index) => {
              headers.push(header?.toString() || `Column_${index + 1}`)
            })
          }

          // Convert to object format
          const data = jsonData.slice(1).map((row, rowIndex) => {
            const rowData: { [key: string]: string | number | boolean | null | undefined } = {}
            headers.forEach((header, colIndex) => {
              rowData[header] = row[colIndex] || null
            })
            return rowData
          })

          sheets.push({
            sheetName,
            data,
            headers
          })

          totalRows += data.length
        })

        resolve({
          sheets,
          totalSheets: workbook.SheetNames.length,
          totalRows
        })
      } catch (error) {
        reject(new Error('Failed to parse Excel file: ' + (error as Error).message))
      }
    }

    reader.onerror = () => {
      reject(new Error('Failed to read Excel file'))
    }

    reader.readAsArrayBuffer(file)
  })
}

// STEP 3: Function para mag-parse ng questions mula sa Excel data
export function parseQuestionsFromExcel(excelData: ExcelParseResult): ExcelQuestionParseResult {
  const questions: ParsedQuestion[] = []
  const sections: EvaluationSection[] = []
  
  let questionNumber = 0

  // Process each sheet
  excelData.sheets.forEach((sheet) => {
    console.log(`Processing sheet: ${sheet.sheetName}`)

    // Look for section columns (columns that contain section names with percentages)
    // We specifically look for the 5 evaluation sections
    let sectionColumns = sheet.headers.filter(header => {
      const headerText = header.toString()
      // Match exact section headers with percentages
      return (
        headerText.includes('Instructional Competence') ||
        headerText.includes('Classroom Management') ||
        headerText.includes('Professionalism') ||
        headerText.includes('Student Support') ||
        headerText.includes('Research')
      ) && (
        headerText.includes('40%') ||
        headerText.includes('20%') ||
        headerText.includes('10%') ||
        headerText.includes('%')
      )
    })

    console.log(`Section columns found (exact match):`, sectionColumns)

    // If no section columns found with exact match, try to detect by percentage patterns
    if (sectionColumns.length === 0) {
      const percentageColumns = sheet.headers.filter(header => {
        const headerText = header.toString()
        return headerText.includes('%') && (headerText.includes('(') && headerText.includes(')'))
      })
      sectionColumns.push(...percentageColumns)
      console.log(`Found columns with percentage pattern:`, sectionColumns)
    }

    // If still no section columns, try with more lenient matching
    if (sectionColumns.length === 0) {
      const lenientColumns = sheet.headers.filter(header => {
        const headerText = header.toString().toLowerCase()
        return (
          headerText.includes('competence') ||
          headerText.includes('management') ||
          headerText.includes('professionalism') ||
          headerText.includes('support') ||
          headerText.includes('research') ||
          headerText.includes('instructional') ||
          headerText.includes('classroom') ||
          headerText.includes('student')
        ) && headerText.includes('%')
      })
      sectionColumns.push(...lenientColumns)
      console.log(`Found columns with lenient matching:`, sectionColumns)
    }

    // AGGRESSIVE MODE: If still no section columns found, read ALL columns that have data
    // This ensures we don't miss any questions even if section headers don't match
    if (sectionColumns.length === 0) {
      console.log(`⚠️ No section columns detected. Reading ALL columns with data...`)
      // Get all columns that have at least one non-empty cell
      const allColumnsWithData = sheet.headers.filter(header => {
        // Check if this column has any non-empty data
        const hasData = sheet.data.some(row => {
          const cellValue = row[header]
          if (cellValue === null || cellValue === undefined) return false
          const text = String(cellValue).trim()
          return text.length > 0 && text.length >= 5 // At least 5 characters
        })
        return hasData
      })
      sectionColumns = allColumnsWithData
      console.log(`📖 Reading ${sectionColumns.length} columns with data:`, sectionColumns)
    }

    console.log(`Final columns to process: ${sectionColumns.length} columns`)

    // Process each section column
    sectionColumns.forEach(columnName => {
      const columnHeader = columnName.toString()
      
      // Extract section name and weight from column header
      let sectionName = columnHeader
      let sectionWeight = '0%'
      
      // Extract weight from header (e.g., "Instructional Competence (40%)" -> "40%")
      const weightMatch = columnHeader.match(/\((\d+%)\)/)
      if (weightMatch) {
        sectionWeight = weightMatch[1]
        sectionName = columnHeader.replace(/\s*\(\d+%\)\s*$/, '').trim()
      } else {
        // Try to extract weight from anywhere in the header
        const anyWeightMatch = columnHeader.match(/(\d+)%/)
        if (anyWeightMatch) {
          sectionWeight = anyWeightMatch[1] + '%'
        }
        // If no section name detected, use column letter/index as fallback
        if (!sectionName || sectionName.length < 3) {
          sectionName = `Column ${columnName}`
        }
      }

      console.log(`Processing column: "${sectionName}" with weight: ${sectionWeight}`)

      // Process each row in this column
      sheet.data.forEach((row, rowIndex) => {
        const cellValue = row[columnName]
        
        // More lenient check - accept any non-empty value
        if (cellValue !== null && cellValue !== undefined) {
          const questionText = String(cellValue).trim()
          
          // Skip empty strings
          if (questionText.length === 0) {
            return
          }
          
          const lowerText = questionText.toLowerCase().trim()

          // Skip only if it's clearly a header or non-question content (exact matches or very short)
          // Be more lenient - only skip if the entire text matches these patterns
          const isHeader = (
              // Exact matches for headers
              lowerText === 'section' ||
              lowerText === 'part' ||
              lowerText === 'category' ||
              lowerText === 'weight' ||
              lowerText === 'evaluation' ||
              lowerText === 'criteria' ||
              lowerText === 'assessment' ||
              lowerText === 'rating scale' ||
              lowerText === 'scale' ||
              // Very short text that's likely a header
              (lowerText.length < 15 && (
                lowerText.startsWith('section') ||
                lowerText.startsWith('part') ||
                lowerText.startsWith('category') ||
                lowerText.startsWith('weight:') ||
                lowerText === 'evaluation criteria' ||
                lowerText === 'rating scale'
              )) ||
              // Single letter items (like "A.", "B.", etc.)
              lowerText.match(/^[a-z]\s*[\.\)]\s*$/)
          )

          // Only skip Likert scale options if they're exact matches (not if they appear in question text)
          const isLikertScale = (
              lowerText === 'strongly agree' ||
              lowerText === 'strongly disagree' ||
              lowerText === 'agree' ||
              lowerText === 'disagree' ||
              lowerText === 'undecided' ||
              lowerText === 'neutral'
          )

          // Skip only if it's a header or Likert scale options
          if (isHeader || isLikertScale) {
            console.log(`Row ${rowIndex + 2}: Skipping - ${isHeader ? 'header' : 'Likert scale'}: "${questionText}"`)
            return
          }

          // Keep the complete text including Filipino translation
          const completeQuestionText = questionText.trim()

          // More lenient minimum length - accept questions as short as 5 characters
          // But prefer longer questions (at least 10 chars for better quality)
          if (completeQuestionText.length >= 5) {
            questionNumber++

            const question: ParsedQuestion = {
              questionText: completeQuestionText,
              questionNumber,
              section: sectionName,
              weight: sectionWeight,
              rowIndex: rowIndex + 2,
              sheetName: sheet.sheetName,
              filipinoTranslation: undefined,
              professorEmail: undefined,
              professorName: undefined
            }

            questions.push(question)
            console.log(`Row ${rowIndex + 2}: Added question ${questionNumber} (${sectionName}): "${completeQuestionText.substring(0, 80)}${completeQuestionText.length > 80 ? '...' : ''}"`)
          } else {
            console.log(`Row ${rowIndex + 2}: Skipping - too short (${completeQuestionText.length} chars): "${questionText}"`)
          }
        }
      })
    })
  })

  // Group questions by section
  const questionsBySection = questions.reduce((acc, question) => {
    const section = question.section || 'Unknown'
    if (!acc[section]) {
      acc[section] = []
    }
    acc[section].push(question)
    return acc
  }, {} as Record<string, ParsedQuestion[]>)

  // Create sections array
  Object.entries(questionsBySection).forEach(([sectionName, sectionQuestions]) => {
    const weight = sectionQuestions[0]?.weight || '0%'
    sections.push({
      name: sectionName,
      weight,
      questions: sectionQuestions
    })
  })

  // Add some debugging information
  console.log('Excel Parse Debug Info:')
  console.log('- Total sheets processed:', excelData.totalSheets)
  console.log('- Total rows processed:', excelData.totalRows)
  console.log('- Questions found:', questions.length)
  console.log('- Sections found:', sections.length)
  console.log('- Sections detected:', sections.map(s => s.name))

  // Add detailed per-section summary
  sections.forEach(section => {
    console.log(`\n📋 Section: ${section.name} (${section.weight})`)
    console.log(`   Questions found: ${section.questions.length}`)
    section.questions.forEach((q, idx) => {
      console.log(`   ${idx + 1}. Row ${q.rowIndex}: ${q.questionText.substring(0, 80)}${q.questionText.length > 80 ? '...' : ''}`)
    })
  })
  
  // Log total count for verification
  console.log(`\n✅ TOTAL QUESTIONS PARSED: ${questions.length}`)
  console.log(`📊 Breakdown by section:`)
  sections.forEach(section => {
    console.log(`   - ${section.name}: ${section.questions.length} questions`)
  })

  if (questions.length === 0) {
    console.log('No questions found. Sample data from Excel:')
    excelData.sheets.forEach(sheet => {
      console.log(`Sheet: ${sheet.sheetName}`)
      console.log('Headers:', sheet.headers)
      if (sheet.data.length > 0) {
        console.log('First few rows:', sheet.data.slice(0, 3))
      }
    })
  } else {
    console.log('Sample questions found:')
    questions.slice(0, 5).forEach((question, index) => {
      console.log(`${index + 1}: "${question.questionText.substring(0, 50)}..." (Section: ${question.section}, Sheet: ${question.sheetName})`)
    })

    console.log('Questions by section:')
    sections.forEach(section => {
      console.log(`- ${section.name} (${section.weight}): ${section.questions.length} questions`)
      section.questions.slice(0, 3).forEach((q, i) => {
        console.log(`  ${i + 1}. ${q.questionText.substring(0, 50)}...`)
      })
    })
  }

  return {
    questions,
    sections,
    totalQuestions: questions.length,
    rawData: excelData,
  }
}

// STEP 4: Function para mag-validate ng parsed questions
export function validateParsedQuestions(questions: ParsedQuestion[]): {
  valid: ParsedQuestion[]
  invalid: ParsedQuestion[]
} {
  const valid: ParsedQuestion[] = []
  const invalid: ParsedQuestion[] = []

  for (const question of questions) {
    const questionText = question.questionText.trim()
    const lowerText = questionText.toLowerCase()
    
    // More lenient validation - only exclude obvious non-questions
    // Check if it's a valid question (not just a header or scale option)
    const isTooShort = questionText.length < 5
    
    // Only exclude if the entire text matches these patterns (not if it just contains them)
    const isExactHeader = (
      lowerText === 'section' ||
      lowerText === 'part' ||
      lowerText === 'category' ||
      lowerText === 'weight' ||
      lowerText === 'evaluation' ||
      lowerText === 'criteria' ||
      lowerText === 'assessment' ||
      lowerText === 'rating scale' ||
      lowerText === 'scale' ||
      // Very short text that's likely just a header
      (questionText.length < 15 && (
        lowerText.startsWith('section') ||
        lowerText.startsWith('part') ||
        lowerText.startsWith('category') ||
        lowerText.startsWith('weight:') ||
        lowerText === 'evaluation criteria' ||
        lowerText === 'rating scale'
      ))
    )
    
    // Only exclude if it's an exact Likert scale option (not if it contains the word)
    const isExactLikertOption = (
      lowerText === 'strongly agree' ||
      lowerText === 'strongly disagree' ||
      lowerText === 'agree' ||
      lowerText === 'disagree' ||
      lowerText === 'undecided' ||
      lowerText === 'neutral'
    )
    
    // Exclude if it's just a percentage or weight indicator
    const isJustPercentage = /^[\d\s%()]+$/.test(questionText.trim())
    
    // Exclude if it's just a single letter or number
    const isJustSingleItem = /^[a-z0-9]\s*[\.\)]\s*$/i.test(questionText.trim())
    
    const isValidQuestion = questionText && 
      !isTooShort &&
      !isExactHeader &&
      !isExactLikertOption &&
      !isJustPercentage &&
      !isJustSingleItem

    if (isValidQuestion) {
      valid.push(question)
    } else {
      invalid.push(question)
      console.log(`Invalid question filtered out: "${question.questionText}"`)
    }
  }

  console.log(`Validation complete: ${valid.length} valid questions, ${invalid.length} invalid questions`)
  return { valid, invalid }
}

// STEP 5: Function para mag-convert ng parsed questions to database format
export function convertToDatabaseFormat(questions: ParsedQuestion[], professors: any[] = []): any[] {
  return questions.map(question => {
    // Find professor by email or name if specified in the question
    let teacherId = ''
    let teacherName = ''
    let teacherEmail = ''

    if (question.professorEmail) {
      const professor = professors.find(p =>
        p.email?.toLowerCase() === question.professorEmail?.toLowerCase()
      )
      if (professor) {
        teacherId = professor.id
        teacherName = professor.name
        teacherEmail = professor.email
      } else {
        // If professor not found, use the data from Excel
        teacherEmail = question.professorEmail
        teacherName = question.professorName || 'Unknown Professor'
      }
    }

    return {
      teacherId,
      teacherName,
      teacherEmail,
      questionText: question.questionText,
      questionType: "Likert Scale",
      isActive: true,
      options: ["Strongly Agree", "Agree", "Disagree", "Strongly Disagree"], // Default options
      section: question.section,
      weight: question.weight,
    }
  })
}

// STEP 6: Main function para mag-parse ng Excel at mag-extract ng questions
export async function parseExcelQuestions(file: File): Promise<ExcelQuestionParseResult> {
  try {
    // Extract data from Excel
    const excelData = await readExcelFile(file)

    // Log extracted data for debugging
    console.log('=== EXCEL EXTRACTION DEBUG ===')
    console.log('Total sheets:', excelData.totalSheets)
    console.log('Total rows:', excelData.totalRows)

    excelData.sheets.forEach(sheet => {
      console.log(`Sheet "${sheet.sheetName}":`)
      console.log('- Headers:', sheet.headers)
      console.log('- Data rows:', sheet.data.length)
      if (sheet.data.length > 0) {
        console.log('- Sample row:', sheet.data[0])
      }
    })

    // Check for question-related headers
    const allHeaders = excelData.sheets.flatMap(sheet => sheet.headers)
    const uniqueHeaders = [...new Set(allHeaders)]

    console.log('=== HEADER ANALYSIS ===')
    console.log('All headers found:', uniqueHeaders)

    const questionHeaders = uniqueHeaders.filter(header =>
      header.toLowerCase().includes('question') ||
      header.toLowerCase().includes('item') ||
      header.toLowerCase().includes('criteria')
    )

    console.log('Potential question headers:', questionHeaders)

    // Parse questions from Excel data
    const result = parseQuestionsFromExcel(excelData)

    // Validate parsed questions
    const validation = validateParsedQuestions(result.questions)

    return {
      questions: validation.valid,
      sections: result.sections,
      totalQuestions: validation.valid.length,
      rawData: excelData,
    }
  } catch (error) {
    console.error('Excel parsing error:', error)
    throw new Error(`Failed to parse Excel: ${(error as Error).message}`)
  }
}

// STEP 7: Debug function para mag-test ng Excel parsing
export function debugParseExcel(excelData: ExcelParseResult): ExcelQuestionParseResult {
  console.log('Debug: Parsing Excel data...')
  console.log('Total sheets:', excelData.totalSheets)
  console.log('Total rows:', excelData.totalRows)

  excelData.sheets.forEach(sheet => {
    console.log(`Sheet "${sheet.sheetName}":`)
    console.log('- Headers:', sheet.headers)
    console.log('- Rows:', sheet.data.length)
  })

  const result = parseQuestionsFromExcel(excelData)

  console.log('Debug: Parse result:')
  console.log('- Questions:', result.questions.length)
  console.log('- Sections:', result.sections.length)

  if (result.questions.length > 0) {
    console.log('Sample question:', result.questions[0])
  }

  return result
}

// STEP 8: Types and functions for parsing students from Excel
export type ParsedStudent = {
  name: string
  firstName: string
  lastName: string
  suffix: string
  section: string
  yearLevel: string
  enrolledCourse: string
  enrolledSubject: string
  email: string
  password: string
  status: string // Regular or Irregular
  rowIndex?: number
}

export type ExcelStudentParseResult = {
  students: ParsedStudent[]
  totalStudents: number
  errors: string[]
}

// Function to split full name into firstName, lastName, and suffix
function splitName(fullName: string): { firstName: string; lastName: string; suffix: string } {
  const nameParts = fullName.trim().split(/\s+/)
  
  if (nameParts.length === 0) {
    return { firstName: '', lastName: '', suffix: '' }
  }
  
  if (nameParts.length === 1) {
    return { firstName: nameParts[0], lastName: '', suffix: '' }
  }
  
  // Check for common suffixes
  const suffixes = ['Jr', 'Sr', 'II', 'III', 'IV', 'Jr.', 'Sr.']
  const lastPart = nameParts[nameParts.length - 1]
  const hasSuffix = suffixes.some(suffix => 
    lastPart.toLowerCase() === suffix.toLowerCase() || 
    lastPart.toLowerCase() === suffix.toLowerCase() + '.'
  )
  
  if (hasSuffix && nameParts.length >= 3) {
    const suffix = nameParts[nameParts.length - 1]
    const lastName = nameParts[nameParts.length - 2]
    const firstName = nameParts.slice(0, -2).join(' ')
    return { firstName, lastName, suffix }
  } else {
    const lastName = nameParts[nameParts.length - 1]
    const firstName = nameParts.slice(0, -1).join(' ')
    return { firstName, lastName, suffix: '' }
  }
}

// Function to parse students from Excel data
export function parseStudentsFromExcel(excelData: ExcelParseResult): ExcelStudentParseResult {
  const students: ParsedStudent[] = []
  const errors: string[] = []
  
  // Process each sheet
  excelData.sheets.forEach((sheet) => {
    console.log(`Processing sheet: ${sheet.sheetName} for students`)
    
    // Find column indices by header name (case-insensitive)
    const findColumnIndex = (headerName: string): number => {
      return sheet.headers.findIndex(header => 
        header?.toString().toLowerCase().trim() === headerName.toLowerCase().trim()
      )
    }
    
    // Map Excel columns to our data structure
    const nameCol = findColumnIndex('NAME')
    const sectionCol = findColumnIndex('SECTION')
    const yearCol = findColumnIndex('YEAR')
    const courseCol = findColumnIndex('ENROLLED COURSE')
    const subjectCol = findColumnIndex('ENROLLED SUBJECT')
    const emailCol = findColumnIndex('GMAIL')
    const passwordCol = findColumnIndex('PASSWORD')
    const statusCol = findColumnIndex('REGULAR OR IRREGULAR')
    
    // Check if required columns are found
    if (nameCol === -1 || emailCol === -1) {
      errors.push(`Sheet "${sheet.sheetName}": Missing required columns (NAME or GMAIL)`)
      return
    }
    
    // Process each row
    sheet.data.forEach((row, rowIndex) => {
      try {
        const name = row[sheet.headers[nameCol]]?.toString().trim() || ''
        const email = row[sheet.headers[emailCol]]?.toString().trim() || ''
        
        // Skip empty rows
        if (!name && !email) {
          return
        }
        
        // Validate required fields
        if (!name) {
          errors.push(`Row ${rowIndex + 2}: Missing name`)
          return
        }
        
        if (!email) {
          errors.push(`Row ${rowIndex + 2}: Missing email`)
          return
        }
        
        // Validate email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
        if (!emailRegex.test(email)) {
          errors.push(`Row ${rowIndex + 2}: Invalid email format: ${email}`)
          return
        }
        
        // Split name into firstName, lastName, suffix
        const { firstName, lastName, suffix } = splitName(name)
        
        // Extract other fields
        const section = sectionCol !== -1 ? (row[sheet.headers[sectionCol]]?.toString().trim() || '') : ''
        const yearLevel = yearCol !== -1 ? (row[sheet.headers[yearCol]]?.toString().trim() || '') : ''
        const enrolledCourse = courseCol !== -1 ? (row[sheet.headers[courseCol]]?.toString().trim() || '') : ''
        const enrolledSubject = subjectCol !== -1 ? (row[sheet.headers[subjectCol]]?.toString().trim() || '') : ''
        const password = passwordCol !== -1 ? (row[sheet.headers[passwordCol]]?.toString().trim() || '') : ''
        const status = statusCol !== -1 ? (row[sheet.headers[statusCol]]?.toString().trim() || 'Regular') : 'Regular'
        
        // Generate studentId from email if not provided (use email prefix)
        const studentId = email.split('@')[0] || `STU-${rowIndex + 1}`
        
        const student: ParsedStudent = {
          name,
          firstName,
          lastName,
          suffix,
          section,
          yearLevel,
          enrolledCourse,
          enrolledSubject,
          email,
          password: password || 'Stud@1234', // Default password if not provided
          status: status || 'Regular',
          rowIndex: rowIndex + 2, // +2 because Excel rows are 1-indexed and we skip header
        }
        
        students.push(student)
      } catch (error) {
        errors.push(`Row ${rowIndex + 2}: Error parsing row - ${(error as Error).message}`)
      }
    })
  })
  
  console.log(`Parsed ${students.length} students from Excel`)
  if (errors.length > 0) {
    console.warn(`Found ${errors.length} errors during parsing:`, errors)
  }
  
  return {
    students,
    totalStudents: students.length,
    errors,
  }
}

// Main function to parse Excel and extract students
export async function parseExcelStudents(file: File): Promise<ExcelStudentParseResult> {
  try {
    // Extract data from Excel
    const excelData = await readExcelFile(file)
    
    // Parse students from Excel data
    const result = parseStudentsFromExcel(excelData)
    
    return result
  } catch (error) {
    console.error('Excel parsing error:', error)
    throw new Error(`Failed to parse Excel: ${(error as Error).message}`)
  }
}

// STEP 9: Types and functions for parsing professors from Excel
export type ParsedProfessor = {
  name: string
  department: string
  subject: string
  handledSection: string
  email: string
  password: string
  rowIndex?: number
}

export type ExcelProfessorParseResult = {
  professors: ParsedProfessor[]
  totalProfessors: number
  errors: string[]
  professorsBySection: { [section: string]: ParsedProfessor[] }
}

// Function to parse professors from Excel data
export function parseProfessorsFromExcel(excelData: ExcelParseResult): ExcelProfessorParseResult {
  const professors: ParsedProfessor[] = []
  const errors: string[] = []
  const professorsBySection: { [section: string]: ParsedProfessor[] } = {}
  
  // Process each sheet
  excelData.sheets.forEach((sheet) => {
    console.log(`Processing sheet: ${sheet.sheetName} for professors`)
    
    // Find column indices by header name (case-insensitive)
    const findColumnIndex = (headerName: string): number => {
      return sheet.headers.findIndex(header => 
        header?.toString().toLowerCase().trim() === headerName.toLowerCase().trim()
      )
    }
    
    // Map Excel columns to our data structure
    const nameCol = findColumnIndex('NAME')
    const departmentCol = findColumnIndex('DEPARTMENT')
    const subjectCol = findColumnIndex('SUBJECTS')
    const sectionCol = findColumnIndex('HANDLED SECTION')
    const emailCol = findColumnIndex('GMAIL')
    const passwordCol = findColumnIndex('PASSWORD')
    
    // Check if required columns are found
    if (nameCol === -1 || emailCol === -1 || departmentCol === -1) {
      errors.push(`Sheet "${sheet.sheetName}": Missing required columns (NAME, DEPARTMENT, or GMAIL)`)
      return
    }
    
    // Process each row
    sheet.data.forEach((row, rowIndex) => {
      try {
        const name = row[sheet.headers[nameCol]]?.toString().trim() || ''
        const email = row[sheet.headers[emailCol]]?.toString().trim() || ''
        const department = row[sheet.headers[departmentCol]]?.toString().trim() || ''
        
        // Skip empty rows
        if (!name && !email && !department) {
          return
        }
        
        // Validate required fields
        if (!name) {
          errors.push(`Row ${rowIndex + 2}: Missing name`)
          return
        }
        
        if (!email) {
          errors.push(`Row ${rowIndex + 2}: Missing email`)
          return
        }
        
        if (!department) {
          errors.push(`Row ${rowIndex + 2}: Missing department`)
          return
        }
        
        // Validate email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
        if (!emailRegex.test(email)) {
          errors.push(`Row ${rowIndex + 2}: Invalid email format: ${email}`)
          return
        }
        
        // Extract other fields
        const subject = subjectCol !== -1 ? (row[sheet.headers[subjectCol]]?.toString().trim() || '') : ''
        const handledSection = sectionCol !== -1 ? (row[sheet.headers[sectionCol]]?.toString().trim() || '') : ''
        const password = passwordCol !== -1 ? (row[sheet.headers[passwordCol]]?.toString().trim() || '') : ''
        
        const professor: ParsedProfessor = {
          name,
          department,
          subject,
          handledSection,
          email,
          password: password || 'Prof@1234', // Default password if not provided
          rowIndex: rowIndex + 2, // +2 because Excel rows are 1-indexed and we skip header
        }
        
        professors.push(professor)
        
        // Group by section
        if (handledSection) {
          if (!professorsBySection[handledSection]) {
            professorsBySection[handledSection] = []
          }
          professorsBySection[handledSection].push(professor)
        }
      } catch (error) {
        errors.push(`Row ${rowIndex + 2}: Error parsing row - ${(error as Error).message}`)
      }
    })
  })
  
  console.log(`Parsed ${professors.length} professors from Excel`)
  if (errors.length > 0) {
    console.warn(`Found ${errors.length} errors during parsing:`, errors)
  }
  
  return {
    professors,
    totalProfessors: professors.length,
    errors,
    professorsBySection,
  }
}

// Main function to parse Excel and extract professors
export async function parseExcelProfessors(file: File): Promise<ExcelProfessorParseResult> {
  try {
    // Extract data from Excel
    const excelData = await readExcelFile(file)
    
    // Parse professors from Excel data
    const result = parseProfessorsFromExcel(excelData)
    
    return result
  } catch (error) {
    console.error('Excel parsing error:', error)
    throw new Error(`Failed to parse Excel: ${(error as Error).message}`)
  }
}