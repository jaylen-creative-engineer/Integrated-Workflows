import { FunctionTool } from "@google/adk";
import { Schema, Type } from "@google/genai";
import type { CreatePageParameters } from "@notionhq/client/build/src/api-endpoints.js";
import {
  createGameplan,
  getTodaysGameplan,
  getGameplanForDate,
  appendGameplanContent,
  type GameplanResponse,
} from "../services/notionService.js";
import {
  GameplanStatus,
  GameplanCategory,
  type GameplanStatusValue,
  type GameplanCategoryValue,
} from "../config/notionConfig.js";

// ============================================================================
// Type Definitions
// ============================================================================

interface EnergySegmentInput {
  label: string;
  category: string;
  startTime: string;
  endTime: string;
}

interface TaskInput {
  title: string;
  priority?: string;
  dueDate?: string;
  projectName?: string;
  recommendedWindow?: string;
}

interface MeetingInput {
  title: string;
  eventTime: string;
  eventTimeEnd?: string;
}

interface ProductBriefInput {
  title: string;
  summary?: string;
  status?: string;
}

interface CreateDailyGameplanParams {
  summary: string;
  energySegments?: EnergySegmentInput[];
  tasks?: TaskInput[];
  meetings?: MeetingInput[];
  productBriefs?: ProductBriefInput[];
  priority?: string;
  category?: string[];
}

interface GetGameplanForDateParams {
  date: string;
}

// ============================================================================
// Block Builders - Helpers to construct Notion block content
// ============================================================================

type BlockObjectRequest = NonNullable<CreatePageParameters["children"]>[number];

const blockBuilders = {
  heading1: (text: string): BlockObjectRequest => ({
    object: "block",
    type: "heading_1",
    heading_1: {
      rich_text: [{ type: "text", text: { content: text } }],
    },
  }),

  heading2: (text: string): BlockObjectRequest => ({
    object: "block",
    type: "heading_2",
    heading_2: {
      rich_text: [{ type: "text", text: { content: text } }],
    },
  }),

  heading3: (text: string): BlockObjectRequest => ({
    object: "block",
    type: "heading_3",
    heading_3: {
      rich_text: [{ type: "text", text: { content: text } }],
    },
  }),

  paragraph: (text: string): BlockObjectRequest => ({
    object: "block",
    type: "paragraph",
    paragraph: {
      rich_text: [{ type: "text", text: { content: text } }],
    },
  }),

  bulletedListItem: (text: string): BlockObjectRequest => ({
    object: "block",
    type: "bulleted_list_item",
    bulleted_list_item: {
      rich_text: [{ type: "text", text: { content: text } }],
    },
  }),

  numberedListItem: (text: string): BlockObjectRequest => ({
    object: "block",
    type: "numbered_list_item",
    numbered_list_item: {
      rich_text: [{ type: "text", text: { content: text } }],
    },
  }),

  divider: (): BlockObjectRequest => ({
    object: "block",
    type: "divider",
    divider: {},
  }),

  callout: (
    text: string,
    emoji: string = "💡"
  ): BlockObjectRequest => ({
    object: "block",
    type: "callout",
    callout: {
      rich_text: [{ type: "text", text: { content: text } }],
      icon: { type: "emoji", emoji: emoji as "💡" },
    },
  }),

  quote: (text: string): BlockObjectRequest => ({
    object: "block",
    type: "quote",
    quote: {
      rich_text: [{ type: "text", text: { content: text } }],
    },
  }),
};

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Generate content blocks for daily gameplan
 */
