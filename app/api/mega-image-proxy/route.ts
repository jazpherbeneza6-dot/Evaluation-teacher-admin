/*
 * API ROUTE: MEGA Image Proxy
 * 
 * SIMPLE EXPLANATION:
 * 1. Ito ang proxy endpoint para sa pag-display ng MEGA images
 * 2. Tumatanggap ng MEGA link at nag-download ng image
 * 3. Nag-return ng image data para ma-display sa browser
 * 4. Solves ang issue na MEGA links ay hindi direct image links
 * 
 * MGA FEATURES:
 * - Proxy MEGA images for direct display
 * - Handles MEGA link format conversion
 * - Caching for better performance
 * - Error handling
 */

import { NextRequest, NextResponse } from 'next/server'
import { File } from 'megajs'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const megaLink = searchParams.get('url')

    if (!megaLink) {
      return NextResponse.json(
        { error: 'MEGA URL is required' },
        { status: 400 }
      )
    }

    // Validate MEGA link format
    if (!megaLink.includes('mega.nz')) {
      return NextResponse.json(
        { error: 'Invalid MEGA URL' },
        { status: 400 }
      )
    }

    try {
      // Create File object from MEGA link
      const file = File.fromURL(megaLink)

      // Load file attributes - wrap in promise
      await new Promise<void>((resolve, reject) => {
        try {
          file.loadAttributes((err: Error | null) => {
            if (err) {
              reject(err)
            } else {
              resolve()
            }
          })
        } catch (loadError) {
          reject(loadError as Error)
        }
      })

      // Download file data - use callback-based download
      const imageBuffer = await new Promise<Buffer>((resolve, reject) => {
        const chunks: Buffer[] = []
        
        try {
          // Use download with options object (required by megajs)
          const downloadStream = file.download({})
          
          downloadStream.on('data', (chunk: Buffer) => {
            chunks.push(chunk)
          })
          
          downloadStream.on('end', () => {
            resolve(Buffer.concat(chunks))
          })
          
          downloadStream.on('error', (err: Error) => {
            reject(err)
          })
        } catch (downloadError) {
          reject(downloadError as Error)
        }
      })

      // Determine content type from file extension or default to image
      let contentType = 'image/jpeg'
      if (file.name) {
        const ext = file.name.toLowerCase().split('.').pop()
        const contentTypes: { [key: string]: string } = {
          'jpg': 'image/jpeg',
          'jpeg': 'image/jpeg',
          'png': 'image/png',
          'gif': 'image/gif',
          'webp': 'image/webp',
        }
        contentType = contentTypes[ext || ''] || 'image/jpeg'
      }

      // Return image with proper headers
      // Convert Buffer to Uint8Array for Response (BodyInit type)
      // Use ArrayBuffer to ensure proper type compatibility
      const arrayBuffer = imageBuffer.buffer.slice(
        imageBuffer.byteOffset,
        imageBuffer.byteOffset + imageBuffer.byteLength
      )
      const uint8Array = new Uint8Array(arrayBuffer)
      
      return new Response(uint8Array, {
        status: 200,
        headers: {
          'Content-Type': contentType,
          'Cache-Control': 'public, max-age=31536000, immutable', // Cache for 1 year
          'Content-Length': imageBuffer.length.toString(),
        },
      })
    } catch (megaError) {
      console.error('Error downloading from MEGA:', megaError)
      return NextResponse.json(
        { 
          error: 'Failed to load image from MEGA',
          message: (megaError as Error).message 
        },
        { status: 500 }
      )
    }
  } catch (error) {
    console.error('Error in MEGA image proxy:', error)
    return NextResponse.json(
      { 
        error: 'Failed to proxy image',
        message: (error as Error).message || 'An unexpected error occurred'
      },
      { status: 500 }
    )
  }
}
