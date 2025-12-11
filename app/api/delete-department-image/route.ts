/*
 * API ROUTE: Delete Department Image from MEGA
 * 
 * SIMPLE EXPLANATION:
 * 1. Ito ang API endpoint para sa pag-delete ng department profile picture
 * 2. Nag-delete ng image sa MEGA at nag-update ng department record
 * 
 * MGA FEATURES:
 * - Image deletion from MEGA
 * - Department record update
 * - Error handling
 */

import { NextRequest, NextResponse } from 'next/server'
import { deleteImageByDepartmentName } from '@/lib/mega-service'
import { departmentService } from '@/lib/database'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { departmentId, departmentName } = body

    if (!departmentId || !departmentName) {
      return NextResponse.json(
        { error: 'Department ID and name are required' },
        { status: 400 }
      )
    }

    // Delete image from MEGA
    await deleteImageByDepartmentName(departmentName)

    // Update department to remove image URL
    await departmentService.update(departmentId, departmentName, undefined)

    return NextResponse.json({
      success: true,
      message: 'Image deleted successfully'
    })
  } catch (error) {
    console.error('Error deleting department image:', error)
    return NextResponse.json(
      { 
        error: 'Failed to delete image',
        message: (error as Error).message 
      },
      { status: 500 }
    )
  }
}
