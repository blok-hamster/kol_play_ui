# API Keys Management

This document describes how to use the API Keys management feature in the application.

## Overview

The API Keys feature allows users to generate, manage, and revoke API keys for programmatic access to the platform. This is useful for:

- Building custom trading bots
- Integrating with third-party applications
- Automating trading strategies
- Accessing platform data programmatically

## Accessing API Keys Management

1. Navigate to **Settings** page
2. Click on the **API Keys** tab
3. You'll see a list of your existing API keys and options to create new ones

## Creating an API Key

1. Click the **"Create New Key"** button
2. Enter a descriptive name for your key (e.g., "Production Bot", "Mobile App")
3. Select the permissions you want to grant:
   - **Read Access**: Allows reading data (portfolio, trades, tokens)
   - **Write Access**: Allows executing trades and modifying settings
4. Click **"Create API Key"**
5. **IMPORTANT**: Copy your API key immediately - it will only be shown once!

## Using API Keys

### Authentication

Include your API key in the request headers:

```bash
curl -H "Authorization: Bearer YOUR_API_KEY" \
  http://localhost:5000/api/endpoint
```

### Example: Get User API Keys

```bash
curl -H "Authorization: Bearer YOUR_API_KEY" \
  http://localhost:5000/api/keys
```

### Example: Create a New API Key

```bash
curl -X POST \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"name": "My New Key", "permissions": ["read", "write"]}' \
  http://localhost:5000/api/keys
```

### Example: Revoke an API Key

```bash
curl -X DELETE \
  -H "Authorization: Bearer YOUR_API_KEY" \
  http://localhost:5000/api/keys/KEY_ID
```

## Managing API Keys

### View All Keys

The API Keys page displays:
- Key name
- Status (Active/Revoked)
- Permissions
- Creation date
- Last used date

### Revoke a Key

1. Find the key you want to revoke
2. Click the **"Revoke"** button
3. Confirm the action
4. The key will be immediately deactivated

**Note**: Revoked keys cannot be reactivated. You'll need to create a new key if needed.

## Security Best Practices

1. **Never share your API keys** - Treat them like passwords
2. **Don't commit keys to version control** - Use environment variables
3. **Use separate keys for different applications** - Makes it easier to revoke if compromised
4. **Rotate keys regularly** - Create new keys and revoke old ones periodically
5. **Use minimal permissions** - Only grant the permissions you need
6. **Monitor key usage** - Check the "Last used" date to detect unauthorized access
7. **Revoke immediately if compromised** - Don't wait if you suspect a key has been exposed

## API Endpoints

### Base URL
```
http://localhost:5000/api/keys
```

### Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/keys` | Create a new API key |
| GET | `/api/keys` | List all API keys |
| DELETE | `/api/keys/:keyId` | Revoke an API key |

### Request/Response Examples

#### Create API Key

**Request:**
```json
POST /api/keys
{
  "name": "Production Bot",
  "permissions": ["read", "write"]
}
```

**Response:**
```json
{
  "message": "API key created successfully",
  "apiKey": "kp_live_abc123...",
  "keyInfo": {
    "id": "key_123",
    "name": "Production Bot",
    "permissions": ["read", "write"],
    "createdAt": "2025-12-03T10:00:00Z"
  },
  "warning": "Save this API key securely. It will not be shown again."
}
```

#### List API Keys

**Request:**
```
GET /api/keys
```

**Response:**
```json
{
  "apiKeys": [
    {
      "id": "key_123",
      "name": "Production Bot",
      "permissions": ["read", "write"],
      "isActive": true,
      "lastUsedAt": "2025-12-03T09:30:00Z",
      "expiresAt": null,
      "createdAt": "2025-12-03T08:00:00Z"
    }
  ],
  "count": 1
}
```

#### Revoke API Key

**Request:**
```
DELETE /api/keys/key_123
```

**Response:**
```json
{
  "message": "API key revoked successfully",
  "keyId": "key_123"
}
```

## Troubleshooting

### "API key not found" error
- The key may have been revoked
- Check that you're using the correct key ID
- Verify you own the key you're trying to access

### "User not authenticated" error
- Your JWT token or API key is invalid or expired
- Sign in again to get a new token
- Check that you're including the Authorization header correctly

### "Failed to create API key" error
- Ensure you've provided a name for the key
- Check that you're authenticated
- Verify the backend server is running

## Support

If you encounter any issues with API keys, please:
1. Check the browser console for error messages
2. Verify your authentication status
3. Ensure the backend server is running on `http://localhost:5000`
4. Contact support with the error details
