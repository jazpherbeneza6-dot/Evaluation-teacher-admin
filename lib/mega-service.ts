/*
 * MEGA SERVICE - Service para sa pag-upload at pag-delete ng files sa MEGA
 * 
 * SIMPLE EXPLANATION:
 * 1. Dito naka-handle ang lahat ng MEGA operations (upload, delete, find files)
 * 2. Ginagamit ang megajs library para makipag-communicate sa MEGA API
 * 3. Secure na naka-store ang credentials sa environment variables
 * 4. Automatic na nag-rename ng files base sa department name
 * 
 * MGA FEATURES:
 * - Upload images to MEGA
 * - Delete existing images
 * - Find files by name
 * - Automatic file renaming based on department name
 */

import { Storage } from 'megajs'

// MEGA credentials - dapat naka-set sa environment variables
const MEGA_EMAIL = process.env.MEGA_EMAIL || ''
const MEGA_PASSWORD = process.env.MEGA_PASSWORD || ''

// Cache storage instance para hindi mag-reconnect every time
let cachedStorage: Storage | null = null
let storagePromise: Promise<Storage> | null = null

// Helper function para sa pag-sanitize ng filename
function sanitizeFileName(departmentName: string): string {
  // Remove special characters, keep only alphanumeric, spaces, and hyphens
  return departmentName
    .replace(/[^a-zA-Z0-9\s-]/g, '')
    .replace(/\s+/g, '_')
    .trim()
}

// Helper function para sa pag-get ng file extension
function getFileExtension(fileName: string): string {
  const parts = fileName.split('.')
  return parts.length > 1 ? parts[parts.length - 1].toLowerCase() : 'jpg'
}

// Initialize MEGA storage connection with retry logic
async function getMegaStorage(retryCount = 0): Promise<Storage> {
  // Validate credentials with clear error message
  if (!MEGA_EMAIL || !MEGA_PASSWORD) {
    const missingFields = []
    if (!MEGA_EMAIL) missingFields.push('MEGA_EMAIL')
    if (!MEGA_PASSWORD) missingFields.push('MEGA_PASSWORD')
    
    throw new Error(
      `MEGA credentials not configured. Missing: ${missingFields.join(', ')}. ` +
      'Please set MEGA_EMAIL and MEGA_PASSWORD environment variables in your .env.local file. ' +
      'See MEGA_SETUP.md for setup instructions. ' +
      'After adding credentials, restart your development server.'
    )
  }
  
  // Validate email format
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  if (!emailRegex.test(MEGA_EMAIL)) {
    throw new Error(
      `Invalid MEGA email format: "${MEGA_EMAIL}". Please provide a valid email address.`
    )
  }

  // Return cached storage if available
  if (cachedStorage) {
    try {
      // Test if storage is still valid by checking root
      if (!cachedStorage.root.children) {
        await cachedStorage.root.loadChildren()
      }
      return cachedStorage
    } catch {
      // If cached storage is invalid, reset it
      cachedStorage = null
      storagePromise = null
    }
  }

  // If there's already a connection attempt in progress, wait for it
  if (storagePromise) {
    return storagePromise
  }

  // Create new connection with retry logic
  storagePromise = (async () => {
    const maxRetries = 3
    const retryDelay = 1000 // 1 second (reduced from 2 seconds)

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const storage = new Storage({
          email: MEGA_EMAIL,
          password: MEGA_PASSWORD,
        })

        // Set longer timeout for connection with proper error handling
        const connectionTimeout = 30000 // 30 seconds
        const timeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(() => reject(new Error('Connection timeout')), connectionTimeout)
        })

        // Wrap in try-catch to handle any unhandled rejections
        try {
          await Promise.race([storage.ready, timeoutPromise])
        } catch (raceError) {
          // If it's a timeout or connection error, throw it
          throw raceError
        }
        
        // Test connection by accessing root with timeout
        try {
          const loadChildrenPromise = storage.root.loadChildren()
          const loadTimeoutPromise = new Promise<never>((_, reject) => {
            setTimeout(() => reject(new Error('Load children timeout')), 15000)
          })
          await Promise.race([loadChildrenPromise, loadTimeoutPromise])
        } catch (loadError) {
          // If loading children fails, it might still be a valid connection
          // Continue but log the warning
          if (attempt === maxRetries) {
            throw loadError
          }
        }
        
        cachedStorage = storage
        return storage
      } catch (error) {
        const errorMessage = (error as Error).message
        const errorCode = (error as any)?.code || ''
        
        // Check if it's a connection timeout error
        const isConnectionError = 
          errorCode === 'UND_ERR_CONNECT_TIMEOUT' ||
          errorMessage.includes('Connect Timeout') ||
          errorMessage.includes('fetch failed') ||
          errorMessage.includes('timeout')
        
        if (attempt < maxRetries && isConnectionError) {
          // Wait before retrying (reduced delay: 1s, 2s, 3s instead of 2s, 4s, 6s)
          await new Promise(resolve => setTimeout(resolve, retryDelay * (attempt + 1)))
          continue
        }
        
        // Clear cache on final failure
        cachedStorage = null
        storagePromise = null
        
        // Throw a user-friendly error
        throw new Error(
          `Failed to connect to MEGA after ${maxRetries + 1} attempts: ${errorMessage}. ` +
          'Please check your internet connection and MEGA credentials.'
        )
      }
    }
    
    // This should never be reached, but just in case
    cachedStorage = null
    storagePromise = null
    throw new Error('Failed to connect to MEGA: Maximum retries exceeded')
  })().catch((error) => {
    // Ensure any unhandled errors are caught
    cachedStorage = null
    storagePromise = null
    throw error
  })

  return storagePromise
}

