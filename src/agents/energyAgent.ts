import { FunctionTool } from "@google/adk";
import { Schema, Type } from "@google/genai";
import {
  getTodayEnergySchedule,
  getEnergyScheduleForDate,
} from "../app/api/_lib/energyStorage.js";
import { APP_USER_ID } from "../config/userConfig.js";

// ============================================================================
// Type Definitions
// ============================================================================

interface EnergySegment {
  id: string;
  category: string;
  label: string;
  start_at: string;
  end_at: string;
  start_at_formatted?: string;
  end_at_formatted?: string;
}

interface EnergySchedule {
  date: string;
  segments: EnergySegment[];
  currentSegment: EnergySegment | null;
  nextSegment: EnergySegment | null;
}

interface GetEnergyForDateParams {
  date: string;
}

interface RecommendTaskTimingParams {
  taskPriority: string;
  taskType?: string;
  estimatedDuration?: number;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Format energy schedule for agent output
 */
function formatScheduleForOutput(schedule: EnergySchedule | null) {
  if (!schedule) {
    return null;
  }

  return {
    date: schedule.date,
    segments: schedule.segments.map((seg) => ({
      category: seg.category,
      label: seg.label,
      startTime: seg.start_at_formatted || seg.start_at,
      endTime: seg.end_at_formatted || seg.end_at,
      startTimeIso: seg.start_at,
      endTimeIso: seg.end_at,
    })),
    currentSegment: schedule.currentSegment
      ? {
          category: schedule.currentSegment.category,
          label: schedule.currentSegment.label,
          startTime:
            schedule.currentSegment.start_at_formatted ||
            schedule.currentSegment.start_at,
          endTime:
            schedule.currentSegment.end_at_formatted ||
            schedule.currentSegment.end_at,
        }
      : null,
    nextSegment: schedule.nextSegment
      ? {
          category: schedule.nextSegment.category,
          label: schedule.nextSegment.label,
          startTime:
            schedule.nextSegment.start_at_formatted ||
            schedule.nextSegment.start_at,
          endTime:
            schedule.nextSegment.end_at_formatted ||
            schedule.nextSegment.end_at,
        }
      : null,
  };
}

/**
 * Map task priority to recommended energy windows
 */
function getRecommendedWindows(
  priority: string,
  taskType?: string
): { recommended: string[]; avoid: string[]; reason: string } {
  const priorityLower = priority.toLowerCase();
  const typeLower = taskType?.toLowerCase() || "";

  // High priority / cognitively demanding tasks → peak windows
  if (
    priorityLower === "high" ||
    priorityLower === "very high" ||
    typeLower.includes("development") ||
    typeLower.includes("design") ||
    typeLower.includes("discovery")
  ) {
    return {
      recommended: ["peak"],
      avoid: ["groggy", "melatonin", "wind_down"],
      reason:
        "High-priority or cognitively demanding tasks perform best during peak energy windows when focus and cognitive function are at their highest.",
    };
  }

  // Medium priority → peak or balanced dip
  if (priorityLower === "medium") {
    return {
      recommended: ["peak", "dip"],
      avoid: ["melatonin", "wind_down"],
      reason:
        "Medium-priority tasks can be done during peak or dip windows. Save peak windows for high-priority items if needed.",
    };
  }

  // Low priority / routine tasks → any window except melatonin
  if (priorityLower === "low" || priorityLower === "very low") {
    return {
      recommended: ["dip", "groggy", "wind_down"],
      avoid: ["melatonin"],
      reason:
        "Low-priority or routine tasks are well-suited for lower energy windows, preserving peak energy for demanding work.",
    };
  }

  // Communication tasks → specific windows
  if (
    typeLower.includes("communication") ||
    typeLower.includes("meeting") ||
    typeLower.includes("email")
  ) {
    return {
      recommended: ["dip"],
      avoid: ["melatonin", "groggy"],
      reason:
        "Communication tasks like emails and meetings work well during the afternoon dip when deep focus is naturally lower.",
    };
  }

  // Default recommendation
  return {
    recommended: ["peak", "dip"],
    avoid: ["melatonin"],
    reason:
      "Schedule tasks based on their complexity: save peak windows for demanding work, use dip windows for lighter tasks.",
  };
}

// ============================================================================
// Tool: Get Today's Energy Schedule
// ============================================================================

export const getTodaysEnergyScheduleTool = new FunctionTool({
  name: "get_todays_energy_schedule",
  description:
    "Get the energy schedule for today based on WHOOP data. Returns energy segments (peak, dip, groggy, wind-down, melatonin) with their time windows, plus the current and next segment.",
  parameters: {
    type: Type.OBJECT,
    properties: {},
    required: [],
  },
  execute: async () => {
    try {
      const schedule = await getTodayEnergySchedule(APP_USER_ID);

      if (!schedule) {
        return {
          status: "not_found",
          message:
            "No energy schedule found for today. WHOOP data may not have been synced yet.",
          date: new Date().toISOString().split("T")[0],
        };
      }

      const formatted = formatScheduleForOutput(schedule as EnergySchedule);

      return {
        status: "success",
        ...formatted,
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
// Tool: Get Energy Schedule for Date
// ============================================================================

const getEnergyForDateSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    date: {
      type: Type.STRING,
      description: "The date to get energy schedule for (YYYY-MM-DD format)",
    },
  },
  required: ["date"],
};

export const getEnergyForDateTool = new FunctionTool({
  name: "get_energy_for_date",
  description:
    "Get the energy schedule for a specific date. Returns energy segments (peak, dip, groggy, wind-down, melatonin) with their time windows.",
  parameters: getEnergyForDateSchema,
  execute: async (input) => {
    const { date } = input as GetEnergyForDateParams;

    try {
      const schedule = await getEnergyScheduleForDate({
        userId: APP_USER_ID,
        dayDate: date,
      });

      if (!schedule) {
        return {
          status: "not_found",
          message: `No energy schedule found for ${date}. WHOOP data may not have been synced for this date.`,
          date,
        };
      }

      const formatted = formatScheduleForOutput(schedule as EnergySchedule);

      return {
        status: "success",
        ...formatted,
      };
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unknown error occurred";
      return {
        status: "error",
        error: message,
        date,
      };
    }
  },
});

// ============================================================================
// Tool: Recommend Task Timing
// ============================================================================

const recommendTaskTimingSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    taskPriority: {
      type: Type.STRING,
      description:
        "The priority of the task (Very Low, Low, Medium, High, Very High)",
    },
    taskType: {
      type: Type.STRING,
      description:
        "Optional task type (e.g., Development, Communication, Discovery, Design)",
    },
    estimatedDuration: {
      type: Type.NUMBER,
      description: "Optional estimated duration in minutes",
    },
  },
  required: ["taskPriority"],
};

export const recommendTaskTimingTool = new FunctionTool({
  name: "recommend_task_timing",
  description:
    "Given a task priority and optional type, recommend the optimal energy window for scheduling it. Uses today's energy schedule to provide specific time recommendations.",
  parameters: recommendTaskTimingSchema,
  execute: async (input) => {
    const { taskPriority, taskType, estimatedDuration } =
      input as RecommendTaskTimingParams;

    try {
      // Get today's schedule
      const schedule = await getTodayEnergySchedule(APP_USER_ID);
      const recommendations = getRecommendedWindows(taskPriority, taskType);

      if (!schedule) {
        return {
          status: "partial",
          message:
            "No energy schedule available for today, but here are general recommendations.",
          taskPriority,
          taskType: taskType || null,
          estimatedDuration: estimatedDuration || null,
          ...recommendations,
          specificWindows: null,
        };
      }

      // Find matching segments from today's schedule
      const typedSchedule = schedule as EnergySchedule;
      const matchingSegments = typedSchedule.segments.filter((seg) =>
        recommendations.recommended.includes(seg.category)
      );

      const specificWindows = matchingSegments.map((seg) => ({
        category: seg.category,
        label: seg.label,
        startTime: seg.start_at_formatted || seg.start_at,
        endTime: seg.end_at_formatted || seg.end_at,
      }));

      return {
        status: "success",
        taskPriority,
        taskType: taskType || null,
        estimatedDuration: estimatedDuration || null,
        ...recommendations,
        specificWindows,
        currentSegment: typedSchedule.currentSegment
          ? {
              category: typedSchedule.currentSegment.category,
              label: typedSchedule.currentSegment.label,
              isRecommended: recommendations.recommended.includes(
                typedSchedule.currentSegment.category
              ),
            }
          : null,
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

export const energyTools = [
  getTodaysEnergyScheduleTool,
  getEnergyForDateTool,
  recommendTaskTimingTool,
];