function buildGameplanContent(params: CreateDailyGameplanParams): BlockObjectRequest[] {
  const blocks: BlockObjectRequest[] = [];

  // Summary section at top
  blocks.push(blockBuilders.callout(params.summary, "🎯"));
  blocks.push(blockBuilders.divider());

  // Energy Timeline section
  if (params.energySegments && params.energySegments.length > 0) {
    blocks.push(blockBuilders.heading2("Energy Timeline"));

    const energyEmojis: Record<string, string> = {
      peak: "⚡",
      dip: "🌊",
      groggy: "☕",
      wind_down: "🌅",
      melatonin: "🌙",
    };

    for (const segment of params.energySegments) {
      const emoji = energyEmojis[segment.category] || "•";
      blocks.push(
        blockBuilders.bulletedListItem(
          `${emoji} ${segment.label}: ${segment.startTime} - ${segment.endTime}`
        )
      );
    }
    blocks.push(blockBuilders.divider());
  }

  // Priority Tasks section
  if (params.tasks && params.tasks.length > 0) {
    blocks.push(blockBuilders.heading2("Priority Tasks"));

    for (const task of params.tasks) {
      let taskText = task.title;
      if (task.priority) {
        taskText = `[${task.priority}] ${taskText}`;
      }
      if (task.recommendedWindow) {
        taskText += ` → ${task.recommendedWindow}`;
      }
      if (task.projectName) {
        taskText += ` (${task.projectName})`;
      }
      blocks.push(blockBuilders.bulletedListItem(taskText));
    }
    blocks.push(blockBuilders.divider());
  }

  // Meetings section
  if (params.meetings && params.meetings.length > 0) {
    blocks.push(blockBuilders.heading2("Meetings"));

    for (const meeting of params.meetings) {
      let meetingText = meeting.title;
      if (meeting.eventTime) {
        const timeStr = meeting.eventTimeEnd
          ? `${meeting.eventTime} - ${meeting.eventTimeEnd}`
          : meeting.eventTime;
        meetingText = `${timeStr}: ${meetingText}`;
      }
      blocks.push(blockBuilders.bulletedListItem(meetingText));
    }
    blocks.push(blockBuilders.divider());
  }

  // Product Brief Focus section
  if (params.productBriefs && params.productBriefs.length > 0) {
    blocks.push(blockBuilders.heading2("Product Brief Focus"));
    blocks.push(
      blockBuilders.paragraph(
        "These are the product briefs driving today's work:"
      )
    );

    for (const brief of params.productBriefs) {
      let briefText = brief.title;
      if (brief.status) {
        briefText += ` [${brief.status}]`;
      }
      blocks.push(blockBuilders.heading3(briefText));
      if (brief.summary) {
        blocks.push(blockBuilders.quote(brief.summary));
      }
    }
  }

  return blocks;
}

/**
 * Format gameplan response for agent output
 */
function formatGameplanForOutput(gameplan: GameplanResponse) {
  return {
    pageId: gameplan.pageId,
    notionUrl: gameplan.url,
    title: gameplan.title,
    summary: gameplan.summary,
    status: gameplan.status,
    priority: gameplan.priority,
    category: gameplan.category,
    createdAt: gameplan.createdTime,
  };
}

/**
 * Generate title for daily gameplan
 */
function generateGameplanTitle(date: string): string {
  const d = new Date(date);
  const options: Intl.DateTimeFormatOptions = {
    weekday: "long",
    month: "long",
    day: "numeric",
  };
  const formatted = d.toLocaleDateString("en-US", options);
  return `Daily Gameplan - ${formatted}`;
}

// ============================================================================
// Tool: Create Daily Gameplan
// ============================================================================

const createDailyGameplanSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    summary: {
      type: Type.STRING,
      description:
        "High-level summary of the day - synthesizes energy, tasks, meetings, and priorities into a cohesive overview",
    },
    energySegments: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          label: {
            type: Type.STRING,
            description: "Segment label (e.g., Morning Peak, Afternoon Dip)",
          },
          category: {
            type: Type.STRING,
            description:
              "Segment category (peak, dip, groggy, wind_down, melatonin)",
          },
          startTime: {
            type: Type.STRING,
            description: "Start time (formatted string)",
          },
          endTime: {
            type: Type.STRING,
            description: "End time (formatted string)",
          },
        },
        required: ["label", "category", "startTime", "endTime"],
      },
      description: "Energy segments from WHOOP data",
    },
    tasks: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          title: { type: Type.STRING, description: "Task title" },
          priority: {
            type: Type.STRING,
            description: "Task priority (Very Low, Low, Medium, High, Very High)",
          },
          dueDate: {
            type: Type.STRING,
            description: "Due date if applicable",
          },
          projectName: {
            type: Type.STRING,
            description: "Related project/brief name",
          },
          recommendedWindow: {
            type: Type.STRING,
            description:
              "Recommended energy window for this task (e.g., Morning Peak)",
          },
        },
        required: ["title"],
      },
      description: "Priority tasks for today, matched to energy windows",
    },
    meetings: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          title: { type: Type.STRING, description: "Meeting title" },
          eventTime: {
            type: Type.STRING,
            description: "Meeting start time",
          },
          eventTimeEnd: {
            type: Type.STRING,
            description: "Meeting end time",
          },
        },
        required: ["title", "eventTime"],
      },
      description: "Today's meetings",
    },
    productBriefs: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          title: { type: Type.STRING, description: "Brief title" },
          summary: {
            type: Type.STRING,
            description: "Brief summary or description",
          },
          status: {
            type: Type.STRING,
            description: "Current status of the brief",
          },
        },
        required: ["title"],
      },
      description: "Product briefs driving today's work",
    },
    priority: {
      type: Type.STRING,
      description: "Overall priority for the gameplan (High)",
    },
    category: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: `Categories for the gameplan. Valid values: ${Object.values(GameplanCategory).join(", ")}`,
    },
  },
  required: ["summary"],
};