// Upload image to MEGA with retry logic
export async function uploadImageToMega(
  fileBuffer: Buffer,
  departmentName: string,
  originalFileName: string
): Promise<string> {
  const maxRetries = 3
  let lastError: Error | null = null

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const storage = await getMegaStorage()
      
      // Ensure root is loaded
      if (!storage.root.children) {
        await storage.root.loadChildren()
      }
      
      // Sanitize department name para sa filename
      const sanitizedName = sanitizeFileName(departmentName)
      const fileExtension = getFileExtension(originalFileName)
      const fileName = `${sanitizedName}.${fileExtension}`
      
      // IMPORTANT: Delete ALL existing files for this department BEFORE uploading new one
      // This ensures clean replacement - old image deleted, new image uploaded with same name
      const existingFiles = storage.root.children.filter(
        (file: any) => file.name.startsWith(sanitizedName + '.')
      )
      
      // Delete all existing files for this department
      if (existingFiles.length > 0) {
        console.log(`Found ${existingFiles.length} existing file(s) for department "${departmentName}", deleting old image(s)...`)
        
        // Delete all existing files in parallel for faster processing
        const deletePromises = existingFiles.map(async (existingFile: any) => {
          try {
            await existingFile.delete(true) // true = move to trash
            console.log(`Deleted old image: ${existingFile.name}`)
          } catch (deleteError) {
            console.warn(`Failed to delete old file ${existingFile.name}:`, (deleteError as Error).message)
            // Continue with other files even if one fails
          }
        })
        
        // Wait for all deletions to complete
        await Promise.all(deletePromises)
        
        // Reload children to ensure deleted files are removed from the list
        try {
          await storage.root.loadChildren()
          console.log(`Successfully deleted ${existingFiles.length} old image(s), ready for new upload`)
        } catch (reloadError) {
          console.warn('Failed to reload children after deletion:', (reloadError as Error).message)
        }
      }
      
      // Use the same filename - old files are already deleted, so no conflict
      // This ensures clean replacement: old image deleted → new image uploaded with same name
      console.log(`Uploading new image with filename: ${fileName}`)
      
      // Upload new file with timeout and proper error handling
      let file: any
      try {
        const uploadPromise = storage.upload(fileName, fileBuffer).complete
        const timeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(() => reject(new Error('Upload timeout after 60 seconds')), 60000)
        })
        
        file = await Promise.race([uploadPromise, timeoutPromise])
      } catch (uploadError) {
        const uploadErr = uploadError as Error
        // Check if it's a connection/timeout error
        if (uploadErr.message.includes('timeout') || 
            uploadErr.message.includes('connect') ||
            (uploadErr as any)?.code === 'UND_ERR_CONNECT_TIMEOUT') {
          throw new Error('Connection timeout during upload')
        }
        throw uploadError
      }
      
      // Get public link with timeout
      let megaLink: string
      try {
        const linkPromise = file.link()
        const linkTimeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(() => reject(new Error('Link generation timeout')), 10000)
        })
        
        megaLink = await Promise.race([linkPromise, linkTimeoutPromise])
      } catch (linkError) {
        const linkErr = linkError as Error
        // If link generation fails but upload succeeded, we still have an issue
        if (linkErr.message.includes('timeout') || 
            linkErr.message.includes('connect') ||
            (linkErr as any)?.code === 'UND_ERR_CONNECT_TIMEOUT') {
          throw new Error('Connection timeout during link generation')
        }
        throw linkError
      }
      
      // Convert MEGA share link to proxy URL for direct image display
      // MEGA share links don't work directly in <img> tags, so we use a proxy
      const proxyUrl = `/api/mega-image-proxy?url=${encodeURIComponent(megaLink)}`
      
      return proxyUrl
    } catch (error) {
      lastError = error as Error
      const errorCode = (error as any)?.code || ''
      
      // Check if it's a connection/timeout error
      const isConnectionError = 
        errorCode === 'UND_ERR_CONNECT_TIMEOUT' ||
        lastError.message.includes('timeout') ||
        lastError.message.includes('connect') ||
        lastError.message.includes('network') ||
        lastError.message.includes('fetch failed')
      
      // If it's a connection error and we have retries left, retry
      if (attempt < maxRetries && isConnectionError) {
        // Clear cached storage to force reconnection
        cachedStorage = null
        storagePromise = null
        
        // Reduced retry delay for faster retries (1s, 2s, 3s instead of 3s, 6s, 9s)
        const retryDelay = 1000 * (attempt + 1)
        await new Promise(resolve => setTimeout(resolve, retryDelay))
        continue
      }
      
      // If it's the last attempt or not a connection error, throw
      if (attempt === maxRetries) {
        throw new Error(
          `Failed to upload image to MEGA after ${maxRetries + 1} attempts: ${lastError.message}. ` +
          'Please check your internet connection and try again.'
        )
      }
    }
  }
  
  throw new Error(`Failed to upload image to MEGA: ${lastError?.message || 'Unknown error'}`)
}

