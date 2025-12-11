# MEGA Storage Setup Guide

## Overview
This system uses MEGA.nz cloud storage to store department profile pictures. When you upload a picture for a department, it is automatically saved to MEGA and the old picture (if any) is deleted.

## Setup Instructions

### 1. Create a MEGA Account
If you don't have a MEGA account, create one at [mega.nz](https://mega.nz)

### 2. Set Environment Variables
Create a `.env.local` file in the root directory of your project and add your MEGA credentials:

```env
MEGA_EMAIL=your-email@example.com
MEGA_PASSWORD=your-mega-password
```

**Important Security Notes:**
- Never commit `.env.local` to version control (it's already in `.gitignore`)
- Use a dedicated MEGA account for this application if possible
- Keep your credentials secure

### 3. How It Works

#### Upload Process:
1. Click on a department's profile picture area
2. Select an image file (JPEG, PNG, GIF, or WebP)
3. The system will:
   - Check if an old picture exists for that department
   - Delete the old picture from MEGA
   - Upload the new picture to MEGA
   - Rename the file based on the department name (e.g., "Computer_Science.jpg")
   - Update the department record with the new image URL

#### File Naming:
- Files are automatically renamed based on the department name
- Special characters are removed and spaces are replaced with underscores
- Example: "Computer Science Department" → "Computer_Science_Department.jpg"

#### Automatic Deletion:
- When uploading a new picture, any existing picture for that department is automatically deleted
- This prevents storage bloat and ensures only one picture per department

## Troubleshooting

### Error: "MEGA credentials not configured"
- Make sure you have created `.env.local` file
- Verify that `MEGA_EMAIL` and `MEGA_PASSWORD` are set correctly
- Restart your development server after adding environment variables

### Error: "Failed to upload image to MEGA"
- Check your internet connection
- Verify your MEGA credentials are correct
- Check if your MEGA account has available storage space
- Ensure the file size is under 5MB

### Image not displaying after upload
- Check browser console for errors
- Verify the MEGA link is accessible
- Try refreshing the page

## File Size Limits
- Maximum file size: 5MB
- Supported formats: JPEG, JPG, PNG, GIF, WebP

## API Endpoints

### Upload Department Image
- **Endpoint:** `/api/upload-department-image`
- **Method:** POST
- **Body:** FormData with `file`, `departmentId`, and `departmentName`

### Delete Department Image
- **Endpoint:** `/api/delete-department-image`
- **Method:** POST
- **Body:** JSON with `departmentId` and `departmentName`
