import { FunctionTool } from "@google/adk";
import { Schema, Type } from "@google/genai";
import {
  createTask,
  queryTasksByProject,
  extractPropertyValue,
} from "../services/notion/index.js";
import { notionConfig } from "../config/notionConfig.js";

type GenerateTasksParams = {
  briefId: string;
  maxTasks?: number;
  customTasks?: TaskTemplate[];
};

const generateTasksSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    briefId: {
      type: Type.STRING,
      description: "The Notion page ID of the Product Brief to link tasks to",
    },
    maxTasks: {
      type: Type.INTEGER,
      description: "Maximum number of tasks to generate (default: 10)",
    },
    customTasks: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          title: { type: Type.STRING },
          phase: { type: Type.STRING },
          priority: {
            type: Type.STRING,
            description: "Very Low, Low, Medium, High, Very High",
          },
          dueDate: {
            type: Type.STRING,
            description: "Due date in YYYY-MM-DD format",
          },
        },
        required: ["title"],
      },
      description: "Optional custom tasks to create instead of default phases",
    },
  },
  required: ["briefId"],
};

// Task template type
type TaskTemplate = {
  title: string;
  phase?: string;
  priority?: string;
  dueDate?: string;
};

// Default pathway phases for task generation
const DEFAULT_PATHWAY_TASKS: TaskTemplate[] = [
  { title: "Define success criteria for first demo", phase: "Designing" },
  { title: "Create wireframes/mockups", phase: "Designing" },
  { title: "Implement minimal end-to-end path", phase: "Building" },
  { title: "Write core functionality", phase: "Building" },
  { title: "Prep validation checklist", phase: "Validation" },
  { title: "User testing session", phase: "Validation" },
  { title: "Draft delivery notes", phase: "Delivery" },
  { title: "Final review and handoff", phase: "Delivery" },
];

export const generateTasksFromBrief = new FunctionTool({
  name: "generate_tasks_from_brief",
  description:
    "Generate and create tasks in Notion for a Product Brief, linked via the relation property.",
  parameters: generateTasksSchema,
  execute: async (input) => {
    const {
      briefId,
      maxTasks = 10,
      customTasks,
    } = input as GenerateTasksParams;

    try {
      // Use custom tasks if provided, otherwise use default pathway tasks
      const tasksToCreate = (customTasks || DEFAULT_PATHWAY_TASKS).slice(
        0,
        maxTasks
      );

      const createdTasks = [];

      for (const task of tasksToCreate) {
        const taskTitle = task.phase
          ? `[${task.phase}] ${task.title}`
          : task.title;

        const created = await createTask({
          title: taskTitle,
          status: "To Do",
          projectId: briefId,
          priority: task.priority,
          dueDate: task.dueDate,
        });

        createdTasks.push({
          taskId: created.pageId,
          notionUrl: created.url,
          title: taskTitle,
          phase: task.phase || null,
          priority: task.priority || null,
          dueDate: task.dueDate || null,
        });
      }

      return {
        status: "success",
        briefId,
        tasksCreated: createdTasks.length,
        tasks: createdTasks,
      };
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unknown error occurred";
      return {
        status: "error",
        error: message,
        briefId,
      };
    }
  },
});

// Query tasks for a specific brief/project
type QueryTasksParams = {
  briefId: string;
};

const queryTasksSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    briefId: {
      type: Type.STRING,
      description: "The Notion page ID of the Product Brief to get tasks for",
    },
  },
  required: ["briefId"],
};

export const getTasksForBrief = new FunctionTool({
  name: "get_tasks_for_brief",
  description: "Retrieve all tasks linked to a specific Product Brief.",
  parameters: queryTasksSchema,
  execute: async (input) => {
    const { briefId } = input as QueryTasksParams;

    try {
      const pages = await queryTasksByProject(briefId);
      const props = notionConfig.tasks.properties;

      const tasks = pages.map((page) => ({
        taskId: page.id,
        notionUrl: page.url,
        title: extractPropertyValue(page.properties[props.title.name]),
        status: extractPropertyValue(page.properties[props.status.name]),
        priority: extractPropertyValue(page.properties[props.priority.name]),
        dueDate: extractPropertyValue(page.properties[props.dueDate.name]),
      }));

      return {
        status: "success",
        briefId,
        count: tasks.length,
        tasks,
      };
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unknown error occurred";
      return {
        status: "error",
        error: message,
        briefId,
      };
    }
  },
});

export const tasksTools = [generateTasksFromBrief, getTasksForBrief];
