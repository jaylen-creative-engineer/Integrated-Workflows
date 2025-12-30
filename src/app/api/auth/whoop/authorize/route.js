import { NextResponse } from "next/server";
import { initiateAuth } from "../../../_lib/whoop/whoopAuth.js";

/**
 * GET /api/auth/whoop/authorize
 *
 * Initiates OAuth 2.0 Authorization Code flow by redirecting user to Whoop authorization page.
 *
 * After user authorizes, Whoop will redirect to the callback URL with an authorization code.
 */
export async function GET(request) {
  try {
    const { authUrl } = initiateAuth();

    // Redirect user to Whoop authorization page
    return NextResponse.redirect(authUrl);
  } catch (error) {
    console.error("OAuth initiation error:", error);
    return NextResponse.json(
      {
        error: "Failed to initiate OAuth flow",
        message: error.message,
      },
      { status: 500 }
    );
  }
}