export const createDailyGameplanTool = new FunctionTool({
  name: "create_daily_gameplan",
  description:
    "Create a daily gameplan in Notion with a summary, energy timeline, priority tasks matched to energy windows, meetings, and product brief context. The gameplan provides a complete view of what needs to be done and why.",
  parameters: createDailyGameplanSchema,
  execute: async (input) => {
    const params = input as CreateDailyGameplanParams;

    try {
      const today = new Date().toISOString().split("T")[0];
      const title = generateGameplanTitle(today);

      // Check if a gameplan already exists for today
      const existing = await getTodaysGameplan();
      if (existing) {
        return {
          status: "exists",
          message: "A gameplan already exists for today",
          gameplan: formatGameplanForOutput(existing),
        };
      }

      // Build content blocks
      const contentBlocks = buildGameplanContent(params);

      // Validate and prepare categories
      const validCategories = params.category?.filter((cat) =>
        Object.values(GameplanCategory).includes(cat as GameplanCategoryValue)
      ) as GameplanCategoryValue[] | undefined;

      // Always include "Gameplan" category
      const categories: GameplanCategoryValue[] = validCategories
        ? [...new Set([...validCategories, GameplanCategory.GAMEPLAN])]
        : [GameplanCategory.GAMEPLAN];

      // Create the gameplan
      const result = await createGameplan({
        title,
        summary: params.summary,
        status: GameplanStatus.DRAFT,
        priority: params.priority as GameplanStatusValue | undefined,
        category: categories,
        contentBlocks,
      });

      return {
        status: "success",
        message: `Created daily gameplan for ${today}`,
        gameplanId: result.pageId,
        notionUrl: result.url,
        title,
        summary: params.summary,
        sectionsIncluded: {
          energyTimeline: (params.energySegments?.length || 0) > 0,
          tasks: (params.tasks?.length || 0) > 0,
          meetings: (params.meetings?.length || 0) > 0,
          productBriefs: (params.productBriefs?.length || 0) > 0,
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

// ============================================================================
// Tool: Get Gameplan for Date
// ============================================================================

const getGameplanForDateSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    date: {
      type: Type.STRING,
      description:
        "The date to get gameplan for (YYYY-MM-DD format). Omit for today.",
    },
  },
  required: [],
};

export const getGameplanForDateTool = new FunctionTool({
  name: "get_gameplan_for_date",
  description:
    "Retrieve an existing gameplan for a specific date. Returns null if no gameplan exists for that date.",
  parameters: getGameplanForDateSchema,
  execute: async (input) => {
    const { date } = input as GetGameplanForDateParams;
    const targetDate = date || new Date().toISOString().split("T")[0];

    try {
      const gameplan = date
        ? await getGameplanForDate(targetDate)
        : await getTodaysGameplan();

      if (!gameplan) {
        return {
          status: "not_found",
          message: `No gameplan found for ${targetDate}`,
          date: targetDate,
        };
      }

      return {
        status: "success",
        date: targetDate,
        gameplan: formatGameplanForOutput(gameplan),
      };
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unknown error occurred";
      return {
        status: "error",
        error: message,
        date: targetDate,
      };
    }
  },
});

// ============================================================================
// Export all tools
// ============================================================================

export const gameplansTools = [createDailyGameplanTool, getGameplanForDateTool];

