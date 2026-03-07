# Firebase Phone Authentication Setup Guide

If you're seeing the error `auth/invalid-app-credential`, follow these steps to configure Firebase Phone Authentication:

## Step 1: Enable Phone Authentication in Firebase Console

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project
3. Navigate to **Authentication** → **Sign-in method**
4. Find **Phone** in the list
5. Click on it and **Enable** it
6. Click **Save**

## Step 2: Configure Authorized Domains

1. In Firebase Console, go to **Authentication** → **Settings** → **Authorized domains**
2. Add your domains:
   - `localhost` (for local development)
   - Your production domain (e.g., `merchant-web-app-frontend.vercel.app`)
   - Your custom domain if you have one

## Step 3: Verify Recaptcha Configuration

Firebase automatically creates a Recaptcha site key for your project. Make sure:

1. Go to **Authentication** → **Settings** → **Authorized domains**
2. Ensure your domain is listed
3. The Recaptcha key is automatically managed by Firebase

## Step 4: Test Phone Authentication

1. Use a valid phone number format: `+[country code][number]`
   - Example: `+919971433169` (India)
   - Example: `+1234567890` (USA)

2. Make sure you're testing on an authorized domain

## Common Issues and Solutions

### Error: `auth/invalid-app-credential`
- **Solution**: Enable Phone Authentication in Firebase Console (Step 1)
- **Solution**: Add your domain to Authorized domains (Step 2)

### Error: `auth/invalid-phone-number`
- **Solution**: Ensure phone number includes country code (e.g., `+91` for India)

### Error: `auth/too-many-requests`
- **Solution**: Wait a few minutes before trying again. Firebase limits OTP requests.

### Recaptcha not showing
- **Solution**: Check browser console for errors
- **Solution**: Ensure you're on an authorized domain
- **Solution**: Clear browser cache and try again

## Testing

1. **Local Development**: Use `http://localhost:5173` (or your Vite port)
2. **Production**: Use your deployed domain

## Notes

- Phone Authentication uses Firebase's built-in Recaptcha (no manual setup needed)
- The Recaptcha widget will appear below the phone input field
- Users need to complete Recaptcha before OTP is sent
- OTP codes expire after a few minutes

## Support

If issues persist:
1. Check Firebase Console → Authentication → Usage tab for quotas
2. Verify your Firebase project has billing enabled (required for Phone Auth)
3. Check Firebase Console logs for detailed error messages
