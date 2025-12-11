/**
 * API Route for deleting users from Firebase Authentication
 * 
 * This endpoint requires server-side implementation with Firebase Admin SDK
 * and should be secured with proper authentication and authorization.
 */

import { NextRequest, NextResponse } from 'next/server'
import { deleteUserFromAuth } from '@/lib/firebase-auth-admin'

export async function POST(request: NextRequest) {
  try {
    // Parse request body
    const { email } = await request.json()

    if (!email) {
      return NextResponse.json(
        { error: 'Email is required' },
        { status: 400 }
      )
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: 'Invalid email format' },
        { status: 400 }
      )
    }

    // TODO: Add authentication and authorization checks here
    // Example:
    // const user = await getCurrentUser(request)
    // if (!user || user.role !== 'admin') {
    //   return NextResponse.json(
    //     { error: 'Unauthorized' },
    //     { status: 401 }
    //   )
    // }

    // Delete user from Firebase Authentication
    const success = await deleteUserFromAuth(email)

    if (success) {
      return NextResponse.json({
        message: `User ${email} successfully deleted from Firebase Authentication`,
        success: true
      })
    } else {
      return NextResponse.json(
        { error: `Failed to delete user ${email} from Firebase Authentication` },
        { status: 500 }
      )
    }

  } catch (error) {
    console.error('Error in delete-user-auth API:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest) {
  // Alternative DELETE method for RESTful API
  return POST(request)
}
