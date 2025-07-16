const { supabase } = require('../supabaseClient')
const { v4: uuidv4 } = require('uuid')
const path = require('path')

class SupabaseStorageService {
  constructor() {
    this.bucketName = 'profiles'
  }

  /**
   * Upload profile image to Supabase Storage
   * fileBuffer - File buffer from multer
   * userId - User ID from auth
   * originalName - Original filename
   * mimetype - File mimetype
   * returns {Promise<{url: string, path: string}>}
   */
  async uploadProfileImage(fileBuffer, userId, originalName, mimetype) {
    try {
      // Generate unique filename
      const fileExtension = path.extname(originalName).toLowerCase()
      const fileName = `profile_${Date.now()}_${uuidv4()}${fileExtension}`
      
      // Create file path: userId/fileName
      const filePath = `${userId}/${fileName}`

      console.log('Uploading to Supabase Storage:', {
        bucket: this.bucketName,
        path: filePath,
        size: fileBuffer.length,
        type: mimetype
      })

      // Upload file to Supabase Storage
      const { data, error } = await supabase.storage
        .from(this.bucketName)
        .upload(filePath, fileBuffer, {
          contentType: mimetype,
          cacheControl: '3600', // Cache for 1 hour
          upsert: false // Don't overwrite existing files
        })

      if (error) {
        console.error('Supabase upload error:', error)
        throw new Error(`Upload failed: ${error.message}`)
      }

      console.log('Upload successful:', data)

      // Get public URL
      const { data: urlData } = supabase.storage
        .from(this.bucketName)
        .getPublicUrl(filePath)

      console.log('Generated URL:', urlData.publicUrl)

      // Verify the URL is accessible
      try {
        const response = await fetch(urlData.publicUrl, { method: 'HEAD' })
        console.log('Image accessibility check:', response.status)
        
        if (!response.ok) {
          console.warn('Image may not be accessible:', response.status)
        }
      } catch (fetchError) {
        console.warn('Could not verify image accessibility:', fetchError.message)
      }

      return {
        path: filePath,
        url: urlData.publicUrl,
        fullPath: data.path || filePath
      }
    } catch (error) {
      console.error('Upload profile image error:', error)
      throw error
    }
  }

  /**
   * Delete profile image from Supabase Storage
   * filePath - File path in storage
   * returns {Promise<boolean>}
   */
  async deleteProfileImage(filePath) {
    try {
      console.log('Deleting from Supabase Storage:', filePath)

      const { data, error } = await supabase.storage
        .from(this.bucketName)
        .remove([filePath])

      if (error) {
        console.error('Supabase delete error:', error)
        // Don't throw error for delete failures, just log
        console.warn('Failed to delete file from storage, continuing...')
        return false
      }

      console.log('Delete successful:', data)
      return true
    } catch (error) {
      console.error('Delete profile image error:', error)
      // Don't throw error for delete failures
      return false
    }
  }

  /**
   * Get signed URL for private images (if needed)
   * filePath - File path in storage
   * expiresIn - Expiry time in seconds
   * returns {Promise<string>}
   */
  async getSignedUrl(filePath, expiresIn = 3600) {
    try {
      const { data, error } = await supabase.storage
        .from(this.bucketName)
        .createSignedUrl(filePath, expiresIn)

      if (error) {
        throw new Error(`Failed to get signed URL: ${error.message}`)
      }

      return data.signedUrl
    } catch (error) {
      console.error('Get signed URL error:', error)
      throw error
    }
  }

  /**
   * Extract file path from URL - IMPROVED
   * url - Full URL from storage
   * returns {string} - File path
   */
  extractPathFromUrl(url) {
    try {
      if (!url) return null

      console.log('Extracting path from URL:', url)

      // Handle different URL formats
      if (url.includes('/storage/v1/object/public/')) {
        // Format: https://xxx.supabase.co/storage/v1/object/public/profiles/userId/fileName
        const parts = url.split('/storage/v1/object/public/' + this.bucketName + '/')
        const filePath = parts[1]
        console.log('Extracted path:', filePath)
        return filePath || null
      }

      if (url.includes('/storage/v1/object/sign/')) {
        // Format: https://xxx.supabase.co/storage/v1/object/sign/profiles/userId/fileName?token=xxx
        const parts = url.split('/storage/v1/object/sign/' + this.bucketName + '/')
        const pathWithToken = parts[1]
        const filePath = pathWithToken ? pathWithToken.split('?')[0] : null
        console.log('Extracted path from signed URL:', filePath)
        return filePath
      }

      console.warn('Unknown URL format:', url)
      return null
    } catch (error) {
      console.error('Extract path from URL error:', error)
      return null
    }
  }

  /**
   * Verify bucket configuration
   * returns {Promise<boolean>}
   */
  async verifyBucketConfiguration() {
    try {
      console.log('Verifying bucket configuration...')

      // Check if bucket exists and is public
      const { data: buckets, error } = await supabase.storage.listBuckets()
      
      if (error) {
        console.error('Failed to list buckets:', error)
        return false
      }

      const profilesBucket = buckets.find(bucket => bucket.id === this.bucketName)
      
      if (!profilesBucket) {
        console.error('Profiles bucket not found')
        return false
      }

      console.log('Bucket found:', profilesBucket)
      console.log('Bucket is public:', profilesBucket.public)

      if (!profilesBucket.public) {
        console.warn('Bucket is not public - images may not be accessible')
      }

      return true
    } catch (error) {
      console.error('Bucket verification error:', error)
      return false
    }
  }

  /**
   * Test image upload and access
   * userId - User ID for testing
   * returns {Promise<boolean>}
   */
  async testImageAccess(userId) {
    try {
      console.log('Testing image access for user:', userId)

      // List files for user
      const { data: files, error } = await supabase.storage
        .from(this.bucketName)
        .list(userId)

      if (error) {
        console.error('Failed to list user files:', error)
        return false
      }

      console.log('User files:', files)

      if (files && files.length > 0) {
        const testFile = files[0]
        const filePath = `${userId}/${testFile.name}`
        
        // Get public URL
        const { data: urlData } = supabase.storage
          .from(this.bucketName)
          .getPublicUrl(filePath)

        console.log('Test URL:', urlData.publicUrl)

        // Test URL accessibility
        try {
          const response = await fetch(urlData.publicUrl, { method: 'HEAD' })
          console.log('URL accessibility:', response.status, response.ok)
          return response.ok
        } catch (fetchError) {
          console.error('URL test failed:', fetchError)
          return false
        }
      }

      return true
    } catch (error) {
      console.error('Image access test error:', error)
      return false
    }
  }
}

module.exports = new SupabaseStorageService()