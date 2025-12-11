# Debug Guide: Department Image Upload Issues

## 🔍 Step-by-Step Debugging

### 1. Check MEGA Credentials
```bash
# Verify .env.local exists and has credentials
cat .env.local | grep MEGA
```

**Expected output:**
```
MEGA_EMAIL=your-email@example.com
MEGA_PASSWORD=your-password
```

**If missing:**
- Create `.env.local` in project root
- Add MEGA credentials
- Restart development server

### 2. Check Browser Console
Open browser DevTools (F12) and check:
- Network tab: Look for `/api/upload-department-image` request
- Console tab: Look for error messages
- Check request status code and response

### 3. Check Server Logs
Look at terminal/console where `npm run dev` is running:
- Check for MEGA connection errors
- Check for timeout errors
- Check for authentication errors

### 4. Test MEGA Connection
The system will automatically:
- Retry connection 3 times
- Show clear error messages
- Handle timeouts gracefully

### 5. Common Issues & Solutions

#### Issue: "MEGA credentials not configured"
**Solution:**
1. Create `.env.local` file in project root
2. Add:
   ```
   MEGA_EMAIL=your-email@example.com
   MEGA_PASSWORD=your-password
   ```
3. Restart development server

#### Issue: "Connection timeout"
**Solution:**
- Check internet connection
- MEGA servers might be temporarily unavailable
- Try again after a few minutes
- Check if MEGA.nz website is accessible

#### Issue: "Authentication failed"
**Solution:**
- Verify MEGA email and password are correct
- Check if MEGA account is active
- Try logging into MEGA.nz website with same credentials

#### Issue: "Department not found"
**Solution:**
- Refresh the page
- Department might have been deleted
- Check if department exists in database

#### Issue: Upload button not working
**Solution:**
- Check browser console for JavaScript errors
- Verify file input is clickable (not blocked by other elements)
- Try clicking directly on the image area

### 6. Manual Testing Steps

1. **Click on department image area**
   - Should open file picker
   - If not, check browser console

2. **Select an image file**
   - Should show loading spinner
   - If not, check if file is valid (JPEG, PNG, GIF, WebP, max 5MB)

3. **Wait for upload**
   - Should show success toast
   - Image should update immediately
   - If error, check toast message for details

### 7. API Endpoint Testing

Test the API directly:
```bash
curl -X POST http://localhost:3000/api/upload-department-image \
  -F "file=@test-image.jpg" \
  -F "departmentId=test-id" \
  -F "departmentName=Test Department"
```

### 8. Check File Permissions
- Ensure MEGA account has storage space
- Check if account is not suspended
- Verify account can upload files manually on MEGA.nz

## 📊 Error Code Reference

| Error Code | Meaning | Solution |
|------------|---------|----------|
| `UND_ERR_CONNECT_TIMEOUT` | Connection timeout | Check internet, retry |
| `401` | Authentication failed | Check MEGA credentials |
| `503` | Service unavailable | MEGA servers down, retry later |
| `400` | Bad request | Check file type/size |
| `404` | Department not found | Refresh page |

## ✅ Success Indicators

When upload works correctly:
1. ✅ Loading spinner appears
2. ✅ Success toast shows
3. ✅ Image updates immediately
4. ✅ Image persists after page refresh
5. ✅ Old image is deleted (if existed)
