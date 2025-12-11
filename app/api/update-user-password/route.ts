/**
 * API Route for updating user passwords in Firebase Authentication
 * 
 * This endpoint requires server-side implementation with Firebase Admin SDK
 * and should be secured with proper authentication and authorization.
 */

import { NextRequest, NextResponse } from 'next/server'
import { updateUserPassword } from '@/lib/firebase-auth-admin'

export async function POST(request: NextRequest) {
  try {
    // Parse request body
    const { email, password } = await request.json()

    if (!email) {
      return NextResponse.json(
        { error: 'Email is required' },
        { status: 400 }
      )
    }

    if (!password) {
      return NextResponse.json(
        { error: 'Password is required' },
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

    // Validate password length
    if (password.length < 6) {
      return NextResponse.json(
        { error: 'Password must be at least 6 characters long' },
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

    // Update user password in Firebase Authentication
    try {
      const success = await updateUserPassword(email, password)

      if (success) {
        return NextResponse.json({
          message: `Password for ${email} successfully updated in Firebase Authentication`,
          success: true
        })
      } else {
        return NextResponse.json(
          { error: `Failed to update password for ${email} in Firebase Authentication. The password was saved in Firestore but may not be synced with Firebase Auth.` },
          { status: 500 }
        )
      }
    } catch (authError: any) {
      console.error('Error updating password in Firebase Auth:', authError)
      
      // Check if it's a credential/initialization error
      if (authError?.message?.includes('initialization') || authError?.code === 'app/invalid-credential') {
        return NextResponse.json(
          { 
            error: 'Firebase Admin SDK not properly configured. Password was saved in Firestore but Firebase Auth update failed.',
            details: 'Please check your Firebase Admin credentials in environment variables.'
          },
          { status: 500 }
        )
      }
      
      return NextResponse.json(
        { 
          error: `Failed to update password in Firebase Authentication: ${authError?.message || 'Unknown error'}`,
          details: 'Password was saved in Firestore but may not be synced with Firebase Auth.'
        },
        { status: 500 }
      )
    }

  } catch (error: any) {
    console.error('Error in update-user-password API:', error)
    return NextResponse.json(
      { 
        error: 'Internal server error',
        details: error?.message || 'An unexpected error occurred'
      },
      { status: 500 }
    )
  }
}

export async function PUT(request: NextRequest) {
  // Alternative PUT method for RESTful API
  return POST(request)
}

