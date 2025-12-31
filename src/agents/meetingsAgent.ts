import { FunctionTool } from "@google/adk";
import { Schema, Type } from "@google/genai";
import {
  createMeeting,
  queryMeetingsByDate,
  queryMeetingsByDateRange,
  normalizeMeetingResponse,
  getTodaysMeetings,
  getUpcomingMeetings,
} from "../services/notion/index.js";

// ============================================================================
// Query Meetings for a Day
// ============================================================================

type QueryMeetingsParams = {
  date: string;
};

const queryMeetingsSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    date: {
      type: Type.STRING,
      description: "The date to query meetings for (YYYY-MM-DD format)",
    },
  },
  required: ["date"],
};

export const buildMeetingContextsForDay = new FunctionTool({
  name: "build_meeting_contexts_for_day",
  description:
    "Query meetings from Notion for a specific date. Returns meeting titles, times, and attendees.",
  parameters: queryMeetingsSchema,
  execute: async (input) => {
    const { date } = input as QueryMeetingsParams;

    try {
      const pages = await queryMeetingsByDate(date);
      const meetings = pages.map(normalizeMeetingResponse);

      return {
        status: "success",
        date,
        count: meetings.length,
        meetings: meetings.map((m) => ({
          meetingId: m.pageId,
          notionUrl: m.url,
          title: m.title,
          eventTime: m.eventTime,
          eventTimeEnd: m.eventTimeEnd,
          attendeeIds: m.attendeeIds,
        })),
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
// Get Today's Meetings
// ============================================================================

export const getTodaysMeetingsTool = new FunctionTool({
  name: "get_todays_meetings",
  description:
    "Get all meetings scheduled for today. Useful for daily planning and context.",
  parameters: {
    type: Type.OBJECT,
    properties: {},
    required: [],
  },
  execute: async () => {
    try {
      const meetings = await getTodaysMeetings();

      return {
        status: "success",
        date: new Date().toISOString().split("T")[0],
        count: meetings.length,
        meetings: meetings.map((m) => ({
          meetingId: m.pageId,
          notionUrl: m.url,
          title: m.title,
          eventTime: m.eventTime,
          eventTimeEnd: m.eventTimeEnd,
          attendeeIds: m.attendeeIds,
        })),
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
// Get Upcoming Meetings
// ============================================================================

type UpcomingMeetingsParams = {
  days?: number;
};

const upcomingMeetingsSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    days: {
      type: Type.NUMBER,
      description:
        "Number of days ahead to look for meetings (default: 7, max: 30)",
    },
  },
  required: [],
};

export const getUpcomingMeetingsTool = new FunctionTool({
  name: "get_upcoming_meetings",
  description:
    "Get meetings scheduled for the upcoming days. Useful for weekly planning.",
  parameters: upcomingMeetingsSchema,
  execute: async (input) => {
    const { days = 7 } = input as UpcomingMeetingsParams;
    const limitedDays = Math.min(days, 30);

    try {
      const meetings = await getUpcomingMeetings(limitedDays);

      const today = new Date();
      const endDate = new Date(today);
      endDate.setDate(endDate.getDate() + limitedDays);

      return {
        status: "success",
        startDate: today.toISOString().split("T")[0],
        endDate: endDate.toISOString().split("T")[0],
        days: limitedDays,
        count: meetings.length,
        meetings: meetings.map((m) => ({
          meetingId: m.pageId,
          notionUrl: m.url,
          title: m.title,
          eventTime: m.eventTime,
          eventTimeEnd: m.eventTimeEnd,
          attendeeIds: m.attendeeIds,
        })),
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
// Query Meetings by Date Range
// ============================================================================

type DateRangeParams = {
  startDate: string;
  endDate: string;
};

const dateRangeSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    startDate: {
      type: Type.STRING,
      description: "Start date (YYYY-MM-DD format)",
    },
    endDate: {
      type: Type.STRING,
      description: "End date (YYYY-MM-DD format)",
    },
  },
  required: ["startDate", "endDate"],
};

export const getMeetingsByDateRange = new FunctionTool({
  name: "get_meetings_by_date_range",
  description: "Query meetings within a specific date range.",
  parameters: dateRangeSchema,
  execute: async (input) => {
    const { startDate, endDate } = input as DateRangeParams;

    try {
      const pages = await queryMeetingsByDateRange(startDate, endDate);
      const meetings = pages.map(normalizeMeetingResponse);

      return {
        status: "success",
        startDate,
        endDate,
        count: meetings.length,
        meetings: meetings.map((m) => ({
          meetingId: m.pageId,
          notionUrl: m.url,
          title: m.title,
          eventTime: m.eventTime,
          eventTimeEnd: m.eventTimeEnd,
          attendeeIds: m.attendeeIds,
        })),
      };
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unknown error occurred";
      return {
        status: "error",
        error: message,
        startDate,
        endDate,
      };
    }
  },
});

// ============================================================================
// Create a New Meeting
// ============================================================================

type CreateMeetingParams = {
  title: string;
  eventTime: string;
  eventTimeEnd?: string;
  attendeeIds?: string[];
};

const createMeetingSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    title: { type: Type.STRING, description: "Meeting title/name" },
    eventTime: {
      type: Type.STRING,
      description:
        "Meeting start date and time (ISO format, e.g., 2025-01-15T10:00:00)",
    },
    eventTimeEnd: {
      type: Type.STRING,
      description: "Meeting end date and time (ISO format, optional)",
    },
    attendeeIds: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: "Array of Notion user IDs for attendees (optional)",
    },
  },
  required: ["title", "eventTime"],
};

export const scheduleMeeting = new FunctionTool({
  name: "schedule_meeting",
  description: "Create a new meeting in the Notion Meetings database.",
  parameters: createMeetingSchema,
  execute: async (input) => {
    const { title, eventTime, eventTimeEnd, attendeeIds } =
      input as CreateMeetingParams;

    try {
      const meeting = await createMeeting({
        title,
        eventTime,
        eventTimeEnd,
        attendeeIds,
      });

      return {
        status: "success",
        meetingId: meeting.pageId,
        notionUrl: meeting.url,
        title,
        eventTime,
        eventTimeEnd: eventTimeEnd || null,
        attendeeIds: attendeeIds || [],
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
// Exported Tools
// ============================================================================

export const meetingsTools = [
  buildMeetingContextsForDay,
  getTodaysMeetingsTool,
  getUpcomingMeetingsTool,
  getMeetingsByDateRange,
  scheduleMeeting,
];
