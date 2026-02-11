/*
 * FIREBASE CONFIGURATION - Ito ang configuration file para sa Firebase
 * 
 * SIMPLE EXPLANATION:
 * 1. Dito naka-set ang lahat ng Firebase configuration
 * 2. I-initialize ang Firebase app, authentication, at database
 * 3. I-export ang mga services para magamit sa ibang parts ng app
 * 4. Centralized na configuration para sa buong application
 * 
 * MGA FEATURES:
 * - Firebase app initialization
 * - Authentication service setup
 * - Firestore database setup
 * - Configuration management
 * 
 * NOTE: Firebase Storage is not used in this project. File storage is handled by MEGA.
 */

// STEP 1: Import ng mga kailangan na Firebase functions
import { initializeApp, getApps, type FirebaseApp } from "firebase/app" // Para sa pag-initialize ng Firebase app
import { getAuth } from "firebase/auth" // Para sa authentication service
import { getFirestore, connectFirestoreEmulator, type Firestore } from "firebase/firestore" // Para sa Firestore database

// STEP 2: Firebase configuration object - lahat ng settings para sa Firebase project
const firebaseConfig = {
  apiKey: "AIzaSyDSuXyfE_GNGSUVMV9ynUgLDveQt1yocLY",
  authDomain: "laconception-database.firebaseapp.com",
  projectId: "laconception-database",
  storageBucket: "laconception-database.firebasestorage.app",
  messagingSenderId: "256226515300",
  appId: "1:256226515300:web:a0d6ed235504d9d5bb0271",
  measurementId: "G-WNGVWCMZNG"
};

// STEP 3: Initialize ang Firebase app gamit ang configuration (singleton pattern)
let app: FirebaseApp
const apps = getApps()
if (apps.length === 0) {
  app = initializeApp(firebaseConfig)
} else {
  app = apps[0] // Use existing app to avoid multiple instances
}

// STEP 4: Initialize Firebase Authentication at i-export para magamit sa buong app
export const auth = getAuth(app)

// STEP 5: Initialize Cloud Firestore database at i-export para magamit sa buong app
// Use singleton pattern to prevent multiple instances
let db: Firestore
try {
  // Check if Firestore is already initialized for this app
  db = getFirestore(app)
} catch (error) {
  console.error('Failed to initialize Firestore:', error)
  // If initialization fails, try to get existing instance
  try {
    const existingApps = getApps()
    if (existingApps.length > 0) {
      db = getFirestore(existingApps[0])
    } else {
      throw new Error('No Firebase app available')
    }
  } catch (retryError) {
    console.error('Failed to get Firestore instance:', retryError)
    // Create a new app instance as last resort
    app = initializeApp(firebaseConfig)
    db = getFirestore(app)
  }
}

export { db }

// STEP 6: Export ang Firebase app instance
export default app
