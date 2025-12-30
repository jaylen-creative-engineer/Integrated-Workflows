import { InMemoryRunner } from "@google/adk";
import { NextRequest, NextResponse } from "next/server.js";
import {
  getOrCreateSession,
  saveMessage,
  updateSessionOutput,
  extractAgentOutput,
  SessionStatus,
} from "../../_lib/storage/agentSessionStorage.js";
import { allDomainTools, rootAgent } from "@/agents";
import { APP_USER_ID } from "@/config";

type RequestPayload = {
  prompt?: string;
  userId?: string;
  sessionId?: string;
  dryRun?: boolean;
};

type ParsedRequest = {
  prompt: string;
  userId: string;
  sessionId: string | undefined;
  dryRun: boolean;
};

const DEFAULT_PROMPT =
  "Generate a daily brief with tasks, meetings, and energy map.";
const APP_NAME = "creative-os-poc";
const MAX_LLM_CALLS = 4;

/**
 * Parses and validates the request body, returning normalized values with defaults
 */
async function parseRequest(request: NextRequest): Promise<ParsedRequest> {
  let body: RequestPayload = {};
  try {
    body = (await request.json()) as RequestPayload;
  } catch {
    // ignore JSON parse issues and fall back to defaults
  }

  return {
    prompt: body.prompt ?? DEFAULT_PROMPT,
    userId: body.userId ?? APP_USER_ID,
    sessionId: body.sessionId, // undefined if not provided, will be generated
    dryRun: body.dryRun ?? false,
  };
}

/**
 * Checks if the request should be handled as a dry run or if the API is unconfigured
 */
function shouldSkipExecution(dryRun: boolean): {
  skip: boolean;
  reason: string;
  status: "dry-run" | "unconfigured";
} {
  const hasApiKey = Boolean(process.env.GOOGLE_GENAI_API_KEY);

  if (dryRun) {
    return {
      skip: true,
      reason: "Dry run requested",
      status: "dry-run",
    };
  }

  if (!hasApiKey) {
    return {
      skip: true,
      reason: "Missing GOOGLE_GENAI_API_KEY",
      status: "unconfigured",
    };
  }

  return { skip: false, reason: "", status: "unconfigured" };
}

/**
 * Executes the agent runner and collects all events
 */
async function executeAgent(
  prompt: string,
  userId: string,
  sessionId: string
): Promise<unknown[]> {
  const runner = new InMemoryRunner({
    agent: rootAgent,
    appName: APP_NAME,
  });

  const events: unknown[] = [];

  for await (const event of runner.runAsync({
    userId,
    sessionId,
    newMessage: {
      role: "user",
      parts: [{ text: String(prompt) }],
    } as any,
    runConfig: { maxLlmCalls: MAX_LLM_CALLS },
  })) {
    events.push(event);
  }

  return events;
}

/**
 * Creates an error response with the collected events and session info
 */
function createErrorResponse(
  error: unknown,
  events: unknown[],
  sessionId?: string
): NextResponse {
  return NextResponse.json(
    {
      status: "error",
      message: error instanceof Error ? error.message : "Unknown error",
      sessionId,
      events,
    },
    { status: 500 }
  );
}

/**
 * Persists session data to Supabase (fail-open pattern)
 * Logs errors but doesn't fail the request if storage fails
 */
async function persistSession(
  sessionId: string,
  prompt: string,
  events: unknown[],
  isNewSession: boolean
): Promise<void> {
  try {
    // Save user message
    await saveMessage({
      sessionId,
      role: "user",
      content: prompt,
    });

    // Extract and save assistant response
    const agentOutput = extractAgentOutput(events);
    if (agentOutput) {
      await saveMessage({
        sessionId,
        role: "assistant",
        content: agentOutput,
        metadata: { eventCount: events.length },
      });
    }

    // Update session with output and mark as completed
    await updateSessionOutput({
      sessionId,
      agentOutput: agentOutput || undefined,
      status: SessionStatus.COMPLETED,
    });
  } catch (error) {
    // Fail-open: log the error but don't fail the request
    console.error("[creative-os] Session persistence failed:", error);
  }
}

export async function POST(request: NextRequest) {
  const {
    prompt,
    userId,
    sessionId: providedSessionId,
    dryRun,
  } = await parseRequest(request);

  const skipCheck = shouldSkipExecution(dryRun);
  if (skipCheck.skip) {
    const tools = allDomainTools.map((tool) => tool.name);
    return NextResponse.json({
      status: skipCheck.status,
      reason: skipCheck.reason,
      tools,
    });
  }

  // Get or create session (fail-open: continue even if storage fails)
  const sessionResult = await getOrCreateSession({
    sessionId: providedSessionId,
    userId,
    conversationGoal: prompt,
  });

  const sessionId = sessionResult.sessionId;
  const isNewSession = sessionResult.isNew;

  // Log session info for debugging
  if (sessionResult.error) {
    console.warn("[creative-os] Session storage warning:", sessionResult.error);
  }

  const events: unknown[] = [];

  try {
    const agentEvents = await executeAgent(prompt, userId, sessionId);
    events.push(...agentEvents);

    // Persist session data asynchronously (fail-open)
    // Using void to explicitly ignore the promise - we don't want to block response
    void persistSession(sessionId, prompt, events, isNewSession);

    return NextResponse.json({
      status: "ok",
      sessionId,
      isNewSession,
      events,
    });
  } catch (error) {
    // Try to mark session as errored (fail-open)
    try {
      await updateSessionOutput({
        sessionId,
        status: SessionStatus.ERROR,
      });
    } catch {
      // Ignore storage errors during error handling
    }

    return createErrorResponse(error, events, sessionId);
  }
}
