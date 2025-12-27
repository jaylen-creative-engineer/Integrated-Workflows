import crypto from "crypto";

/**
 * In-memory token storage for single-user scenarios.
 * For multi-user production, extend to use a database.
 * Uses globalThis to persist across Next.js hot reloads in development
 */
const getTokenStore = () => {
  if (!globalThis.__whoopTokenStore) {
    globalThis.__whoopTokenStore = new Map();
  }
  return globalThis.__whoopTokenStore;
};
const tokenStore = getTokenStore();

/**
 * Pending OAuth state values for CSRF protection.
 * Maps state -> { expiresAt, redirectUri }
 * Uses globalThis to persist across Next.js hot reloads in development
 */
const getPendingStates = () => {
  if (!globalThis.__whoopPendingStates) {
    globalThis.__whoopPendingStates = new Map();
  }
  return globalThis.__whoopPendingStates;
};
const pendingStates = getPendingStates();

/**
 * Whoop OAuth configuration
 */
const WHOOP_AUTH_URL = "https://api.prod.whoop.com/oauth/oauth2/auth";
const WHOOP_TOKEN_URL = "https://api.prod.whoop.com/oauth/oauth2/token";

/**
 * Get OAuth configuration from environment variables
 */
function getConfig() {
  const clientId = process.env.WHOOP_CLIENT_ID;
  const clientSecret = process.env.WHOOP_CLIENT_SECRET;
  const redirectUri = process.env.WHOOP_REDIRECT_URI;
  const scopes = process.env.WHOOP_SCOPES || "offline read:recovery read:sleep";
  const refreshBufferSeconds = Number.parseInt(
    process.env.WHOOP_TOKEN_REFRESH_BUFFER_SECONDS || "300",
    10
  );

  if (!clientId || !clientSecret || !redirectUri) {
    throw new Error(
      "Missing required OAuth configuration: WHOOP_CLIENT_ID, WHOOP_CLIENT_SECRET, WHOOP_REDIRECT_URI"
    );
  }

  return {
    clientId,
    clientSecret,
    redirectUri,
    scopes: scopes.split(",").map((s) => s.trim()),
    refreshBufferSeconds,
  };
}

/**
 * Generates a secure 8-character state parameter for CSRF protection.
 * Whoop requires exactly 8 characters.
 */
function generateState() {
  return crypto.randomBytes(4).toString("hex").substring(0, 8);
}

/**
 * Initiates OAuth flow by generating authorization URL with state.
 *
 * @param {string} redirectUri - Optional custom redirect URI (defaults to env var)
 * @returns {{ authUrl: string, state: string }}
 */
export function initiateAuth(redirectUri = null) {
  const config = getConfig();
  const state = generateState();
  const finalRedirectUri = redirectUri || config.redirectUri;

  // Store state with expiration (5 minutes)
  const expiresAt = Date.now() + 5 * 60 * 1000;
  pendingStates.set(state, {
    expiresAt,
    redirectUri: finalRedirectUri,
  });

  // Clean up expired states periodically
  cleanupExpiredStates();

  // Build authorization URL
  const params = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: finalRedirectUri,
    scope: config.scopes.join(" "),
    state: state,
    response_type: "code",
  });

  const authUrl = `${WHOOP_AUTH_URL}?${params.toString()}`;

  return { authUrl, state };
}

/**
 * Validates OAuth state parameter and removes it if valid.
 *
 * @param {string} state - State parameter from callback
 * @returns {boolean} - True if state is valid
 */
function validateAndConsumeState(state) {
  const now = Date.now();
  const pending = pendingStates.get(state);

  if (!pending) {
    return false;
  }

  // Check expiration
  if (now > pending.expiresAt) {
    pendingStates.delete(state);
    return false;
  }

  // Consume state (one-time use)
  pendingStates.delete(state);
  return true;
}

/**
 * Exchanges authorization code for access and refresh tokens.
 *
 * @param {string} code - Authorization code from Whoop
 * @param {string} state - State parameter for CSRF validation
 * @returns {Promise<{ accessToken: string, refreshToken: string, expiresIn: number, scope: string }>}
 */
