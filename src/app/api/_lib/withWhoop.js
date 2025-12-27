import { NextResponse } from "next/server";
import crypto from "crypto";
import { getAccessToken } from "./whoopAuth.js";
import { WhoopService } from "../../../services/whoopService.js";

/**
 * Constant-time string comparison to prevent timing attacks
 */
function safeCompare(a, b) {
  if (a.length !== b.length) {
    return false;
  }
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

/**
 * Validates WHOOP webhook signature and timestamp.
 *
 * @param {NextRequest} request - The incoming request
 * @param {string} rawBody - The raw request body as string
 * @param {string} secret - The webhook secret from environment
 * @param {number} toleranceSeconds - Maximum age of timestamp in seconds
 * @returns {{ valid: boolean, error?: string }}
 */
function validateWhoopSignature(request, rawBody, secret, toleranceSeconds) {
  const signature = request.headers.get("X-WHOOP-Signature");
  const timestamp =
    request.headers.get("X-WHOOP-Signature-Timestamp") ||
    request.headers.get("X-WHOOP-Timestamp");

  if (!signature || !timestamp) {
    return {
      valid: false,
      error: "Missing X-WHOOP-Signature or X-WHOOP-Signature-Timestamp header",
    };
  }

  // Validate timestamp is within tolerance (replay protection)
  const timestampMs = parseInt(timestamp, 10);
  if (!Number.isFinite(timestampMs)) {
    return { valid: false, error: "Invalid timestamp format" };
  }

  const nowMs = Date.now();
  const ageSeconds = Math.abs(nowMs - timestampMs) / 1000;
  if (ageSeconds > toleranceSeconds) {
    return {
      valid: false,
      error: `Timestamp too old or too far in future (age: ${ageSeconds.toFixed(
        1
      )}s, max: ${toleranceSeconds}s)`,
    };
  }

  // Compute expected signature: base64(HMAC_SHA256(secret, timestamp + rawBody))
  const hmac = crypto.createHmac("sha256", secret);
  hmac.update(timestamp + rawBody);
  const expectedSignature = hmac.digest("base64");

  // Constant-time comparison
  if (!safeCompare(signature, expectedSignature)) {
    return { valid: false, error: "Invalid signature" };
  }

  return { valid: true };
}

/**
 * Wraps a Next.js API route handler to validate WHOOP webhook signatures (inbound)
 * or provide OAuth authentication for outbound API requests.
 *
 * Inbound mode (default) - validates webhook signatures:
 *   export const POST = withWhoop(async (request, ctx) => {
 *     const body = ctx.json;
 *     // ... handler logic
 *   });
 *
 * Outbound mode - provides OAuth token for making API requests:
 *   export const GET = withWhoop(async (request, ctx) => {
 *     const response = await ctx.whoopFetch('/v2/recovery?start=...');
 *     // ... handler logic
 *   }, { mode: 'outbound' });
 *
 * @param {Function} handler - Route handler (request, ctx) => NextResponse
 * @param {Object} options - Configuration options
 * @param {'inbound'|'outbound'} options.mode - 'inbound' for webhook validation, 'outbound' for OAuth (default: 'inbound')
 * @param {string} options.secretEnvVar - Environment variable name for webhook secret (default: "WHOOP_WEBHOOK_SECRET")
 * @param {number} options.toleranceSeconds - Max timestamp age in seconds for webhooks (default: 300)
 * @param {boolean} options.requireSignature - Whether to require webhook validation (default: true, inbound only)
 * @param {boolean} options.requireAuth - Whether to require valid OAuth token (default: true, outbound only)
 * @returns {Function} Wrapped handler
 */
export function withWhoop(handler, options = {}) {
  const {
    mode = "inbound",
    secretEnvVar = "WHOOP_CLIENT_SECRET",
    toleranceSeconds = Number.parseInt(
      process.env.WHOOP_WEBHOOK_TOLERANCE_SECONDS || "300",
      10
    ),
    requireSignature = true,
    requireAuth = true,
  } = options;

  return async (request, ctx) => {
    // OUTBOUND MODE: Provide OAuth token for making API requests
    if (mode === "outbound") {
      try {
        // Get access token (will refresh if needed)
        const accessToken = await getAccessToken();

        // Provide WhoopService instance that manages auth internally
        const whoopService = new WhoopService({ accessToken });

        // Create context with service instance and raw token if needed
        const handlerCtx = {
          ...ctx,
          accessToken,
          whoopService,
        };

        return handler(request, handlerCtx);
      } catch (error) {
        if (requireAuth) {
          console.error("OAuth token error:", error);
          return NextResponse.json(
            {
              error: "Authentication required",
              message: error.message,
              hint: "Visit /api/auth/whoop/authorize to authorize the application",
            },
            { status: 401 }
          );
        }
        // If auth not required, continue without token
        return handler(request, ctx);
      }
    }

    // INBOUND MODE: Validate webhook signatures (existing behavior)
    // If signature validation is disabled (e.g., for development), skip validation
    if (!requireSignature) {
      return handler(request, ctx);
    }

    // Get secret from environment
    const secret = process.env[secretEnvVar];
    if (!secret) {
      console.error(
        `Missing ${secretEnvVar} environment variable for WHOOP webhook validation`
      );
      return NextResponse.json(
        { error: "Server configuration error" },
        { status: 500 }
      );
    }

    // Read raw body for signature validation
    // Clone the request so the handler can still read the body
    let rawBody;
    try {
      rawBody = await request.clone().text();
    } catch (err) {
      return NextResponse.json(
        { error: "Failed to read request body" },
        { status: 400 }
      );
    }

    // Validate signature
    const validation = validateWhoopSignature(
      request,
      rawBody,
      secret,
      toleranceSeconds
    );

    if (!validation.valid) {
      return NextResponse.json({ error: validation.error }, { status: 401 });
    }

    // Parse JSON body once and attach to context to avoid double-parsing
    let parsedBody;
    try {
      parsedBody = JSON.parse(rawBody);
    } catch (err) {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    // Create context with parsed body
    const handlerCtx = {
      ...ctx,
      json: parsedBody,
    };

    // Signature valid, proceed with handler
    return handler(request, handlerCtx);
  };
}
