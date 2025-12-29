import { InMemoryRunner } from "@google/adk";
import { allDomainTools, rootAgent } from "../../../../agents/rootAgent.js";
import { NextResponse } from "next/server.js";

type RequestPayload = {
  prompt?: string;
  userId?: string;
  sessionId?: string;
  dryRun?: boolean;
};

export async function POST(request: Request) {
  let body: RequestPayload = {};
  try {
    body = (await request.json()) as RequestPayload;
  } catch {
    // ignore JSON parse issues and fall back to defaults
  }

  const {
    prompt = "Generate a daily brief with tasks, meetings, and energy map.",
    userId = "self",
    sessionId = "demo-session",
    dryRun = false,
  } = body;

  const hasApiKey = Boolean(process.env.GOOGLE_GENAI_API_KEY);
  const tools = allDomainTools.map((tool) => tool.name);

  if (dryRun || !hasApiKey) {
    return NextResponse.json({
      status: dryRun ? "dry-run" : "unconfigured",
      reason: dryRun ? "Dry run requested" : "Missing GOOGLE_GENAI_API_KEY",
      tools,
    });
  }

  const runner = new InMemoryRunner({
    agent: rootAgent,
    appName: "creative-os-poc",
  });

  const events: unknown[] = [];

  try {
    for await (const event of runner.runAsync({
      userId,
      sessionId,
      newMessage: {
        role: "user",
        parts: [{ text: String(prompt) }],
      } as any,
      runConfig: { maxLlmCalls: 4 },
    })) {
      events.push(event);
    }

    return NextResponse.json({ status: "ok", events });
  } catch (error) {
    return NextResponse.json(
      {
        status: "error",
        message: error instanceof Error ? error.message : "Unknown error",
        events,
      },
      { status: 500 }
    );
  }
}
