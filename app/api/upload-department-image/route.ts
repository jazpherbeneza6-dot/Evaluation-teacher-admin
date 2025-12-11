/*
 * API ROUTE: Upload Department Image to MEGA
 * 
 * SIMPLE EXPLANATION:
 * 1. Ito ang API endpoint para sa pag-upload ng department profile picture
 * 2. Tumatanggap ng image file at department name
 * 3. Nag-upload sa MEGA at nag-return ng public URL
 * 4. Automatic na nag-delete ng old image kung may existing na
 * 
 * MGA FEATURES:
 * - File upload handling
 * - Automatic old file deletion
 * - File renaming based on department name
 * - Error handling
 */

import { NextRequest, NextResponse } from 'next/server'
import { uploadImageToMega, deleteImageByDepartmentName } from '@/lib/mega-service'
import { departmentService } from '@/lib/database'

export async function POST(request: NextRequest) {
  try {
    // Check MEGA credentials first
    if (!process.env.MEGA_EMAIL || !process.env.MEGA_PASSWORD) {
      return NextResponse.json(
        { 
          error: 'MEGA not configured',
          message: 'MEGA credentials are not set. Please configure MEGA_EMAIL and MEGA_PASSWORD in .env.local file. See MEGA_SETUP.md for instructions.'
        },
        { status: 500 }
      )
    }

    const formData = await request.formData()
    const file = formData.get('file') as File
    const departmentId = formData.get('departmentId') as string
    const departmentName = formData.get('departmentName') as string

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided', message: 'Please select an image file to upload.' },
        { status: 400 }
      )
    }

    if (!departmentId || !departmentName) {
      return NextResponse.json(
        { error: 'Department information missing', message: 'Department ID and name are required.' },
        { status: 400 }
      )
    }

    // Verify department exists
    const departments = await departmentService.getAll()
    const existingDepartment = departments.find(d => d.id === departmentId)
    
    if (!existingDepartment) {
      return NextResponse.json(
        { error: 'Department not found', message: `Department with ID "${departmentId}" does not exist.` },
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
    
    // STEP 1: Delete old image FIRST before uploading new one
    // This prevents conflicts and ensures clean replacement
    // Note: uploadImageToMega will also handle deletion, but doing it here first is faster
    if (existingDepartment?.imageUrl) {
      try {
        console.log(`Deleting old image for department: ${departmentName}`)
        await deleteImageByDepartmentName(departmentName)
        console.log(`Successfully deleted old image for department: ${departmentName}`)
        // Removed delay - deletion is fast enough without waiting
      } catch (error) {
        console.warn(`Warning: Failed to delete old image for ${departmentName}:`, (error as Error).message)
        // Continue with upload - the upload function will also try to delete existing files
      }
    }

    // STEP 2: Convert file to buffer
    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    // STEP 3: Upload new image to MEGA
    // The upload function will also check and delete any remaining files with same name
    let imageUrl: string
    try {
      console.log(`Uploading new image for department: ${departmentName}`)
      imageUrl = await uploadImageToMega(buffer, departmentName, file.name)
      console.log(`Successfully uploaded image for department: ${departmentName}`)
    } catch (megaError) {
      const errorMessage = (megaError as Error).message
      const errorCode = (megaError as any)?.code || ''
      
      // Check for connection timeout errors (including UND_ERR_CONNECT_TIMEOUT)
      if (
        errorCode === 'UND_ERR_CONNECT_TIMEOUT' ||
        errorMessage.includes('timeout') || 
        errorMessage.includes('connect') ||
        errorMessage.includes('fetch failed') ||
        errorMessage.includes('Connect Timeout')
      ) {
        return NextResponse.json(
          { 
            error: 'Connection timeout',
            message: 'Unable to connect to MEGA servers. Please check your internet connection and try again. If the problem persists, the MEGA servers may be temporarily unavailable.'
          },
          { status: 503 } // Service Unavailable
        )
      }
      
      if (errorMessage.includes('credentials') || errorMessage.includes('Authentication')) {
        return NextResponse.json(
          { 
            error: 'Authentication failed',
            message: 'MEGA credentials are incorrect. Please check your MEGA_EMAIL and MEGA_PASSWORD in .env.local'
          },
          { status: 401 } // Unauthorized
        )
      }
      
      throw megaError // Re-throw for generic error handling
    }

    // Update department with new image URL
    await departmentService.update(departmentId, departmentName, imageUrl)

    return NextResponse.json({
      success: true,
      imageUrl,
      message: 'Image uploaded successfully'
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