// Delete image from MEGA by URL or filename
export async function deleteImageFromMega(imageUrl: string): Promise<void> {
  try {
    const storage = await getMegaStorage()
    
    // Extract filename from URL or use the URL itself to find the file
    // MEGA links contain file information, but we need to search by name
    // For now, we'll search all files and find matching ones
    
    // If imageUrl is a MEGA link, we can extract file info
    // Otherwise, we search by department name pattern
    
    // Get all files in root
    const files = storage.root.children
    
    // Try to find file by checking if URL matches any file's link
    for (const file of files) {
      try {
        const fileLink = await file.link()
        if (fileLink === imageUrl) {
          await file.delete(true)
          return
        }
      } catch (err) {
        // Continue searching if link generation fails
        continue
      }
    }
  } catch (error) {
    throw new Error(`Failed to delete image from MEGA: ${(error as Error).message}`)
  }
}

// Delete image by department name (helper function)
export async function deleteImageByDepartmentName(departmentName: string): Promise<void> {
  try {
    const storage = await getMegaStorage()
    
    // Ensure root is loaded
    if (!storage.root.children) {
      await storage.root.loadChildren()
    }
    
    const sanitizedName = sanitizeFileName(departmentName)
    
    // Find ALL files that match the department name pattern
    // This includes files with different extensions (jpg, png, etc.)
    const files = storage.root.children.filter((file: any) => 
      file.name.startsWith(sanitizedName + '.') || 
      file.name === sanitizedName
    )
    
    if (files.length === 0) {
      console.log(`No existing files found for department: ${departmentName}`)
      return
    }
    
    console.log(`Found ${files.length} file(s) to delete for department: ${departmentName}`)
    
    // Delete all matching files in parallel for faster processing
    const deletePromises = files.map(async (file: any) => {
      try {
        console.log(`Deleting file: ${file.name}`)
        await file.delete(true) // true = move to trash
      } catch (deleteError) {
        console.warn(`Failed to delete file ${file.name}:`, (deleteError as Error).message)
        // Continue with other files even if one fails
      }
    })
    
    // Wait for all deletions to complete
    await Promise.all(deletePromises)
    
    // Reload children to ensure deleted files are removed
    try {
      await storage.root.loadChildren()
      console.log(`Successfully deleted ${files.length} file(s) for department: ${departmentName}`)
    } catch (reloadError) {
      console.warn('Failed to reload children after deletion:', (reloadError as Error).message)
    }
  } catch (error) {
    // Log error but don't throw - allow upload to continue
    console.error(`Error deleting image by department name "${departmentName}":`, (error as Error).message)
    // Don't throw - the upload function will handle cleanup
  }
}

// Find file by department name
export async function findFileByDepartmentName(departmentName: string): Promise<string | null> {
  try {
    const storage = await getMegaStorage()
    const sanitizedName = sanitizeFileName(departmentName)
    
    // Find file that starts with department name
    const file = storage.root.children.find((file: any) => 
      file.name.startsWith(sanitizedName + '.')
    )
    
    if (file) {
      const link = await file.link()
      return link
    }
    
    return null
  } catch (error) {
    return null
  }
}