export async function handleCallback(code, state) {
  // Validate state
  if (!validateAndConsumeState(state)) {
    throw new Error("Invalid or expired state parameter");
  }

  const config = getConfig();

  // Exchange code for tokens
  // OAuth 2.0 token endpoints typically expect application/x-www-form-urlencoded
  const formData = new URLSearchParams({
    grant_type: "authorization_code",
    code: code,
    client_id: config.clientId,
    client_secret: config.clientSecret,
    redirect_uri: config.redirectUri,
  });

  const response = await fetch(WHOOP_TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: formData.toString(),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Token exchange failed: ${response.status} ${errorText}`);
  }

  const data = await response.json();

  if (!data.access_token) {
    throw new Error("Missing access_token in response");
  }

  // Store tokens
  const expiresAt = Date.now() + (data.expires_in || 3600) * 1000;
  tokenStore.set("tokens", {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt: expiresAt,
    scope: data.scope || config.scopes.join(" "),
  });

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresIn: data.expires_in || 3600,
    scope: data.scope || config.scopes.join(" "),
  };
}

/**
 * Refreshes access token using refresh token.
 *
 * @returns {Promise<{ accessToken: string, refreshToken: string, expiresIn: number }>}
 */
async function refreshToken() {
  const tokens = tokenStore.get("tokens");
  if (!tokens || !tokens.refreshToken) {
    throw new Error("No refresh token available. Re-authorization required.");
  }

  const config = getConfig();

  // Prevent concurrent refresh requests
  if (tokens.refreshing) {
    // Wait for ongoing refresh
    return new Promise((resolve, reject) => {
      const checkInterval = setInterval(() => {
        const updatedTokens = tokenStore.get("tokens");
        if (!updatedTokens?.refreshing) {
          clearInterval(checkInterval);
          if (updatedTokens) {
            resolve({
              accessToken: updatedTokens.accessToken,
              refreshToken: updatedTokens.refreshToken,
              expiresIn: Math.floor(
                (updatedTokens.expiresAt - Date.now()) / 1000
              ),
            });
          } else {
            reject(new Error("Token refresh failed"));
          }
        }
      }, 100);
    });
  }

  // Mark as refreshing
  tokens.refreshing = true;
  tokenStore.set("tokens", tokens);

  try {
    // OAuth 2.0 token endpoints typically expect application/x-www-form-urlencoded
    const formData = new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: tokens.refreshToken,
      client_id: config.clientId,
      client_secret: config.clientSecret,
      scope: "offline",
    });

    const response = await fetch(WHOOP_TOKEN_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: formData.toString(),
    });

    if (!response.ok) {
      const errorText = await response.text();
      // Clear tokens if refresh fails
      tokenStore.delete("tokens");
      throw new Error(`Token refresh failed: ${response.status} ${errorText}`);
    }

    const data = await response.json();

    if (!data.access_token) {
      tokenStore.delete("tokens");
      throw new Error("Missing access_token in refresh response");
    }

    // Update tokens (old tokens are invalidated by Whoop)
    const expiresAt = Date.now() + (data.expires_in || 3600) * 1000;
    const newTokens = {
      accessToken: data.access_token,
      refreshToken: data.refresh_token || tokens.refreshToken, // Use new refresh token if provided
      expiresAt: expiresAt,
      scope: data.scope || tokens.scope,
    };

    tokenStore.set("tokens", newTokens);

    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token || tokens.refreshToken,
      expiresIn: data.expires_in || 3600,
    };
  } finally {
    // Remove refreshing flag
    const currentTokens = tokenStore.get("tokens");
    if (currentTokens) {
      delete currentTokens.refreshing;
      tokenStore.set("tokens", currentTokens);
    }
  }
}

/**
 * Gets a valid access token, refreshing if necessary.
 *
 * @returns {Promise<string>} - Valid access token
 */
export async function getAccessToken() {
  const tokens = tokenStore.get("tokens");

  if (!tokens) {
    throw new Error(
      "No access token available. Please authorize the application first."
    );
  }

  const config = getConfig();
  const now = Date.now();
  const timeUntilExpiry = tokens.expiresAt - now;
  const bufferMs = config.refreshBufferSeconds * 1000;

  // Refresh if expired or expiring soon
  if (timeUntilExpiry <= bufferMs) {
    const refreshed = await refreshToken();
    return refreshed.accessToken;
  }

  return tokens.accessToken;
}

/**
 * Checks if tokens are available and valid.
 *
 * @returns {boolean}
 */
export function hasTokens() {
  const tokens = tokenStore.get("tokens");
  if (!tokens) {
    return false;
  }

  const now = Date.now();
  const config = getConfig();
  const bufferMs = config.refreshBufferSeconds * 1000;

  // Consider valid if not expired (or expiring very soon)
  return tokens.expiresAt > now - bufferMs;
}

/**
 * Clears stored tokens (for logout/revocation).
 */
export function clearTokens() {
  tokenStore.delete("tokens");
}

/**
 * Cleans up expired state values from memory.
 */
function cleanupExpiredStates() {
  const now = Date.now();
  for (const [state, data] of pendingStates.entries()) {
    if (now > data.expiresAt) {
      pendingStates.delete(state);
    }
  }
}
