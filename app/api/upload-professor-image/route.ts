/*
 * API ROUTE: Upload Professor Image to Database
 * 
 * SIMPLE EXPLANATION:
 * 1. Ito ang API endpoint para sa pag-upload ng professor profile picture
 * 2. Tumatanggap ng image file at professor information
 * 3. Nag-convert ng image sa base64 data URI
 * 4. Nag-save directly sa database (Firestore) as profilePictureUrl
 * 
 * MGA FEATURES:
 * - File upload handling
 * - Base64 conversion
 * - Direct database storage
 * - Error handling
 */

import { NextRequest, NextResponse } from 'next/server'
import { professorService } from '@/lib/database'

export async function POST(request: NextRequest) {
  try {
    // MEGA service removed - skip credential check

    const formData = await request.formData()
    const file = formData.get('file') as File
    const professorId = formData.get('professorId') as string
    const professorName = formData.get('professorName') as string

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided', message: 'Please select an image file to upload.' },
        { status: 400 }
      )
    }

    if (!professorId || !professorName) {
      return NextResponse.json(
        { error: 'Professor information missing', message: 'Professor ID and name are required.' },
        { status: 400 }
      )
    }

    // Verify professor exists
    const professors = await professorService.getAll()
    const existingProfessor = professors.find(p => p.id === professorId)
    
    if (!existingProfessor) {
      return NextResponse.json(
        { error: 'Professor not found', message: `Professor with ID "${professorId}" does not exist.` },
        { status: 404 }
      )
    }

    // Validate file type (images only)
    const validImageTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp']
    if (!validImageTypes.includes(file.type)) {
      return NextResponse.json(
        { 
          error: 'Invalid file type', 
          message: `File type "${file.type}" is not supported. Please upload a JPEG, PNG, GIF, or WebP image.` 
        },
        { status: 400 }
      )
    }

    // Validate file size (max 5MB)
    const maxSize = 5 * 1024 * 1024 // 5MB
    if (file.size > maxSize) {
      const fileSizeMB = (file.size / (1024 * 1024)).toFixed(2)
      return NextResponse.json(
        { 
          error: 'File too large', 
          message: `File size is ${fileSizeMB}MB. Maximum allowed size is 5MB. Please compress or resize the image.` 
        },
        { status: 400 }
      )
    }
    
    // Convert image to base64 data URI
    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)
    const base64 = buffer.toString('base64')
    const dataUri = `data:${file.type};base64,${base64}`
    
    // Save directly to database as profilePictureUrl
    await professorService.updateProfilePicture(professorId, dataUri)
    
    return NextResponse.json({
      success: true,
      message: 'Image uploaded and saved to database successfully',
      imageUrl: dataUri
    })
  } catch (error) {
    const errorMessage = (error as Error).message || 'An unexpected error occurred. Please try again.'
    
    // Return detailed error message to client
    return NextResponse.json(
      { 
        error: 'Failed to upload image',
        message: errorMessage
      },
      { status: 500 }
    )
  }
}
