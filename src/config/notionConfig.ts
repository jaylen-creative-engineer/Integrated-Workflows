/**
 * Notion Database Configuration
 *
 * This file contains database IDs and property mappings for all Notion integrations.
 * Property names map to the exact Notion property names in each database.
 */

export type NotionPropertyType =
  | "title"
  | "rich_text"
  | "number"
  | "select"
  | "multi_select"
  | "status"
  | "date"
  | "people"
  | "checkbox"
  | "url"
  | "email"
  | "phone_number"
  | "relation"
  | "rollup"
  | "formula"
  | "created_by"
  | "created_time"
  | "last_edited_by"
  | "last_edited_time";

export interface PropertyConfig {
  name: string;
  type: NotionPropertyType;
  description?: string;
}

export interface DatabaseConfig {
  databaseId: string;
  description: string;
  properties: Record<string, PropertyConfig>;
}

export interface NotionConfig {
  projects: DatabaseConfig;
  tasks: DatabaseConfig;
  ideas: DatabaseConfig;
  meetings: DatabaseConfig;
  gameplans: DatabaseConfig;
  content: DatabaseConfig;
}

export const notionConfig: NotionConfig = {
  /**
   * Projects / Initiatives Database
   * Used for product briefs and initiative tracking
   */
  projects: {
    databaseId: "dd9da9ff-aad6-4e0f-a440-5cf404d391f0",
    description: "Initiatives / Product Briefs",
    properties: {
      title: {
        name: "Project name",
        type: "title",
        description: "The name of the project/initiative",
      },
      summary: {
        name: "Summary",
        type: "rich_text",
        description: "Project summary or description",
      },
      status: {
        name: "Status",
        type: "status",
        description: "Planning, In Progress, Paused, Backlog, Done, Canceled",
      },
      priority: {
        name: "Priority",
        type: "select",
        description: "Low, Medium, High",
      },
      initiative: {
        name: "Initiative",
        type: "multi_select",
        description: "BENgineers, Stori, Personal, Creative Studio, Work",
      },
      dates: {
        name: "Dates",
        type: "date",
        description: "Project date range",
      },
      tasks: {
        name: "Tasks",
        type: "relation",
        description: "Related tasks from the Tasks database",
      },
      owner: {
        name: "Owner",
        type: "people",
        description: "Project owner(s)",
      },
    },
  },

  /**
   * Tasks Database
   * Linked to projects for task tracking
   */
  tasks: {
    databaseId: "65583acf-2a6a-47c1-881a-14a40ff8c3d7",
    description: "Tasks linked to projects",
    properties: {
      // Core properties
      title: {
        name: "Task name",
        type: "title",
        description: "The task title",
      },
      status: {
        name: "Status",
        type: "status",
        description: "Backlog, To Do, In Progress, Ongoing, Done, Archived",
      },
      project: {
        name: "Project",
        type: "relation",
        description: "Related project/initiative",
      },
      dueDate: {
        name: "Due",
        type: "date",
        description: "Task due date",
      },
      assignee: {
        name: "Assignee",
        type: "people",
        description: "Person assigned to the task",
      },
      // Additional properties
      priority: {
        name: "Priority",
        type: "select",
        description: "Very Low, Low, Medium, High, Very High",
      },
      tags: {
        name: "Tags",
        type: "multi_select",
        description:
          "Mobile, Website, Improvement, Leadership, Communication, Financial",
      },
      taskType: {
        name: "Task Type",
        type: "multi_select",
        description:
          "Discovery, Development, Completed, Current Delivery, Communication, etc.",
      },
      summary: {
        name: "Summary",
        type: "rich_text",
        description: "AI-generated or manual summary",
      },
      timeEstimates: {
        name: "Time Estimates",
        type: "select",
        description: "Estimated time to complete",
      },
      // Timer/tracking properties
      timerStatus: {
        name: "Timer Status",
        type: "status",
        description: "Not started, Running..., Stopped..., In progress, Done",
      },
      startTime: {
        name: "Start Time",
        type: "date",
        description: "When work started",
      },
      endTime: {
        name: "End Time",
        type: "date",
        description: "When work ended",
      },
      // Hierarchy & dependencies
      subTasks: {
        name: "Sub-tasks",
        type: "relation",
        description: "Child tasks",
      },
      parentTask: {
        name: "Parent-task",
        type: "relation",
        description: "Parent task",
      },
      blockedBy: {
        name: "Blocked by",
        type: "relation",
        description: "Tasks blocking this one",
      },
      blocking: {
        name: "Blocking",
        type: "relation",
        description: "Tasks this one is blocking",
      },
    },
  },

  /**
   * Ideas Database (Idea Library)
   * For capturing raw ideas, notes, and thoughts before they become projects
   */
  ideas: {
    databaseId: "f7dc1a71-66b0-4c3f-b361-9b418104e990",
    description: "Idea Library - Raw ideas and notes capture",
    properties: {
      // Core content
      title: {
        name: "Title",
        type: "title",
        description: "The idea title",
      },
      summary: {
        name: "Summary",
        type: "rich_text",
        description: "Brief summary of the idea",
      },
      aiSummary: {
        name: "AI summary",
        type: "rich_text",
        description: "AI-generated summary",
      },

      // Categorization
      tags: {
        name: "Tags",
        type: "multi_select",
        description:
          "Research, Technology, Creative, Culture, Content, Workflows, Discplines, Wins, Development Plans, Wellness, Delivery, Books",
      },
      hidden: {
        name: "Hidden",
        type: "multi_select",
        description: "Set to 'True' to hide from views",
      },

      // Status tracking
      status: {
        name: "Status",
        type: "select",
        description:
          "Follow Through, Follow Up, To Do, In progress, Completed, On Deck, Canceled, Continued Efforts, Backlog, AI Task, Dump",
      },
      status1: {
        name: "Status 1",
        type: "status",
        description: "Backlog, To Do, In Progress, Ongoing, Done, Archived",
      },
      timerStatus: {
        name: "Timer Status",
        type: "status",
        description: "Not started, Running..., Stopped..., In progress, Done",
      },

      // Time tracking
      startTime: {
        name: "Start Time",
        type: "date",
        description: "When work on this idea started",
      },
      endTime: {
        name: "End Time",
        type: "date",
        description: "When work on this idea ended",
      },
    },
  },

  /**
   * Meetings Database
   * Calendar meetings synced from Notion Calendar
   */
  meetings: {
    databaseId: "68299a86-b820-4ed5-b898-4bcf70e887c4",
    description: "Calendar meetings with attendees",
    properties: {
      title: {
        name: "Name",
        type: "title",
        description: "Meeting name/title",
      },
      eventTime: {
        name: "Event time",
        type: "date",
        description: "Meeting date and time",
      },
      attendees: {
        name: "Attendees",
        type: "people",
        description: "Meeting attendees",
      },
      createdBy: {
        name: "Created by",
        type: "created_by",
        description: "User who created the meeting",
      },
    },
  },

  /**
   * Gameplans Database
   * Daily briefs and strategic documents generated by agents
   */
  gameplans: {
    databaseId: "17882787-0ecb-8025-bfcc-ceb14233df9b",
    description: "Daily briefs and strategic gameplans",
    properties: {
      title: {
        name: "Doc name",
        type: "title",
        description: "The gameplan document title",
      },
      summary: {
        name: "Summary",
        type: "rich_text",
        description: "High-level summary of the gameplan",
      },
      status: {
        name: "Status",
        type: "status",
        description: "Draft, Proposed, Accepted, Archived, Rejected",
      },
      priority: {
        name: "Priority",
        type: "select",
        description: "High (or other priority levels)",
      },
      category: {
        name: "Category",
        type: "multi_select",
        description:
          "Playbook, Personal Brand, Talks, Gameplan, Technical, Content, Lifestyle",
      },
      createdTime: {
        name: "Created time",
        type: "created_time",
        description: "When the gameplan was created",
      },
      createdBy: {
        name: "Created by",
        type: "created_by",
        description: "User who created the gameplan",
      },
    },
  },

  /**
   * Content Database
   * For content planning, outlines, and drafts
   */
  content: {
    databaseId: "20682787-0ecb-802a-b76d-f97d4e0c5251",
    description: "Content planning and drafts",
    properties: {
      title: {
        name: "Post name",
        type: "title",
        description: "The content title",
      },
      status: {
        name: "Status",
        type: "status",
        description: "Post Idea, Draft, Ready for Review, Scheduled, Published, Cancelled",
      },
      contentGoal: {
        name: "Content Goal",
        type: "select",
        description: "Awareness, Education, Conversion, Engagement",
      },
      platform: {
        name: "Platform",
        type: "multi_select",
        description: "Linkedin, TikTok, X, YouTube, Instagram",
      },
      contentType: {
        name: "Content type",
        type: "multi_select",
        description: "Text, Image / photo, Video, Link, Carousel, Poll, Story, Live stream",
      },
      targetAudience: {
        name: "Target Audience",
        type: "select",
        description: "Beginner, Intermediate, Advanced, Mixed",
      },
      targetAudiences: {
        name: "Target audiences",
        type: "multi_select",
        description: "Segment 1, Segment 2, Segment 3",
      },
      postDate: {
        name: "Post date",
        type: "date",
        description: "Scheduled or published date",
      },
      strategicIntent: {
        name: "Strategic Intent",
        type: "rich_text",
        description: "Strategic intent for the content",
      },
      editorInstructions: {
        name: "Editor Instructions",
        type: "rich_text",
        description: "Instructions for editing",
      },
      successMetrics: {
        name: "Success Metrics",
        type: "rich_text",
        description: "Success metrics for the content",
      },
      editingWorkflow: {
        name: "Editing Workflow",
        type: "select",
        description: "Educational, Motivational, Tutorial, Conceptual",
      },
      postUrl: {
        name: "Post URL",
        type: "url",
        description: "URL to published content",
      },
      owner: {
        name: "Owner",
        type: "people",
        description: "Content owner",
      },
    },
  },
};

