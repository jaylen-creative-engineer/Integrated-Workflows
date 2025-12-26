import { NextResponse } from "next/server";
import { handleCallback } from "../../../_lib/whoopAuth.js";

/**
 * GET /api/auth/whoop/callback
 *
 * Handles OAuth callback from Whoop after user authorization.
 * Exchanges authorization code for access and refresh tokens.
 *
 * Query parameters:
 * - code: Authorization code from Whoop
 * - state: State parameter for CSRF validation
 * - error: Error code if authorization was denied
 * - error_description: Error description
 */
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");
  const errorDescription = searchParams.get("error_description");

  // Handle authorization denial
  if (error) {
    console.error("OAuth authorization error:", error, errorDescription);
    return NextResponse.json(
      {
        error: "Authorization denied",
        error_code: error,
        error_description: errorDescription,
      },
      { status: 400 }
    );
  }

  // Validate required parameters
  if (!code || !state) {
    return NextResponse.json(
      {
        error: "Missing required parameters",
        message: "Both 'code' and 'state' query parameters are required",
      },
      { status: 400 }
    );
  }

  try {
    // Exchange code for tokens
    await handleCallback(code, state);

    // Return success response
    // In a real app, you might redirect to a success page or return JSON
    return NextResponse.json(
      {
        success: true,
        message: "Authorization successful. Tokens have been stored.",
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("OAuth callback error:", error);
    return NextResponse.json(
      {
        error: "Failed to complete OAuth flow",
        message: error.message,
      },
      { status: 500 }
    );
  }
}

