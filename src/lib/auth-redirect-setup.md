# Auth Redirect Setup Guide

This guide explains how to set up the AuthRedirectManager to work with the auth modal system.

## Quick Setup

### Option 1: Using the Hook (Recommended)

Add the setup hook to your root layout or app component:

```tsx
// In your root layout (e.g., app/layout.tsx or pages/_app.tsx)
import { useAuthRedirectSetup } from '@/hooks/use-auth-redirect-setup';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  // Set up auth redirect with modal opener
  useAuthRedirectSetup();

  return (
    <html>
      <body>
        {children}
        {/* Make sure AuthModalWrapper is included */}
        <AuthModalWrapper />
      </body>
    </html>
  );
}
```

### Option 2: Manual Setup

If you prefer manual setup:

```tsx
import { useEffect } from 'react';
import { useModal } from '@/stores/use-ui-store';
import { AuthRedirectManager } from '@/lib/auth-redirect';

function MyApp() {
  const { openModal } = useModal();

  useEffect(() => {
    AuthRedirectManager.setModalOpener(openModal);
  }, [openModal]);

  return <YourAppContent />;
}
```

## How It Works

1. **Authentication Errors**: When the API client detects 401/403 errors, it calls `AuthRedirectManager.redirectToSignin()`
2. **URL Preservation**: The current URL is automatically preserved (unless it's an auth-related page)
3. **Modal Opening**: Instead of redirecting to `/login`, the auth modal opens with the signin tab active
4. **Post-Login Redirect**: After successful authentication, users are automatically redirected to their preserved URL

## Key Features

- **No Page Redirects**: Uses modal system instead of page navigation
- **URL Preservation**: Automatically saves and restores user's location
- **Duplicate Prevention**: Prevents multiple simultaneous auth modals
- **Fallback Support**: Falls back to home page if modal system isn't available

## API Reference

### AuthRedirectManager Methods

- `redirectToSignin(preserveUrl?: boolean)` - Opens auth modal with optional URL preservation
- `handleSuccessfulAuth()` - Handles post-login redirect to preserved URL
- `preserveCurrentUrl()` - Manually preserve current URL
- `getPreservedUrl()` - Get the preserved URL
- `clearPreservedUrl()` - Clear the preserved URL
- `clearAll()` - Clear all redirect-related data
- `setModalOpener(opener)` - Set the modal opener function (done automatically by hook)

### Hook

- `useAuthRedirectSetup()` - Sets up the modal opener for AuthRedirectManager

## Integration with Existing Code

The AuthRedirectManager is already integrated with:

- ✅ API Client (`src/lib/api.ts`) - Handles 401/403 errors automatically
- ✅ Auth Modal (`src/components/auth/auth-modal.tsx`) - Opens with signin tab
- ✅ Auth Service - Calls `handleSuccessfulAuth()` after login

No additional changes needed to existing authentication flows!