/**
 * Helper to get property name from config
 */
export function getPropertyName(
  database: keyof NotionConfig,
  propertyKey: string
): string {
  const dbConfig = notionConfig[database];
  const prop = dbConfig.properties[propertyKey];
  if (!prop) {
    throw new Error(
      `Property "${propertyKey}" not found in ${database} config`
    );
  }
  return prop.name;
}

/**
 * Helper to get database ID
 */
export function getDatabaseId(database: keyof NotionConfig): string {
  const id = notionConfig[database].databaseId;
  if (!id) {
    throw new Error(`Database ID not configured for ${database}`);
  }
  return id;
}

// ============================================================================
// Ideas Domain Types & Constants
// ============================================================================

/**
 * Valid status values for Ideas (select property)
 */
export const IdeaStatus = {
  FOLLOW_THROUGH: "Follow Through",
  FOLLOW_UP: "Follow Up",
  TODO: "To Do",
  IN_PROGRESS: "In progress",
  COMPLETED: "Completed",
  ON_DECK: "On Deck",
  CANCELED: "Canceled",
  CONTINUED_EFFORTS: "Continued Efforts",
  BACKLOG: "Backlog",
  AI_TASK: "AI Task",
  DUMP: "Dump",
} as const;

export type IdeaStatusValue = (typeof IdeaStatus)[keyof typeof IdeaStatus];

