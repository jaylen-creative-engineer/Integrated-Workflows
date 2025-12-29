import { FunctionTool } from "@google/adk";
import { Schema, Type } from "@google/genai";

type TasksParams = {
  briefId: string;
  maxTasks?: number;
};

const tasksSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    briefId: { type: Type.STRING },
    maxTasks: { type: Type.INTEGER },
  },
  required: ["briefId"],
};

export const generateTasksFromBrief = new FunctionTool({
  name: "generate_tasks_from_brief",
  description:
    "Given a Product Brief, generate tasks across the pathway phases.",
  parameters: tasksSchema,
  execute: async (input) => {
    const { briefId, maxTasks = 10 } = input as TasksParams;
    const tasks = [
      {
        title: "Define success for the first demo",
        phase: "Designing",
        estimateHours: 1.5,
      },
      {
        title: "Implement minimal end-to-end path",
        phase: "Building",
        estimateHours: 4,
      },
      {
        title: "Prep validation checklist",
        phase: "Validation",
        estimateHours: 1,
      },
      {
        title: "Draft delivery notes",
        phase: "Delivery",
        estimateHours: 1,
      },
    ].slice(0, maxTasks);

    return {
      status: "stubbed",
      briefId,
      tasksCreated: tasks.length,
      tasks,
    };
  },
});

export const tasksTools = [generateTasksFromBrief];
