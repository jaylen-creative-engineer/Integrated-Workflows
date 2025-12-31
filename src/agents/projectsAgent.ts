import { FunctionTool } from "@google/adk";
import { Schema, Type } from "@google/genai";
import {
  createProject,
  updatePage,
  queryProjects,
  extractPropertyValue,
} from "../services/notion/index.js";
import { notionConfig } from "../config/notionConfig.js";

type BriefParams = {
  title: string;
  ideaSummary: string;
  scopeNotes?: string;
  timeboxDays?: number;
  targetSurface?: string;
  initiative?: string;
  priority?: string;
};

const briefSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    title: { type: Type.STRING, description: "The product brief title" },
    ideaSummary: {
      type: Type.STRING,
      description: "Summary of the idea/concept",
    },
    scopeNotes: { type: Type.STRING, description: "Additional scope notes" },
    timeboxDays: {
      type: Type.INTEGER,
      description: "Number of days for the timebox",
    },
    targetSurface: {
      type: Type.STRING,
      description: "Target platform/surface (e.g., web, mobile)",
    },
    initiative: {
      type: Type.STRING,
      description:
        "Initiative category (BENgineers, Stori, Personal, Creative Studio, Work)",
    },
    priority: {
      type: Type.STRING,
      description: "Priority level (Low, Medium, High)",
    },
  },
  required: ["title", "ideaSummary"],
};

export const createProductBrief = new FunctionTool({
  name: "create_product_brief",
  description:
    "Create a new Product Brief in Notion given an idea and constraints.",
  parameters: briefSchema,
  execute: async (input) => {
    const {
      title,
      ideaSummary,
      scopeNotes,
      timeboxDays,
      targetSurface,
      initiative,
      priority,
    } = input as BriefParams;

    try {
      // Build the summary combining ideaSummary and optional fields
      let fullSummary = ideaSummary;
      if (scopeNotes) fullSummary += `\n\nScope: ${scopeNotes}`;
      if (targetSurface) fullSummary += `\nTarget: ${targetSurface}`;
      if (timeboxDays) fullSummary += `\nTimebox: ${timeboxDays} days`;

      // Calculate dates if timeboxDays is provided
      const dates = timeboxDays
        ? {
            start: new Date().toISOString().split("T")[0],
            end: new Date(Date.now() + timeboxDays * 24 * 60 * 60 * 1000)
              .toISOString()
              .split("T")[0],
          }
        : undefined;

      const project = await createProject({
        title,
        summary: fullSummary,
        status: "Planning",
        priority: priority || "Medium",
        initiative: initiative ? [initiative] : undefined,
        dates,
      });

      return {
        status: "success",
        briefId: project.pageId,
        notionUrl: project.url,
        summary: `Created brief '${title}'`,
        ideaSummary,
        scopeNotes,
        timeboxDays,
        targetSurface,
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

// Query briefs by status or initiative
type QueryBriefsParams = {
  status?: string;
  initiative?: string;
};

const queryBriefsSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    status: {
      type: Type.STRING,
      description:
        "Filter by status (Planning, In Progress, Paused, Backlog, Done, Canceled)",
    },
    initiative: {
      type: Type.STRING,
      description:
        "Filter by initiative (BENgineers, Stori, Personal, Creative Studio, Work)",
    },
  },
};

export const queryProductBriefs = new FunctionTool({
  name: "query_product_briefs",
  description:
    "Query existing Product Briefs from Notion, optionally filtered by status or initiative.",
  parameters: queryBriefsSchema,
  execute: async (input) => {
    const { status, initiative } = input as QueryBriefsParams;

    try {
      const pages = await queryProjects({ status, initiative });
      const props = notionConfig.projects.properties;

      const briefs = pages.map((page) => ({
        briefId: page.id,
        notionUrl: page.url,
        title: extractPropertyValue(page.properties[props.title.name]),
        summary: extractPropertyValue(page.properties[props.summary.name]),
        status: extractPropertyValue(page.properties[props.status.name]),
        priority: extractPropertyValue(page.properties[props.priority.name]),
        initiative: extractPropertyValue(
          page.properties[props.initiative.name]
        ),
      }));

      return {
        status: "success",
        count: briefs.length,
        briefs,
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

export const projectsTools = [createProductBrief, queryProductBriefs];
