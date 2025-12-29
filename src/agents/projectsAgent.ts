import { FunctionTool } from "@google/adk";
import { Schema, Type } from "@google/genai";

type BriefParams = {
  title: string;
  ideaSummary: string;
  scopeNotes?: string;
  timeboxDays?: number;
  targetSurface?: string;
};

const briefSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    title: { type: Type.STRING },
    ideaSummary: { type: Type.STRING },
    scopeNotes: { type: Type.STRING },
    timeboxDays: { type: Type.INTEGER },
    targetSurface: { type: Type.STRING },
  },
  required: ["title", "ideaSummary"],
};

export const createProductBrief = new FunctionTool({
  name: "create_product_brief",
  description:
    "Create or update a Product Brief given an idea and constraints.",
  parameters: briefSchema,
  // Stub executor; replace with Notion + business logic later.
  execute: async (input) => {
    const { title, ideaSummary, scopeNotes, timeboxDays, targetSurface } =
      input as BriefParams;
    const briefId = `brief-${Date.now()}`;

    return {
      status: "stubbed",
      briefId,
      notionUrl: "https://notion.invalid/brief-placeholder",
      summary: `Created/updated brief '${title}'`,
      ideaSummary,
      scopeNotes,
      timeboxDays,
      targetSurface,
    };
  },
});

export const projectsTools = [createProductBrief];
