# Vercel Deployment Troubleshooting Guide

## Issue: Ads/Offers Not Showing in Vercel (But Work Locally)

### Changes Made

1. **Added comprehensive logging** - Check browser console for detailed logs
2. **Added fallback fetch** - Data loads even if real-time listener fails
3. **Removed Firestore index dependency** - Queries no longer require composite indexes

### Debugging Steps

#### 1. Check Browser Console

Open your Vercel deployment and check the browser console (F12 → Console tab). Look for:

```
Ads: Starting fetch for user: [USER_ID]
Ads: User object: { uid: "...", email: "..." }
Ads: Using fallback fetch method
Ads: Fallback fetch result: { success: true/false, data: [...] }
Ads: Fallback fetch successful, count: [NUMBER]
```

**If you see errors:**
- `Missing environment variable VITE_FIREBASE_*` → Environment variables not set in Vercel
- `Permission denied` → Firestore security rules issue (but your rules allow all, so unlikely)
- `Failed to get document` → Firebase connection issue

#### 2. Verify Environment Variables in Vercel

1. Go to your Vercel project dashboard
2. Navigate to **Settings** → **Environment Variables**
3. Verify these variables are set:
   - `VITE_FIREBASE_API_KEY`
   - `VITE_FIREBASE_AUTH_DOMAIN`
   - `VITE_FIREBASE_DATABASE_URL`
   - `VITE_FIREBASE_PROJECT_ID`
   - `VITE_FIREBASE_STORAGE_BUCKET`
   - `VITE_FIREBASE_MESSAGING_SENDER_ID`
   - `VITE_FIREBASE_APP_ID`
   - `VITE_FIREBASE_MEASUREMENT_ID` (optional)

4. **Important**: After adding/updating environment variables:
   - Go to **Deployments** tab
   - Click the **3 dots** (⋯) on the latest deployment
   - Click **Redeploy**

#### 3. Check Authentication State

In the browser console, check if user is authenticated:

```javascript
// In console, check if user exists
// The app should log: "Ads: User object: { uid: "...", email: "..." }"
```

If `user` is `null`:
- User might not be logged in
- Auth state might not be persisting
- Check Firebase Auth settings in Firebase Console

#### 4. Verify Firestore Data

1. Go to Firebase Console → Firestore Database
2. Navigate to `merchant_ads` collection
3. Verify documents exist with:
   - `merchantId` field matching your user's UID
   - `createdAt` timestamp

#### 5. Check Network Tab

1. Open browser DevTools → **Network** tab
2. Filter by "firestore"
3. Look for failed requests (red status codes)
4. Check request/response details

### Common Issues & Solutions

#### Issue: "Missing environment variable"
**Solution**: Add all `VITE_FIREBASE_*` variables to Vercel and redeploy

#### Issue: "Permission denied" or "Missing or insufficient permissions"
**Solution**: Your current rules allow all access, so this shouldn't happen. But if it does:
- Check Firebase Console → Firestore → Rules
- Ensure rules match what's in `FIRESTORE_SECURITY_RULES.md`

#### Issue: Data loads but doesn't display
**Solution**: 
- Check console for JavaScript errors
- Verify `ads.length` in console logs
- Check if React component is rendering (inspect DOM)

#### Issue: Real-time listener fails silently
**Solution**: The fallback fetch will still load data. Check console for:
```
Ads: Real-time listener error: [ERROR]
```

### Testing Checklist

- [ ] All environment variables set in Vercel
- [ ] Deployment redeployed after adding env vars
- [ ] User is authenticated (check console logs)
- [ ] Documents exist in Firestore with correct `merchantId`
- [ ] Browser console shows no Firebase errors
- [ ] Network tab shows successful Firestore requests

### Next Steps

If ads still don't show after checking all above:

1. **Share console logs** - Copy all console output related to "Ads:"
2. **Check Firebase Console** - Verify documents exist and have correct structure
3. **Test locally** - Ensure it still works locally with same Firebase project
4. **Compare environments** - Check if local `.env` matches Vercel env vars
