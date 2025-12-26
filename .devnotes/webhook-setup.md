# WHOOP Webhook and OAuth Setup

## Environment Variables

### Required for Webhooks

- `WHOOP_WEBHOOK_SECRET` - The webhook secret from your WHOOP app configuration. Used to validate `X-WHOOP-Signature` headers.

### Required for OAuth (Outbound API Requests)

- `WHOOP_CLIENT_ID` - Client ID from your WHOOP app in the Developer Dashboard
- `WHOOP_CLIENT_SECRET` - Client Secret from your WHOOP app in the Developer Dashboard
- `WHOOP_REDIRECT_URI` - Registered redirect URI (must match exactly what's configured in Developer Dashboard)
  - Example: `https://yourdomain.com/api/auth/whoop/callback`
  - For local development: `http://localhost:3000/api/auth/whoop/callback`

### Optional

- `WHOOP_WEBHOOK_TOLERANCE_SECONDS` - Maximum age of webhook timestamp in seconds (default: 300). Prevents replay attacks by rejecting requests with timestamps too far in the past or future.
- `WHOOP_SCOPES` - Comma-separated OAuth scopes (default: `offline read:recovery read:sleep`)
  - Must include `offline` to receive refresh tokens
  - Common scopes: `offline`, `read:recovery`, `read:sleep`, `read:workout`, `read:profile`
- `WHOOP_TOKEN_REFRESH_BUFFER_SECONDS` - Refresh tokens N seconds before expiry (default: 300)

## Webhook Headers

WHOOP webhooks include the following headers that are validated by `withWhoop`:

- `X-WHOOP-Signature` - Base64-encoded HMAC-SHA256 signature of `timestamp + rawBody`
- `X-WHOOP-Signature-Timestamp` - Unix timestamp (milliseconds) used in signature computation
  - Also accepts `X-WHOOP-Timestamp` as a fallback

## Signature Validation

The `withWhoop` higher-order function validates webhook requests by:

1. Reading the raw request body
2. Extracting `X-WHOOP-Signature` and `X-WHOOP-Signature-Timestamp` headers
3. Verifying the timestamp is within the tolerance window (replay protection)
4. Computing the expected signature: `base64(HMAC_SHA256(secret, timestamp + rawBody))`
5. Comparing signatures using constant-time comparison (prevents timing attacks)

If validation fails, the request is rejected with a 401 status.

## OAuth 2.0 Authorization Flow

Whoop uses OAuth 2.0 Authorization Code flow for API access. To authorize your application:

1. Visit `/api/auth/whoop/authorize` in your browser
2. You'll be redirected to Whoop to authorize the application
3. After authorization, Whoop redirects to `/api/auth/whoop/callback`
4. Tokens are automatically stored and refreshed as needed

**Important:** The redirect URI must be registered in your Whoop Developer Dashboard before use.

### Redirect URI Registration

In your Whoop Developer Dashboard:
1. Go to your app settings
2. Add the redirect URI: `https://yourdomain.com/api/auth/whoop/callback`
3. For local development, also add: `http://localhost:3000/api/auth/whoop/callback`

## Usage

### Inbound Mode (Webhook Validation)

Routes receiving webhooks from Whoop automatically validate signatures. The parsed JSON body is available in the handler's context:

```javascript
import { withWhoop } from "../_lib/withWhoop.js";

async function handler(request, ctx) {
  const body = ctx.json; // Already parsed
  // ... handler logic
}

export const POST = withWhoop(handler);
// or explicitly:
export const POST = withWhoop(handler, { mode: 'inbound' });
```

### Outbound Mode (API Requests)

Routes making requests to Whoop API receive an authenticated fetch helper:

```javascript
import { withWhoop } from "../_lib/withWhoop.js";

async function handler(request, ctx) {
  // ctx.whoopFetch automatically includes Bearer token
  const response = await ctx.whoopFetch('/v2/recovery?start=2024-01-01&end=2024-01-02');
  const data = await response.json();
  
  // Token is automatically refreshed if expired
  return NextResponse.json(data);
}

export const GET = withWhoop(handler, { mode: 'outbound' });
```

The `ctx.whoopFetch()` helper:
- Automatically includes `Authorization: Bearer {token}` header
- Handles token refresh on 401 responses
- Accepts relative URLs (prepends `https://api.prod.whoop.com`)
- Accepts absolute URLs as-is

### Options

```javascript
withWhoop(handler, {
  mode: 'inbound' | 'outbound',  // Default: 'inbound'
  requireSignature: boolean,     // For inbound: require webhook validation (default: true)
  requireAuth: boolean,          // For outbound: require valid token (default: true)
  secretEnvVar: string,         // Webhook secret env var name (default: 'WHOOP_WEBHOOK_SECRET')
  toleranceSeconds: number,      // Webhook timestamp tolerance (default: 300)
})
```

## Local Testing

For local development/testing without signature validation:

```javascript
export const POST = withWhoop(handler, { requireSignature: false });
```

For testing without OAuth (outbound mode):

```javascript
export const GET = withWhoop(handler, { mode: 'outbound', requireAuth: false });
```

## Token Management

- Tokens are stored in-memory (single-user scenarios)
- Access tokens are automatically refreshed before expiration
- Refresh tokens are used to obtain new access tokens
- If refresh fails, re-authorization is required

## References

- [WHOOP Webhook Documentation](https://developer.whoop.com/docs/developing/webhooks/)
- [WHOOP OAuth 2.0 Documentation](https://developer.whoop.com/docs/developing/oauth)

