/**
 * Firebase Admin SDK utilities for server-side operations
 * This file should only be used in API routes (server-side)
 */

import { getApps, initializeApp, cert, type App } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'

let adminApp: App | null = null

/**
 * Initialize Firebase Admin SDK
 * This should only run on the server side
 */
function getAdminApp() {
  if (adminApp) {
    return adminApp
  }

  // Check if Firebase Admin is already initialized
  const existingApps = getApps()
  if (existingApps.length > 0) {
    adminApp = existingApps[0]
    return adminApp
  }

  // Initialize with environment variables
  // You need to set these in your .env.local file
  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'evaluation-in-la-conception'
  
  try {
    // Option 1: Using service account key file (recommended for production)
    if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
      try {
        const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY)
        adminApp = initializeApp({
          credential: cert(serviceAccount),
          projectId: projectId
        })
        console.log('Firebase Admin initialized with service account key')
        return adminApp
      } catch (parseError) {
        console.error('Failed to parse FIREBASE_SERVICE_ACCOUNT_KEY:', parseError)
        throw new Error('Invalid FIREBASE_SERVICE_ACCOUNT_KEY format')
      }
    } 
    // Option 2: Using individual credentials
    else if (process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY) {
      try {
        const privateKey = process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n')
        if (!privateKey || privateKey.trim() === '') {
          throw new Error('FIREBASE_PRIVATE_KEY is empty')
        }
        adminApp = initializeApp({
          credential: cert({
            projectId: projectId,
            clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
            privateKey: privateKey
          })
        })
        console.log('Firebase Admin initialized with individual credentials')
        return adminApp
      } catch (certError) {
        console.error('Failed to initialize with individual credentials:', certError)
        throw new Error('Invalid Firebase Admin credentials')
      }
    }
    // Option 3: Default credentials (when deployed on Google Cloud)
    else {
      console.warn('Firebase Admin: No service account credentials found. Using default credentials.')
      try {
        adminApp = initializeApp({
          projectId: projectId
        })
        console.log('Firebase Admin initialized with default credentials')
        return adminApp
      } catch (defaultError) {
        console.error('Failed to initialize with default credentials:', defaultError)
        throw new Error('Firebase Admin initialization failed: No valid credentials found')
      }
    }
  } catch (error: any) {
    console.error('Failed to initialize Firebase Admin:', error)
    const errorMessage = error?.message || 'Firebase Admin initialization failed'
    throw new Error(`Firebase Admin initialization failed: ${errorMessage}`)
  }
}

/**
 * Delete a user from Firebase Authentication by email
 * @param email - The email of the user to delete
 * @returns Promise<boolean> - true if successful, false otherwise
 */
export async function deleteUserFromAuth(email: string): Promise<boolean> {
  try {
    const app = getAdminApp()
    const auth = getAuth(app)
    
    // Get user by email
    const userRecord = await auth.getUserByEmail(email)
    
    // Delete the user
    await auth.deleteUser(userRecord.uid)
    
    console.log(`Successfully deleted user: ${email}`)
    return true
  } catch (error: any) {
    if (error.code === 'auth/user-not-found') {
      console.warn(`User not found: ${email}`)
      // Consider this a success since the user doesn't exist
      return true
    }
    
    console.error('Error deleting user from Firebase Auth:', error)
    return false
  }
}

/**
 * Get a user by email
 * @param email - The email of the user to get
 */
export async function getUserByEmail(email: string) {
  try {
    const app = getAdminApp()
    const auth = getAuth(app)
    return await auth.getUserByEmail(email)
  } catch (error) {
    console.error('Error getting user:', error)
    return null
  }
}

/**
 * List all users (paginated)
 * @param maxResults - Maximum number of results to return (default: 1000)
 */
export async function listUsers(maxResults: number = 1000) {
  try {
    const app = getAdminApp()
    const auth = getAuth(app)
    const listUsersResult = await auth.listUsers(maxResults)
    return listUsersResult.users
  } catch (error) {
    console.error('Error listing users:', error)
    return []
  }
}

/**
 * Update a user's password in Firebase Authentication
 * If user doesn't exist, creates a new user with the password
 * @param email - The email of the user to update
 * @param newPassword - The new password
 * @returns Promise<boolean> - true if successful, false otherwise
 */
export async function updateUserPassword(email: string, newPassword: string): Promise<boolean> {
  try {
    let app
    try {
      app = getAdminApp()
    } catch (initError: any) {
      console.error('Failed to get Firebase Admin app:', initError)
      if (initError?.message?.includes('initialization') || initError?.code === 'app/invalid-credential') {
        throw new Error('Firebase Admin SDK not properly configured. Please check your credentials.')
      }
      throw initError
    }
    
    const auth = getAuth(app)
    
    try {
      // Try to get user by email
      const userRecord = await auth.getUserByEmail(email)
      
      // User exists, update the password
      // Admin SDK updateUser doesn't send emails automatically
      await auth.updateUser(userRecord.uid, {
        password: newPassword
        // Note: Admin SDK password updates don't trigger email notifications
      })
      
      console.log(`Successfully updated password for user: ${email}`)
      return true
    } catch (getUserError: any) {
      // If user not found, create a new user
      if (getUserError.code === 'auth/user-not-found') {
        console.log(`User not found in Firebase Auth, creating new user: ${email}`)
        try {
          // Create user with emailVerified: true to prevent verification email
          // Since user already exists in Firestore, we trust the email
          const newUser = await auth.createUser({
            email: email,
            password: newPassword,
            emailVerified: true, // Set to true to prevent verification email
            disabled: false
          })
          console.log(`Successfully created user with password: ${email} (UID: ${newUser.uid})`)
          return true
        } catch (createError: any) {
          // Handle specific creation errors
          if (createError.code === 'auth/email-already-exists') {
            // User might have been created between check and create - try to update
            console.log(`Email already exists, attempting to update password: ${email}`)
            try {
              const existingUser = await auth.getUserByEmail(email)
              await auth.updateUser(existingUser.uid, {
                password: newPassword
              })
              console.log(`Successfully updated password for existing user: ${email}`)
              return true
            } catch (updateError: any) {
              console.error('Error updating password for existing user:', updateError)
              return false
            }
          }
          console.error('Error creating user in Firebase Auth:', createError)
          throw createError // Re-throw to be caught by outer catch
        }
      }
      
      // Re-throw if it's a different error
      throw getUserError
    }
  } catch (error: any) {
    console.error('Error updating user password in Firebase Auth:', error)
    // Return more detailed error information
    if (error.code) {
      console.error(`Firebase Auth error code: ${error.code}`)
    }
    return false
  }
}

