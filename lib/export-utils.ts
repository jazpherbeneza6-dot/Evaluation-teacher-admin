/*
 * EXPORT UTILITIES - Ito ang mga functions para sa pag-export ng data sa different formats
 * 
 * SIMPLE EXPLANATION:
 * 1. Ginagamit ito para sa pag-export ng data sa CSV, PDF, at DOCX formats
 * 2. Pwede kang mag-export ng professor data, evaluation results, at statistics
 * 3. May automatic na pag-generate ng filename na may date
 * 4. Ginagamit sa admin dashboard para sa reporting
 * 
 * MGA FEATURES:
 * - CSV export para sa spreadsheet
 * - PDF export para sa printable reports
 * - DOCX export para sa Word documents
 * - Automatic filename generation
 * - Data formatting at styling
 */

// STEP 1: Import ng mga kailangan na libraries
import jsPDF from "jspdf" // Para sa PDF generation
import { Document, Packer, Paragraph, Table, TableCell, TableRow, TextRun, WidthType } from "docx" // Para sa DOCX generation
import { saveAs } from "file-saver" // Para sa file downloading
import type { Professor } from "@/lib/types" // Professor type

// STEP 2: ExportData interface - structure ng data na i-export
export interface ExportData {
  professors: Professor[] // Array ng professors na i-export
  title: string // Title ng report
  generatedAt: Date // Date kung kailan ginawa ang report
}

// STEP 3: exportToCSV function - para sa pag-export ng data sa CSV format
export const exportToCSV = (data: ExportData) => {
  // I-create ang CSV content na may headers at data
  const csvContent = [
    ["Name", "Email", "Department", "Created Date"], // Headers
    ...data.professors.map((prof) => [
      prof.name, // Professor name
      prof.email, // Professor email
      prof.departmentName, // Department name
      prof.createdAt.toLocaleDateString(), // Created date
    ]),
  ]
    .map((row) => row.map(field => `"${field}"`).join(",")) // I-wrap ang bawat field sa quotes
    .join("\n") // I-join ang rows gamit ang newline

  // I-create ang Blob object para sa CSV file
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" })
  const fileName = `professors_${data.generatedAt.toISOString().split('T')[0]}.csv` // I-generate ang filename
  saveAs(blob, fileName) // I-download ang file
}

// STEP 4: exportToPDF function - para sa pag-export ng data sa PDF format
export const exportToPDF = (data: ExportData) => {
  const doc = new jsPDF() // I-create ang PDF document
  
  // I-add ang title
  doc.setFontSize(20)
  doc.text(data.title, 14, 22)
  
  // I-add ang generation date
  doc.setFontSize(10)
  doc.text(`Generated on: ${data.generatedAt.toLocaleString()}`, 14, 30)
  
  // I-add ang table headers
  doc.setFontSize(12)
  doc.setFont("helvetica", "bold")
  doc.text("Name", 14, 45)
  doc.text("Email", 60, 45)
  doc.text("Department", 120, 45)
  doc.text("Created", 160, 45)
  
  // I-add ang table data
  doc.setFont("helvetica", "normal")
  doc.setFontSize(10)
  
  let yPosition = 55 // Starting position para sa data
  data.professors.forEach((prof, index) => {
    if (yPosition > 280) {
      doc.addPage() // I-add ang bagong page kung malapit na sa bottom
      yPosition = 20
    }
    
    // I-add ang professor data
    doc.text(prof.name || "", 14, yPosition)
    doc.text(prof.email || "", 60, yPosition)
    doc.text(prof.departmentName || "", 120, yPosition)
    doc.text(prof.createdAt.toLocaleDateString(), 160, yPosition)
    
    yPosition += 8 // I-move ang position para sa next row
  })
  
  // I-add ang summary
  doc.setFontSize(10)
  doc.text(`Total Professors: ${data.professors.length}`, 14, yPosition + 10)
  
  const fileName = `professors_${data.generatedAt.toISOString().split('T')[0]}.pdf` // I-generate ang filename
  doc.save(fileName) // I-save ang PDF file
}

// STEP 5: exportToDOCX function - para sa pag-export ng data sa DOCX format
export const exportToDOCX = async (data: ExportData) => {
  // I-create ang table rows na may headers at data
  const tableRows = [
    // Header row
    new TableRow({
      children: [
        new TableCell({
          children: [new Paragraph({ children: [new TextRun({ text: "Name", bold: true })] })],
          width: { size: 25, type: WidthType.PERCENTAGE }, // 25% width
        }),
        new TableCell({
          children: [new Paragraph({ children: [new TextRun({ text: "Email", bold: true })] })],
          width: { size: 35, type: WidthType.PERCENTAGE }, // 35% width
        }),
        new TableCell({
          children: [new Paragraph({ children: [new TextRun({ text: "Department", bold: true })] })],
          width: { size: 25, type: WidthType.PERCENTAGE }, // 25% width
        }),
        new TableCell({
          children: [new Paragraph({ children: [new TextRun({ text: "Created", bold: true })] })],
          width: { size: 15, type: WidthType.PERCENTAGE }, // 15% width
        }),
      ],
    }),
    // Data rows
    ...data.professors.map(
      (prof) =>
        new TableRow({
          children: [
            new TableCell({
              children: [new Paragraph({ children: [new TextRun({ text: prof.name })] })],
            }),
            new TableCell({
              children: [new Paragraph({ children: [new TextRun({ text: prof.email })] })],
            }),
            new TableCell({
              children: [new Paragraph({ children: [new TextRun({ text: prof.departmentName })] })],
            }),
            new TableCell({
              children: [new Paragraph({ children: [new TextRun({ text: prof.createdAt.toLocaleDateString() })] })],
            }),
          ],
        })
    ),
  ]

  // I-create ang Word document
  const doc = new Document({
    sections: [
      {
        properties: {},
        children: [
          // Title
          new Paragraph({
            children: [
              new TextRun({
                text: data.title,
                bold: true,
                size: 32,
              }),
            ],
          }),
          // Generation date
          new Paragraph({
            children: [
              new TextRun({
                text: `Generated on: ${data.generatedAt.toLocaleString()}`,
                size: 20,
              }),
            ],
          }),
          new Paragraph({ children: [] }), // Empty line
          // Table
          new Table({
            width: {
              size: 100,
              type: WidthType.PERCENTAGE,
            },
            rows: tableRows,
          }),
          new Paragraph({ children: [] }), // Empty line
          // Summary
          new Paragraph({
            children: [
              new TextRun({
                text: `Total Professors: ${data.professors.length}`,
                bold: true,
                size: 24,
              }),
            ],
          }),
        ],
      },
    ],
  })

  // I-convert ang document sa buffer at i-download
  const buffer = await Packer.toBuffer(doc)
  const uint8Array = new Uint8Array(buffer)
  const blob = new Blob([uint8Array], { type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" })
  const fileName = `professors_${data.generatedAt.toISOString().split('T')[0]}.docx` // I-generate ang filename
  saveAs(blob, fileName) // I-download ang file
}
