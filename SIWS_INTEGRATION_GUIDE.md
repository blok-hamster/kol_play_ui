# Sign-in with Solana (SIWS) Integration Guide

This guide explains how the Sign-in with Solana (SIWS) authentication has been implemented in your KOL Play application.

## Overview

The implementation includes:
- SIWS authentication service for wallet-based authentication
- Comprehensive authentication UI supporting both wallet and email methods
- Integration with existing user store and notifications
- Support for Phantom and Solflare wallets

## Files Created/Modified

### 1. Services
- `src/services/siws-auth.service.ts` - SIWS authentication service
- `src/services/index.ts` - Updated to export SIWS service
- `src/lib/constants.ts` - Added wallet endpoints and configuration

### 2. Components
- `src/components/auth/wallet-auth.tsx` - Wallet authentication component
- `src/components/auth/authentication-page.tsx` - Complete auth page with wallet/email tabs
- `src/components/wallet/wallet-adapter-provider.tsx` - Updated with multiple wallets

### 3. UI Components
- `src/components/ui/badge.tsx` - Badge component for UI
- `src/components/ui/label.tsx` - Label component for forms
- `src/components/ui/shadcn-tabs.tsx` - Tabs components for auth page

### 4. Demo Page
- `src/app/auth-demo/page.tsx` - Demo page showcasing authentication

## Environment Variables

Add these to your `.env.local`:

```env
# API Configuration
NEXT_PUBLIC_API_URL=http://localhost:5000

# Solana Wallet Configuration
NEXT_PUBLIC_SOLANA_NETWORK=mainnet-beta
NEXT_PUBLIC_DOMAIN=localhost:3000

# App Configuration
NEXT_PUBLIC_APP_NAME=KOL Play
NEXT_PUBLIC_APP_VERSION=1.0.0
```

## Usage

### 1. Basic Authentication Page

```tsx
import { AuthenticationPage } from '@/components/auth/authentication-page';

export default function LoginPage() {
  return (
    <AuthenticationPage
      defaultMode="signin"          // 'signin' | 'signup'
      defaultMethod="wallet"        // 'wallet' | 'email'
      onSuccess={() => {
        // Handle successful authentication
        console.log('User authenticated!');
      }}
    />
  );
}
```

### 2. Wallet Authentication Only

```tsx
import { WalletAuth } from '@/components/auth/wallet-auth';

export default function WalletOnlyAuth() {
  return (
    <WalletAuth
      mode="signin"
      onSuccess={() => {
        console.log('Wallet authentication successful!');
      }}
      onError={(error) => {
        console.error('Auth error:', error);
      }}
    />
  );
}
```

### 3. Using SIWS Service Directly

```tsx
import { SiwsAuthService } from '@/services/siws-auth.service';
import { useWallet } from '@solana/wallet-adapter-react';

export function useWalletAuth() {
  const { signIn } = useWallet();

  const authenticateWallet = async () => {
    try {
      // Create challenge
      const { challenge } = await SiwsAuthService.createChallenge();
      
      // Sign with wallet
      const output = await signIn(challenge);
      
      // Authenticate
      const result = await SiwsAuthService.walletSignIn(challenge, output);
      
      // Store token
      SiwsAuthService.storeToken(result.token);
      
      return result;
    } catch (error) {
      console.error('Authentication failed:', error);
      throw error;
    }
  };

  return { authenticateWallet };
}
```

## API Endpoints Required

Your backend needs to implement these endpoints:

```
POST /wallet/challenge    - Create SIWS challenge
POST /wallet/signup      - Sign up with wallet
POST /wallet/verify      - Sign in with wallet
POST /wallet/link        - Link wallet to existing account
GET  /wallet/info        - Get wallet info
DELETE /wallet/unlink    - Unlink wallet
```

## Backend Integration

The service sends properly formatted SIWS data to your backend:

```typescript
// Challenge creation request
{
  domain: "localhost:3000",
  statement: "Sign in to verify your wallet ownership...",
  uri: "http://localhost:3000",
  resources: []
}

// Authentication request
{
  input: SolanaSignInInput,
  output: {
    account: {
      ...account,
      publicKey: Array.from(publicKey) // Converted to array for JSON
    },
    signature: Array.from(signature),
    signedMessage: Array.from(signedMessage),
    signatureType: "ed25519"
  }
}
```

## Features

### Wallet Support
- ✅ Phantom Wallet
- ✅ Solflare Wallet
- 🔄 Easy to add more wallets

### Authentication Modes
- ✅ Sign In - Authenticate existing wallet
- ✅ Sign Up - Register new account with wallet
- ✅ Link Wallet - Link wallet to existing email account

### User Experience
- ✅ Clear error messages
- ✅ Loading states
- ✅ Mode switching (signin/signup)
- ✅ Method switching (wallet/email)
- ✅ Responsive design

### Security
- ✅ SIWS standard compliance
- ✅ Secure message signing
- ✅ No private key exposure
- ✅ Domain verification

## Testing

Visit `/auth-demo` to test the authentication flow:

1. Connect your wallet (Phantom or Solflare)
2. Click "Sign In with [Wallet]" or "Sign Up with [Wallet]"
3. Sign the message in your wallet
4. Authentication completes successfully

## Error Handling

The implementation handles various error scenarios:

- Wallet not installed
- Wallet connection failed
- Message signing cancelled
- Network errors
- Backend validation errors
- Duplicate wallet registration

## Customization

### Styling
Components use Tailwind CSS classes and can be easily customized.

### Branding
Update `WALLET_CONFIG.STATEMENT` in constants to customize the signing message.

### Additional Wallets
Add more wallets to `wallet-adapter-provider.tsx`:

```tsx
import { SomeOtherWalletAdapter } from '@solana/wallet-adapter-someother';

const wallets = useMemo(
  () => [
    new PhantomWalletAdapter(),
    new SolflareWalletAdapter(),
    new SomeOtherWalletAdapter(), // Add new wallet
  ],
  [network]
);
```

## Integration with Existing Auth

The wallet authentication integrates seamlessly with your existing email/password authentication system:

1. Users can sign up/in with either method
2. Accounts can have both email and wallet authentication
3. Wallet linking allows users to add wallet auth to email accounts
4. Unified user store manages all authentication states

## Next Steps

1. Configure your backend to handle SIWS endpoints
2. Set up proper environment variables
3. Test the authentication flow
4. Customize styling and messaging as needed
5. Add additional wallet adapters if required

The implementation is production-ready and follows security best practices for wallet authentication! 