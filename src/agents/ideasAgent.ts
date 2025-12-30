import { FunctionTool } from "@google/adk";
import { Schema, Type } from "@google/genai";
import {
  createIdea,
  updateIdea,
  queryIdeas,
  getIdea,
  getRecentIdeas,
  getIdeasByStatus,
  createProject,
  type IdeaResponse,
} from "../services/notionService.js";
import {
  IdeaStatus,
  IdeaTags,
  IdeaStatus1,
  type IdeaStatusValue,
  type IdeaTagValue,
  type IdeaStatus1Value,
} from "../config/notionConfig.js";

// ============================================================================
// Type Definitions
// ============================================================================

interface CaptureIdeaParams {
  rawText: string;
  tags?: string[];
  status?: string;
  autoElevateToBrief?: boolean;
}

interface UpdateIdeaParams {
  ideaId: string;
  title?: string;
  summary?: string;
  tags?: string[];
  status?: string;
}

interface QueryIdeasParams {
  status?: string;
  tags?: string[];
  limit?: number;
}

interface GetIdeaParams {
  ideaId: string;
}

// ============================================================================
// Schema Definitions
// ============================================================================

const captureIdeaSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    rawText: {
      type: Type.STRING,
      description: "The raw idea text to capture",
    },
    tags: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: `Optional tags to categorize the idea. Valid values: ${Object.values(IdeaTags).join(", ")}`,
    },
    status: {
      type: Type.STRING,
      description: `Optional status for the idea. Valid values: ${Object.values(IdeaStatus).join(", ")}. Defaults to "Backlog"`,
    },
    autoElevateToBrief: {
      type: Type.BOOLEAN,
      description:
        "If true, also create a Product Brief candidate from this idea",
    },
  },
  required: ["rawText"],
  additionalProperties: false,
};

const updateIdeaSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    ideaId: {
      type: Type.STRING,
      description: "The Notion page ID of the idea to update",
    },
    title: {
      type: Type.STRING,
      description: "New title for the idea",
    },
    summary: {
      type: Type.STRING,
      description: "New summary for the idea",
    },
    tags: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: `Tags to set on the idea. Valid values: ${Object.values(IdeaTags).join(", ")}`,
    },
    status: {
      type: Type.STRING,
      description: `New status for the idea. Valid values: ${Object.values(IdeaStatus).join(", ")}`,
    },
  },
  required: ["ideaId"],
  additionalProperties: false,
};

const queryIdeasSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    status: {
      type: Type.STRING,
      description: `Filter by status. Valid values: ${Object.values(IdeaStatus).join(", ")}`,
    },
    tags: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: `Filter by tags (AND logic). Valid values: ${Object.values(IdeaTags).join(", ")}`,
    },
    limit: {
      type: Type.NUMBER,
      description: "Maximum number of results to return. Defaults to 20",
    },
  },
  additionalProperties: false,
};

const getIdeaSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    ideaId: {
      type: Type.STRING,
      description: "The Notion page ID of the idea to retrieve",
    },
  },
  required: ["ideaId"],
  additionalProperties: false,
};

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Extract a clean title from raw text
 */
function extractTitle(rawText: string, maxLength: number = 50): string {
  // Get first line, clean it up
  const firstLine = rawText.split("\n")[0].trim();
  if (firstLine.length > 0 && firstLine.length <= maxLength) {
    return firstLine;
  }
  // Truncate with ellipsis if too long
  if (firstLine.length > maxLength) {
    return firstLine.slice(0, maxLength - 3) + "...";
  }
  // Fallback to date-based title
  return `Idea ${new Date().toISOString().split("T")[0]}`;
}

/**
 * Validate and cast status value
 */
function validateStatus(status: string | undefined): IdeaStatusValue | undefined {
  if (!status) return undefined;
  const validStatuses = Object.values(IdeaStatus);
  if (validStatuses.includes(status as IdeaStatusValue)) {
    return status as IdeaStatusValue;
  }
  return undefined;
}

/**
 * Validate and filter tags
 */
function validateTags(tags: string[] | undefined): IdeaTagValue[] {
  if (!tags || tags.length === 0) return [];
  const validTags = Object.values(IdeaTags);
  return tags.filter((tag) =>
    validTags.includes(tag as IdeaTagValue)
  ) as IdeaTagValue[];
}

/**
 * Format idea response for agent output
 */
function formatIdeaForOutput(idea: IdeaResponse) {
  return {
    id: idea.pageId,
    title: idea.title,
    summary: idea.summary,
    tags: idea.tags,
    status: idea.status,
    url: idea.url,
    createdAt: idea.createdTime,
    lastEdited: idea.lastEditedTime,
  };
}

// ============================================================================
// Tool Implementations
// ============================================================================

/**
 * Capture a new idea in Notion
 */
