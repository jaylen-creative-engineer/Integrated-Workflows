import { getSupabaseAdmin } from "./supabaseClient.js";

/**
 * Session status constants
 */
export const SessionStatus = {
  ACTIVE: "active",
  COMPLETED: "completed",
  ERROR: "error",
};

/**
 * Generates a unique session ID using crypto.randomUUID()
 * @returns {string} UUID v4 session identifier
 */
export function generateSessionId() {
  return crypto.randomUUID();
}

/**
 * Creates a new session in the database.
 *
 * @param {object} params
 * @param {string} params.sessionId - Unique session identifier
 * @param {string} params.userId - User identifier
 * @param {string} [params.conversationGoal] - Initial prompt/goal for the session
 * @returns {Promise<{ success: boolean, session?: object, error?: string }>}
 */
export async function createSession({ sessionId, userId, conversationGoal }) {
  if (!sessionId || !userId) {
    return { success: false, error: "sessionId and userId are required" };
  }

  try {
    const supabase = getSupabaseAdmin();

    const { data, error } = await supabase
      .from("agent_sessions")
      .insert({
        session_id: sessionId,
        user_id: userId,
        conversation_goal: conversationGoal || null,
        status: SessionStatus.ACTIVE,
      })
      .select()
      .single();

    if (error) {
      // Handle unique constraint violation (session already exists)
      if (error.code === "23505") {
        return { success: false, error: "Session already exists" };
      }
      throw error;
    }

    return { success: true, session: data };
  } catch (error) {
    console.error("[agentSessionStorage] createSession failed:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Retrieves a session and its conversation history.
 *
 * @param {string} sessionId - The session identifier
 * @returns {Promise<{ success: boolean, session?: object, history?: object[], error?: string }>}
 */
export async function getSession(sessionId) {
  if (!sessionId) {
    return { success: false, error: "sessionId is required" };
  }

  try {
    const supabase = getSupabaseAdmin();

    // Fetch session metadata
    const { data: session, error: sessionError } = await supabase
      .from("agent_sessions")
      .select("*")
      .eq("session_id", sessionId)
      .single();

    if (sessionError) {
      if (sessionError.code === "PGRST116") {
        // No rows returned
        return { success: false, error: "Session not found" };
      }
      throw sessionError;
    }

    // Fetch conversation history ordered by creation time
    const { data: history, error: historyError } = await supabase
      .from("agent_conversations")
      .select("*")
      .eq("session_id", sessionId)
      .order("created_at", { ascending: true });

    if (historyError) {
      throw historyError;
    }

    return {
      success: true,
      session,
      history: history || [],
    };
  } catch (error) {
    console.error("[agentSessionStorage] getSession failed:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Checks if a session exists.
 *
 * @param {string} sessionId - The session identifier
 * @returns {Promise<boolean>}
 */
export async function sessionExists(sessionId) {
  if (!sessionId) return false;

  try {
    const supabase = getSupabaseAdmin();

    const { data, error } = await supabase
      .from("agent_sessions")
      .select("id")
      .eq("session_id", sessionId)
      .limit(1);

    if (error) {
      console.error("[agentSessionStorage] sessionExists check failed:", error);
      return false;
    }

    return (data?.length || 0) > 0;
  } catch (error) {
    console.error("[agentSessionStorage] sessionExists failed:", error);
    return false;
  }
}

/**
 * Saves a message to the conversation history.
 *
 * @param {object} params
 * @param {string} params.sessionId - Session identifier
 * @param {string} params.role - Message role ('user' or 'assistant')
 * @param {string} params.content - Message content
 * @param {object} [params.metadata] - Optional metadata (tool calls, events, etc.)
 * @returns {Promise<{ success: boolean, message?: object, error?: string }>}
 */
export async function saveMessage({ sessionId, role, content, metadata }) {
  if (!sessionId || !role || !content) {
    return {
      success: false,
      error: "sessionId, role, and content are required",
    };
  }

  if (!["user", "assistant"].includes(role)) {
    return { success: false, error: "role must be 'user' or 'assistant'" };
  }

  try {
    const supabase = getSupabaseAdmin();

    const { data, error } = await supabase
      .from("agent_conversations")
      .insert({
        session_id: sessionId,
        role,
        content,
        metadata: metadata || null,
      })
      .select()
      .single();

    if (error) {
      throw error;
    }

    return { success: true, message: data };
  } catch (error) {
    console.error("[agentSessionStorage] saveMessage failed:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Updates the session with agent output and status.
 *
 * @param {object} params
 * @param {string} params.sessionId - Session identifier
 * @param {string} [params.agentOutput] - Summary output from agent
 * @param {string} [params.status] - New session status
 * @returns {Promise<{ success: boolean, session?: object, error?: string }>}
 */
export async function updateSessionOutput({ sessionId, agentOutput, status }) {
  if (!sessionId) {
    return { success: false, error: "sessionId is required" };
  }

  try {
    const supabase = getSupabaseAdmin();

    const updates = {};
    if (agentOutput !== undefined) updates.agent_output = agentOutput;
    if (status !== undefined) updates.status = status;

    if (Object.keys(updates).length === 0) {
      return { success: false, error: "No updates provided" };
    }

    const { data, error } = await supabase
      .from("agent_sessions")
      .update(updates)
      .eq("session_id", sessionId)
      .select()
      .single();

    if (error) {
      throw error;
    }

    return { success: true, session: data };
  } catch (error) {
    console.error("[agentSessionStorage] updateSessionOutput failed:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Extracts the final assistant response from agent events.
 * Parses the events array to find the last assistant message content.
 *
 * @param {unknown[]} events - Array of agent execution events
 * @returns {string | null} - Extracted text content or null
 */
export function extractAgentOutput(events) {
  if (!Array.isArray(events) || events.length === 0) {
    return null;
  }

  // Look for LLM response events with text content
  // Events may have different structures, so we check multiple patterns
  let lastAssistantText = null;

  for (const event of events) {
    if (!event || typeof event !== "object") continue;

    const eventObj = event;

    // Pattern 1: Check for content.parts with text
    if (eventObj.content?.parts) {
      for (const part of eventObj.content.parts) {
        if (part?.text) {
          lastAssistantText = part.text;
        }
      }
    }

    // Pattern 2: Check for message.parts
    if (eventObj.message?.parts) {
      for (const part of eventObj.message.parts) {
        if (part?.text) {
          lastAssistantText = part.text;
        }
      }
    }

    // Pattern 3: Direct text property
    if (eventObj.text && typeof eventObj.text === "string") {
      lastAssistantText = eventObj.text;
    }

    // Pattern 4: Check for response text in various locations
    if (eventObj.response?.text) {
      lastAssistantText = eventObj.response.text;
    }
  }

  return lastAssistantText;
}

/**
 * Gets or creates a session. If sessionId is provided and exists, returns it.
 * If sessionId is provided but doesn't exist, creates it.
 * If no sessionId is provided, generates a new one and creates the session.
 *
 * @param {object} params
 * @param {string} [params.sessionId] - Optional existing session ID
 * @param {string} params.userId - User identifier
 * @param {string} [params.conversationGoal] - Initial prompt/goal
 * @returns {Promise<{ sessionId: string, isNew: boolean, session?: object, history?: object[], error?: string }>}
 */
export async function getOrCreateSession({
  sessionId,
  userId,
  conversationGoal,
}) {
  // Generate new sessionId if not provided
  const finalSessionId = sessionId || generateSessionId();

  // Check if session exists
  const exists = await sessionExists(finalSessionId);

  if (exists) {
    // Load existing session
    const result = await getSession(finalSessionId);
    if (result.success) {
      return {
        sessionId: finalSessionId,
        isNew: false,
        session: result.session,
        history: result.history,
      };
    }
    // Fall through to create if load failed
  }

  // Create new session
  const createResult = await createSession({
    sessionId: finalSessionId,
    userId,
    conversationGoal,
  });

  if (createResult.success) {
    return {
      sessionId: finalSessionId,
      isNew: true,
      session: createResult.session,
      history: [],
    };
  }

  // Return with error but still provide sessionId for client
  return {
    sessionId: finalSessionId,
    isNew: false,
    error: createResult.error,
  };
}

/**
 * Converts conversation history to the format expected by InMemoryRunner.
 * Maps stored messages to the ADK message format.
 *
 * @param {object[]} history - Array of conversation messages from database
 * @returns {object[]} - Array of messages in ADK format
 */
export function historyToRunnerMessages(history) {
  if (!Array.isArray(history)) return [];

  return history.map((msg) => ({
    role: msg.role,
    parts: [{ text: msg.content }],
  }));
}

