import type {
  IdeaStatusValue,
  IdeaStatus1Value,
  IdeaTagValue,
  GameplanStatusValue,
  GameplanCategoryValue,
  GameplanPriorityValue,
  ContentStatusValue,
  ContentGoalValue,
  ContentPlatformValue,
  ContentTypeValue,
  ContentTargetAudienceValue,
  ContentEditingWorkflowValue,
} from "../../config/notionConfig.js";

/**
 * Shared Types
 * All input/output interfaces for Notion service operations
 */

// --- Projects / Initiatives ---

export interface CreateProjectInput {
  title: string;
  summary?: string;
  status?: string;
  priority?: string;
  initiative?: string[];
  dates?: { start: string; end?: string };
}

// --- Tasks ---

export interface CreateTaskInput {
  title: string;
  status?: string;
  projectId?: string;
  dueDate?: string;
  assigneeId?: string;
  priority?: string;
  tags?: string[];
  taskType?: string[];
  summary?: string;
}

// --- Ideas ---

/**
 * Input for creating a new Idea in Notion
 */
export interface CreateIdeaInput {
  /** Required: The idea title */
  title: string;
  /** Optional: Brief summary of the idea */
  summary?: string;
  /** Optional: AI-generated summary */
  aiSummary?: string;
  /** Optional: Tags for categorization */
  tags?: IdeaTagValue[];
  /** Optional: Status (select) - defaults to "Backlog" */
  status?: IdeaStatusValue;
  /** Optional: Status 1 (status property) */
  status1?: IdeaStatus1Value;
  /** Optional: Start time for the idea */
  startTime?: string;
  /** Optional: End time for the idea */
  endTime?: string;
  /** Optional: Hide from views */
  hidden?: boolean;
}

/**
 * Input for updating an existing Idea
 */
export interface UpdateIdeaInput {
  pageId: string;
  title?: string;
  summary?: string;
  aiSummary?: string;
  tags?: IdeaTagValue[];
  status?: IdeaStatusValue;
  status1?: IdeaStatus1Value;
  startTime?: string;
  endTime?: string;
  hidden?: boolean;
}

/**
 * Normalized Idea response object
 */
export interface IdeaResponse {
  pageId: string;
  url: string;
  title: string;
  summary: string | null;
  aiSummary: string | null;
  tags: string[];
  status: string | null;
  status1: string | null;
  timerStatus: string | null;
  startTime: string | null;
  endTime: string | null;
  createdTime: string;
  lastEditedTime: string;
}

// --- Meetings ---

export interface CreateMeetingInput {
  title: string;
  eventTime: string;
  eventTimeEnd?: string;
  attendeeIds?: string[];
}

/**
 * Normalized Meeting response object
 */
export interface MeetingResponse {
  pageId: string;
  url: string;
  title: string;
  eventTime: string | null;
  eventTimeEnd: string | null;
  attendeeIds: string[];
  createdTime: string;
  lastEditedTime: string;
}

// --- Gameplans ---

/**
 * Input for creating a new Gameplan in Notion
 */
export interface CreateGameplanInput {
  /** Required: The gameplan document title */
  title: string;
  /** Optional: High-level summary of the gameplan */
  summary?: string;
  /** Optional: Status - defaults to "Draft" */
  status?: GameplanStatusValue;
  /** Optional: Priority level */
  priority?: GameplanPriorityValue;
  /** Optional: Categories for the gameplan */
  category?: GameplanCategoryValue[];
  /** Optional: Page body content blocks */
  contentBlocks?: import("@notionhq/client/build/src/api-endpoints.js").CreatePageParameters["children"];
}

/**
 * Normalized Gameplan response object
 */
export interface GameplanResponse {
  pageId: string;
  url: string;
  title: string;
  summary: string | null;
  status: string | null;
  priority: string | null;
  category: string[];
  createdTime: string;
  lastEditedTime: string;
}

// --- Content ---

export interface CreateContentInput {
  title: string;
  status?: ContentStatusValue;
  contentGoal?: ContentGoalValue;
  platform?: ContentPlatformValue[];
  contentType?: ContentTypeValue[];
  targetAudience?: ContentTargetAudienceValue;
  targetAudiences?: string[];
  postDate?: string;
  strategicIntent?: string;
  editorInstructions?: string;
  successMetrics?: string;
  editingWorkflow?: ContentEditingWorkflowValue;
  postUrl?: string;
  owner?: string[];
  contentBlocks?: import("@notionhq/client/build/src/api-endpoints.js").CreatePageParameters["children"];
}

export interface UpdateContentInput {
  pageId: string;
  title?: string;
  status?: ContentStatusValue;
  contentGoal?: ContentGoalValue;
  platform?: ContentPlatformValue[];
  contentType?: ContentTypeValue[];
  targetAudience?: ContentTargetAudienceValue;
  targetAudiences?: string[];
  postDate?: string;
  strategicIntent?: string;
  editorInstructions?: string;
  successMetrics?: string;
  editingWorkflow?: ContentEditingWorkflowValue;
  postUrl?: string;
  owner?: string[];
}

export interface ContentResponse {
  pageId: string;
  url: string;
  title: string;
  status: string | null;
  contentGoal: string | null;
  platform: string[];
  contentType: string[];
  targetAudience: string | null;
  targetAudiences: string[];
  postDate: string | null;
  strategicIntent: string | null;
  editorInstructions: string | null;
  successMetrics: string | null;
  editingWorkflow: string | null;
  postUrl: string | null;
  createdTime: string;
  lastEditedTime: string;
}