/**
 * Valid status1 values for Ideas (status property)
 */
export const IdeaStatus1 = {
  BACKLOG: "Backlog",
  TODO: "To Do",
  IN_PROGRESS: "In Progress",
  ONGOING: "Ongoing",
  DONE: "Done",
  ARCHIVED: "Archived",
} as const;

export type IdeaStatus1Value = (typeof IdeaStatus1)[keyof typeof IdeaStatus1];

/**
 * Valid timer status values for Ideas
 */
export const IdeaTimerStatus = {
  NOT_STARTED: "Not started",
  RUNNING: "Running...",
  STOPPED: "Stopped...",
  IN_PROGRESS: "In progress",
  DONE: "Done",
} as const;

export type IdeaTimerStatusValue =
  (typeof IdeaTimerStatus)[keyof typeof IdeaTimerStatus];

/**
 * Valid tag values for Ideas
 */
export const IdeaTags = {
  RESEARCH: "Research",
  TECHNOLOGY: "Technology",
  CREATIVE: "Creative",
  CULTURE: "Culture",
  CONTENT: "Content",
  WORKFLOWS: "Workflows",
  DISCIPLINES: "Discplines", // Note: typo in original Notion schema
  WINS: "Wins",
  DEVELOPMENT_PLANS: "Development Plans",
  WELLNESS: "Wellness",
  DELIVERY: "Delivery",
  BOOKS: "Books",
} as const;