export const captureIdea = new FunctionTool({
  name: "capture_idea",
  description:
    "Capture a raw idea in Notion's Idea Library. Can optionally tag, set status, and elevate to a Product Brief candidate.",
  parameters: captureIdeaSchema,
  execute: async (input) => {
    const {
      rawText,
      tags,
      status,
      autoElevateToBrief = false,
    } = input as CaptureIdeaParams;

    try {
      const title = extractTitle(rawText);
      const validTags = validateTags(tags);
      const validStatus = validateStatus(status);

      // Create the idea in Notion
      const idea = await createIdea({
        title,
        summary: rawText,
        tags: validTags.length > 0 ? validTags : undefined,
        status: validStatus || IdeaStatus.BACKLOG,
      });

      let briefCandidate = null;

      // Optionally create a brief candidate
      if (autoElevateToBrief) {
        const brief = await createProject({
          title: `[Draft] ${title}`,
          summary: rawText.slice(0, 240),
          status: "Planning",
        });

        briefCandidate = {
          briefId: brief.pageId,
          notionUrl: brief.url,
          title: `[Draft] ${title}`,
          ideaSummary: rawText.slice(0, 240),
        };
      }

      return {
        status: "success",
        ideaId: idea.pageId,
        notionUrl: idea.url,
        title,
        tags: validTags,
        ideaStatus: validStatus || IdeaStatus.BACKLOG,
        briefCandidate,
      };
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unknown error occurred";
      return {
        status: "error",
        error: message,
      };
    }
  },
});

/**
 * Update an existing idea in Notion
 */
export const updateIdeaTool = new FunctionTool({
  name: "update_idea",
  description:
    "Update an existing idea in Notion. Can modify title, summary, tags, or status.",
  parameters: updateIdeaSchema,
  execute: async (input) => {
    const { ideaId, title, summary, tags, status } = input as UpdateIdeaParams;

    try {
      const validTags = validateTags(tags);
      const validStatus = validateStatus(status);

      const result = await updateIdea({
        pageId: ideaId,
        title,
        summary,
        tags: tags !== undefined ? validTags : undefined,
        status: validStatus,
      });

      return {
        status: "success",
        ideaId: result.pageId,
        notionUrl: result.url,
        updated: {
          title: title !== undefined,
          summary: summary !== undefined,
          tags: tags !== undefined,
          status: status !== undefined,
        },
      };
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unknown error occurred";
      return {
        status: "error",
        error: message,
      };
    }
  },
});

/**
 * Query ideas from Notion with filters
 */
export const queryIdeasTool = new FunctionTool({
  name: "query_ideas",
  description:
    "Search and filter ideas from the Notion Idea Library. Can filter by status and tags.",
  parameters: queryIdeasSchema,
  execute: async (input) => {
    const { status, tags, limit = 20 } = input as QueryIdeasParams;

    try {
      const validStatus = validateStatus(status);
      const validTags = validateTags(tags);

      const pages = await queryIdeas({
        status: validStatus,
        tags: validTags.length > 0 ? validTags : undefined,
        hidden: false, // Don't show hidden ideas
      });

      const ideas = pages.slice(0, limit).map((page) => {
        const props = page.properties;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const getTitle = (p: any) => p?.title?.[0]?.plain_text || "";
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const getSelect = (p: any) => p?.select?.name || null;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const getMultiSelect = (p: any) =>
          p?.multi_select?.map((s: { name: string }) => s.name) || [];

        return {
          id: page.id,
          title: getTitle(props["Title"]),
          status: getSelect(props["Status"]),
          tags: getMultiSelect(props["Tags"]),
          url: page.url,
          createdAt: page.created_time,
        };
      });

      return {
        status: "success",
        count: ideas.length,
        ideas,
        filters: {
          status: validStatus || "any",
          tags: validTags.length > 0 ? validTags : "any",
        },
      };
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unknown error occurred";
      return {
        status: "error",
        error: message,
      };
    }
  },
});

/**
 * Get a single idea by ID
 */
export const getIdeaTool = new FunctionTool({
  name: "get_idea",
  description: "Retrieve a specific idea from Notion by its page ID.",
  parameters: getIdeaSchema,
  execute: async (input) => {
    const { ideaId } = input as GetIdeaParams;

    try {
      const idea = await getIdea(ideaId);

      return {
        status: "success",
        idea: formatIdeaForOutput(idea),
      };
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unknown error occurred";
      return {
        status: "error",
        error: message,
      };
    }
  },
});

/**
 * Get recent ideas (convenience tool)
 */
export const getRecentIdeasTool = new FunctionTool({
  name: "get_recent_ideas",
  description:
    "Get the most recently created ideas from Notion, excluding hidden ones.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      limit: {
        type: Type.NUMBER,
        description: "Maximum number of ideas to return. Defaults to 10",
      },
    },
    additionalProperties: false,
  },
  execute: async (input) => {
    const { limit = 10 } = input as { limit?: number };

    try {
      const ideas = await getRecentIdeas(limit);

      return {
        status: "success",
        count: ideas.length,
        ideas: ideas.map(formatIdeaForOutput),
      };
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unknown error occurred";
      return {
        status: "error",
        error: message,
      };
    }
  },
});

// ============================================================================
// Export all tools
// ============================================================================

export const ideasTools = [
  captureIdea,
  updateIdeaTool,
  queryIdeasTool,
  getIdeaTool,
  getRecentIdeasTool,
];
