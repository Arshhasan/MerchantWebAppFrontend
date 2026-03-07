# Troubleshooting Phone Authentication - auth/invalid-app-credential

If you're getting `auth/invalid-app-credential` error even though Phone Authentication is enabled, follow these steps:

## Step 1: Verify Authorized Domains

1. Go to Firebase Console → Authentication → Settings → Authorized domains
2. Check that your current domain is listed EXACTLY as shown:
   - For localhost: Should be `localhost` (not `localhost:5173` or `127.0.0.1`)
   - For production: Should match your domain exactly (e.g., `merchant-web-app-frontend.vercel.app`)
3. Click "Add domain" if your domain is missing
4. Wait 2-3 minutes after adding

## Step 2: Check Domain Format

Open browser console and check the current domain:
```javascript
console.log('Current domain:', window.location.hostname);
```

Make sure this EXACT domain is in Firebase Console authorized domains.

## Step 3: Clear Browser Cache

1. Hard refresh: `Ctrl+Shift+R` (Windows) or `Cmd+Shift+R` (Mac)
2. Or clear browser cache completely
3. Try in an incognito/private window

## Step 4: Verify Recaptcha Site Key

The Recaptcha site key should be automatically managed by Firebase. However, if you see errors:

1. Check browser console for Recaptcha errors
2. Look for messages like "Invalid site key" or "Domain not authorized"
3. In Firebase Console → Authentication → Settings, verify the Recaptcha configuration

## Step 5: Check Browser Console Logs

Open browser console (F12) and look for:
- Any Recaptcha-related errors
- Network errors when calling `sendVerificationCode`
- The exact error code and message

## Step 6: Test with Different Browser/Device

Sometimes browser extensions or settings can interfere:
- Try a different browser (Chrome, Firefox, Edge)
- Try on a different device
- Disable browser extensions temporarily

## Step 7: Verify Firebase Project Configuration

1. Go to Firebase Console → Project Settings → General
2. Verify your project ID matches the one in your `.env` file
3. Check that the API key in `.env` matches Firebase Console

## Step 8: Check Billing Status

Even if billing is enabled, check:
1. Firebase Console → Usage and billing
2. Ensure there are no payment issues
3. Verify Phone Authentication quota is available

## Step 9: Network/Firewall Issues

If you're behind a corporate firewall or VPN:
- Try disabling VPN
- Check if firewall is blocking Firebase/Google services
- Try from a different network

## Step 10: Check Firebase Status

1. Visit [Firebase Status Page](https://status.firebase.google.com/)
2. Check if there are any ongoing issues with Authentication service

## Common Issues and Solutions

### Issue: Domain shows as "localhost" but you're using a port
**Solution**: Add `localhost` (without port) to authorized domains. Firebase accepts localhost on any port.

### Issue: Production domain not working
**Solution**: 
- Ensure domain is added without `https://` prefix
- For Vercel: Add both `your-app.vercel.app` and your custom domain if you have one
- Wait 5-10 minutes after adding domain

### Issue: Recaptcha not showing
**Solution**:
- Check browser console for errors
- Ensure JavaScript is enabled
- Try disabling ad blockers
- Check if Recaptcha domain is blocked by firewall

### Issue: Works locally but not in production
**Solution**:
- Double-check production domain is in authorized domains
- Verify environment variables are set correctly in Vercel
- Check Vercel deployment logs for errors

## Still Not Working?

If none of the above works:

1. Check Firebase Console → Authentication → Usage tab for any quota limits
2. Review Firebase Console → Authentication → Settings → Templates for SMS template configuration
3. Contact Firebase Support with:
   - Your project ID
   - The exact error message from browser console
   - Screenshot of authorized domains
   - Browser console network tab showing the failed request

## Debug Information to Collect

When reporting issues, include:
- Browser console logs (F12 → Console tab)
- Network tab showing the failed `sendVerificationCode` request
- Screenshot of Firebase Console → Authentication → Settings → Authorized domains
- Your current domain (from `window.location.hostname`)
- Firebase project ID