export type IdeaTagValue = (typeof IdeaTags)[keyof typeof IdeaTags];

// ============================================================================
// Gameplans Domain Types & Constants
// ============================================================================

/**
 * Valid status values for Gameplans (status property)
 */
export const GameplanStatus = {
  DRAFT: "Draft",
  PROPOSED: "Proposed",
  ACCEPTED: "Accepted",
  ARCHIVED: "Archived",
  REJECTED: "Rejected",
} as const;

export type GameplanStatusValue =
  (typeof GameplanStatus)[keyof typeof GameplanStatus];

/**
 * Valid category values for Gameplans (multi_select property)
 */
export const GameplanCategory = {
  PLAYBOOK: "Playbook",
  PERSONAL_BRAND: "Personal Brand",
  TALKS: "Talks",
  GAMEPLAN: "Gameplan",
  TECHNICAL: "Technical",
  CONTENT: "Content",
  LIFESTYLE: "Lifestyle",
} as const;

export type GameplanCategoryValue =
  (typeof GameplanCategory)[keyof typeof GameplanCategory];

/**
 * Valid priority values for Gameplans (select property)
 */
export const GameplanPriority = {
  HIGH: "High",
} as const;

export type GameplanPriorityValue =
  (typeof GameplanPriority)[keyof typeof GameplanPriority];

// ============================================================================
// Content Domain Types & Constants
// ============================================================================

/**
 * Valid status values for Content (status property)
 */
export const ContentStatus = {
  POST_IDEA: "Post Idea",
  DRAFT: "Draft",
  READY_FOR_REVIEW: "Ready for Review",
  SCHEDULED: "Scheduled",
  PUBLISHED: "Published",
  CANCELLED: "Cancelled",
} as const;

export type ContentStatusValue =
  (typeof ContentStatus)[keyof typeof ContentStatus];

/**
 * Valid content goal values for Content (select property)
 */
export const ContentGoal = {
  AWARENESS: "Awareness",
  EDUCATION: "Education",
  CONVERSION: "Conversion",
  ENGAGEMENT: "Engagement",
} as const;

export type ContentGoalValue = (typeof ContentGoal)[keyof typeof ContentGoal];

/**
 * Valid platform values for Content (multi_select property)
 */
export const ContentPlatform = {
  LINKEDIN: "Linkedin",
  TIKTOK: "TikTok",
  X: "X",
  YOUTUBE: "YouTube",
  INSTAGRAM: "Instagram",
} as const;

export type ContentPlatformValue =
  (typeof ContentPlatform)[keyof typeof ContentPlatform];

/**
 * Valid content type values for Content (multi_select property)
 */
export const ContentType = {
  TEXT: "Text",
  IMAGE_PHOTO: "Image / photo",
  VIDEO: "Video",
  LINK: "Link",
  CAROUSEL: "Carousel",
  POLL: "Poll",
  STORY: "Story",
  LIVE_STREAM: "Live stream",
} as const;

export type ContentTypeValue = (typeof ContentType)[keyof typeof ContentType];

/**
 * Valid target audience values for Content (select property)
 */
export const ContentTargetAudience = {
  BEGINNER: "Beginner",
  INTERMEDIATE: "Intermediate",
  ADVANCED: "Advanced",
  MIXED: "Mixed",
} as const;

export type ContentTargetAudienceValue =
  (typeof ContentTargetAudience)[keyof typeof ContentTargetAudience];

/**
 * Valid editing workflow values for Content (select property)
 */
export const ContentEditingWorkflow = {
  EDUCATIONAL: "Educational",
  MOTIVATIONAL: "Motivational",
  TUTORIAL: "Tutorial",
  CONCEPTUAL: "Conceptual",
} as const;

export type ContentEditingWorkflowValue =
  (typeof ContentEditingWorkflow)[keyof typeof ContentEditingWorkflow];
