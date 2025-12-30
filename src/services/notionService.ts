import { Client } from "@notionhq/client";
import type {
  CreatePageParameters,
  UpdatePageParameters,
  QueryDataSourceParameters,
  PageObjectResponse,
  PartialPageObjectResponse,
  DatabaseObjectResponse,
} from "@notionhq/client/build/src/api-endpoints.js";
import {
  notionConfig,
  getDatabaseId,
  type NotionConfig,
  type IdeaStatusValue,
  type IdeaStatus1Value,
  type IdeaTagValue,
  IdeaStatus,
} from "../config/notionConfig.js";

/**
 * Notion Service
 * Provides CRUD operations for Notion databases used by agents
 */

// Initialize Notion client
const notion = new Client({
  auth: process.env.NOTION_API_KEY,
});

// Type guard for full page responses
function isFullPage(
  page: PageObjectResponse | PartialPageObjectResponse
): page is PageObjectResponse {
  return "properties" in page;
}

// ============================================================================
// Generic CRUD Operations
// ============================================================================

// Query options type for dataSources.query
type QueryOptions = Omit<QueryDataSourceParameters, "data_source_id">;

/**
 * Query a Notion database with filters and sorts
 * Uses the dataSources.query API (database_id is treated as data_source_id)
 */
export async function queryDatabase(
  databaseKey: keyof NotionConfig,
  options: QueryOptions = {}
): Promise<PageObjectResponse[]> {
  const databaseId = getDatabaseId(databaseKey);

  const response = await notion.dataSources.query({
    data_source_id: databaseId,
    ...options,
  });

  return response.results.filter(isFullPage);
}

/**
 * Create a page in a Notion database
 */
export async function createPage(
  databaseKey: keyof NotionConfig,
  properties: CreatePageParameters["properties"],
  children?: CreatePageParameters["children"]
): Promise<PageObjectResponse> {
  const databaseId = getDatabaseId(databaseKey);

  const response = await notion.pages.create({
    parent: { database_id: databaseId },
    properties,
    ...(children && { children }),
  });

  if (!isFullPage(response)) {
    throw new Error("Failed to create page - partial response received");
  }

  return response;
}

/**
 * Update an existing Notion page
 */
export async function updatePage(
  pageId: string,
  properties: UpdatePageParameters["properties"]
): Promise<PageObjectResponse> {
  const response = await notion.pages.update({
    page_id: pageId,
    properties,
  });

  if (!isFullPage(response)) {
    throw new Error("Failed to update page - partial response received");
  }

  return response;
}

/**
 * Get a single page by ID
 */
export async function getPage(pageId: string): Promise<PageObjectResponse> {
  const response = await notion.pages.retrieve({ page_id: pageId });

  if (!isFullPage(response)) {
    throw new Error("Failed to retrieve page - partial response received");
  }

  return response;
}

/**
 * Retrieve database schema/metadata
 */
export async function getDatabase(
  databaseKey: keyof NotionConfig
): Promise<DatabaseObjectResponse> {
  const databaseId = getDatabaseId(databaseKey);
  return (await notion.databases.retrieve({
    database_id: databaseId,
  })) as DatabaseObjectResponse;
}

// ============================================================================
// Property Builders - Helpers to construct Notion property values
// ============================================================================

export const propertyBuilders = {
  title: (text: string) => ({
    title: [{ text: { content: text } }],
  }),

  richText: (text: string) => ({
    rich_text: [{ text: { content: text } }],
  }),

  select: (name: string) => ({
    select: { name },
  }),

  multiSelect: (names: string[]) => ({
    multi_select: names.map((name) => ({ name })),
  }),

  status: (name: string) => ({
    status: { name },
  }),

  date: (start: string, end?: string) => ({
    date: { start, ...(end && { end }) },
  }),

  number: (value: number) => ({
    number: value,
  }),

  checkbox: (checked: boolean) => ({
    checkbox: checked,
  }),

  url: (url: string) => ({
    url,
  }),

  relation: (pageIds: string[]) => ({
    relation: pageIds.map((id) => ({ id })),
  }),

  people: (userIds: string[]) => ({
    people: userIds.map((id) => ({ id })),
  }),
};

// ============================================================================
// Property Extractors - Helpers to extract values from Notion properties
// ============================================================================

export function extractPropertyValue(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  property: any
): string | number | boolean | string[] | null {
  if (!property) return null;

  switch (property.type) {
    case "title":
      return property.title?.[0]?.plain_text || "";
    case "rich_text":
      return property.rich_text?.[0]?.plain_text || "";
    case "number":
      return property.number;
    case "select":
      return property.select?.name || null;
    case "multi_select":
      return property.multi_select?.map((s: { name: string }) => s.name) || [];
    case "status":
      return property.status?.name || null;
    case "date":
      return property.date?.start || null;
    case "checkbox":
      return property.checkbox;
    case "url":
      return property.url;
    case "email":
      return property.email;
    case "phone_number":
      return property.phone_number;
    case "relation":
      return property.relation?.map((r: { id: string }) => r.id) || [];
    case "people":
      return property.people?.map((p: { id: string }) => p.id) || [];
    case "formula":
      return property.formula?.[property.formula.type] || null;
    case "rollup":
      return property.rollup?.[property.rollup.type] || null;
    default:
      return null;
  }
}

// ============================================================================
// Domain-Specific Operations
// ============================================================================

// --- Projects / Initiatives ---

export interface CreateProjectInput {
  title: string;
  summary?: string;
  status?: string;
  priority?: string;
  initiative?: string[];
  dates?: { start: string; end?: string };
}

export async function createProject(
  input: CreateProjectInput
): Promise<{ pageId: string; url: string }> {
  const props = notionConfig.projects.properties;

  const properties: CreatePageParameters["properties"] = {
    [props.title.name]: propertyBuilders.title(input.title),
  };

  if (input.summary) {
    properties[props.summary.name] = propertyBuilders.richText(input.summary);
  }
  if (input.status) {
    properties[props.status.name] = propertyBuilders.status(input.status);
  }
  if (input.priority) {
    properties[props.priority.name] = propertyBuilders.select(input.priority);
  }
  if (input.initiative) {
    properties[props.initiative.name] = propertyBuilders.multiSelect(
      input.initiative
    );
  }
  if (input.dates) {
    properties[props.dates.name] = propertyBuilders.date(
      input.dates.start,
      input.dates.end
    );
  }

  const page = await createPage("projects", properties);

  return {
    pageId: page.id,
    url: page.url,
  };
}

export async function queryProjects(filter?: {
  status?: string;
  initiative?: string;
}): Promise<PageObjectResponse[]> {
  const props = notionConfig.projects.properties;
  const filters: Array<QueryDataSourceParameters["filter"]> = [];

  if (filter?.status) {
    filters.push({
      property: props.status.name,
      status: { equals: filter.status },
    });
  }

  if (filter?.initiative) {
    filters.push({
      property: props.initiative.name,
      multi_select: { contains: filter.initiative },
    });
  }

  const queryFilter: QueryDataSourceParameters["filter"] | undefined =
    filters.length > 1
      ? ({ and: filters } as QueryDataSourceParameters["filter"])
      : filters.length === 1
      ? filters[0]
      : undefined;

  return queryDatabase("projects", { filter: queryFilter });
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

export async function createTask(
  input: CreateTaskInput
): Promise<{ pageId: string; url: string }> {
  const props = notionConfig.tasks.properties;

  const properties: CreatePageParameters["properties"] = {
    [props.title.name]: propertyBuilders.title(input.title),
  };

  if (input.status) {
    properties[props.status.name] = propertyBuilders.status(input.status);
  }
  if (input.projectId) {
    properties[props.project.name] = propertyBuilders.relation([
      input.projectId,
    ]);
  }
  if (input.dueDate) {
    properties[props.dueDate.name] = propertyBuilders.date(input.dueDate);
  }
  if (input.assigneeId) {
    properties[props.assignee.name] = propertyBuilders.people([
      input.assigneeId,
    ]);
  }
  if (input.priority) {
    properties[props.priority.name] = propertyBuilders.select(input.priority);
  }
  if (input.tags && input.tags.length > 0) {
    properties[props.tags.name] = propertyBuilders.multiSelect(input.tags);
  }
  if (input.taskType && input.taskType.length > 0) {
    properties[props.taskType.name] = propertyBuilders.multiSelect(
      input.taskType
    );
  }
  if (input.summary) {
    properties[props.summary.name] = propertyBuilders.richText(input.summary);
  }

  const page = await createPage("tasks", properties);

  return {
    pageId: page.id,
    url: page.url,
  };
}

export async function queryTasksByProject(
  projectId: string
): Promise<PageObjectResponse[]> {
  const props = notionConfig.tasks.properties;

  return queryDatabase("tasks", {
    filter: {
      property: props.project.name,
      relation: { contains: projectId },
    },
  });
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

/**
 * Create a new Idea in Notion
 */
export async function createIdea(
  input: CreateIdeaInput
): Promise<{ pageId: string; url: string }> {
  const props = notionConfig.ideas.properties;

  const properties: CreatePageParameters["properties"] = {
    [props.title.name]: propertyBuilders.title(input.title),
  };

  // Set default status to Backlog if not provided
  properties[props.status.name] = propertyBuilders.select(
    input.status || IdeaStatus.BACKLOG
  );

  if (input.summary) {
    properties[props.summary.name] = propertyBuilders.richText(input.summary);
  }
  if (input.aiSummary) {
    properties[props.aiSummary.name] = propertyBuilders.richText(
      input.aiSummary
    );
  }
  if (input.tags && input.tags.length > 0) {
    properties[props.tags.name] = propertyBuilders.multiSelect(input.tags);
  }
  if (input.status1) {
    properties[props.status1.name] = propertyBuilders.status(input.status1);
  }
  if (input.startTime) {
    properties[props.startTime.name] = propertyBuilders.date(input.startTime);
  }
  if (input.endTime) {
    properties[props.endTime.name] = propertyBuilders.date(input.endTime);
  }
  if (input.hidden) {
    properties[props.hidden.name] = propertyBuilders.multiSelect(["True"]);
  }

  const page = await createPage("ideas", properties);

  return {
    pageId: page.id,
    url: page.url,
  };
}

/**
 * Update an existing Idea in Notion
 */
export async function updateIdea(
  input: UpdateIdeaInput
): Promise<{ pageId: string; url: string }> {
  const props = notionConfig.ideas.properties;
  const properties: UpdatePageParameters["properties"] = {};

  if (input.title !== undefined) {
    properties[props.title.name] = propertyBuilders.title(input.title);
  }
  if (input.summary !== undefined) {
    properties[props.summary.name] = propertyBuilders.richText(input.summary);
  }
  if (input.aiSummary !== undefined) {
    properties[props.aiSummary.name] = propertyBuilders.richText(
      input.aiSummary
    );
  }
  if (input.tags !== undefined) {
    properties[props.tags.name] = propertyBuilders.multiSelect(input.tags);
  }
  if (input.status !== undefined) {
    properties[props.status.name] = propertyBuilders.select(input.status);
  }
  if (input.status1 !== undefined) {
    properties[props.status1.name] = propertyBuilders.status(input.status1);
  }
  if (input.startTime !== undefined) {
    properties[props.startTime.name] = propertyBuilders.date(input.startTime);
  }
  if (input.endTime !== undefined) {
    properties[props.endTime.name] = propertyBuilders.date(input.endTime);
  }
  if (input.hidden !== undefined) {
    properties[props.hidden.name] = input.hidden
      ? propertyBuilders.multiSelect(["True"])
      : propertyBuilders.multiSelect([]);
  }

  const page = await updatePage(input.pageId, properties);

  return {
    pageId: page.id,
    url: page.url,
  };
}

/**
 * Query Ideas from Notion with optional filters
 */
export async function queryIdeas(filter?: {
  status?: IdeaStatusValue;
  status1?: IdeaStatus1Value;
  tags?: IdeaTagValue[];
  hidden?: boolean;
}): Promise<PageObjectResponse[]> {
  const props = notionConfig.ideas.properties;
  const filters: Array<QueryDataSourceParameters["filter"]> = [];

  if (filter?.status) {
    filters.push({
      property: props.status.name,
      select: { equals: filter.status },
    });
  }

  if (filter?.status1) {
    filters.push({
      property: props.status1.name,
      status: { equals: filter.status1 },
    });
  }

  if (filter?.tags && filter.tags.length > 0) {
    // Add a filter for each tag (AND logic)
    for (const tag of filter.tags) {
      filters.push({
        property: props.tags.name,
        multi_select: { contains: tag },
      });
    }
  }

  if (filter?.hidden === false) {
    filters.push({
      property: props.hidden.name,
      multi_select: { is_empty: true },
    });
  }

  const queryFilter: QueryDataSourceParameters["filter"] | undefined =
    filters.length > 1
      ? ({ and: filters } as QueryDataSourceParameters["filter"])
      : filters.length === 1
      ? filters[0]
      : undefined;

  return queryDatabase("ideas", {
    filter: queryFilter,
    sorts: [{ timestamp: "created_time", direction: "descending" }],
  });
}

/**
 * Get a single Idea by ID and normalize the response
 */
export async function getIdea(pageId: string): Promise<IdeaResponse> {
  const page = await getPage(pageId);
  return normalizeIdeaResponse(page);
}

/**
 * Normalize a Notion page response to IdeaResponse
 */
export function normalizeIdeaResponse(page: PageObjectResponse): IdeaResponse {
  const props = notionConfig.ideas.properties;
  const pageProps = page.properties;

  return {
    pageId: page.id,
    url: page.url,
    title: extractPropertyValue(pageProps[props.title.name]) as string,
    summary: extractPropertyValue(pageProps[props.summary.name]) as
      | string
      | null,
    aiSummary: extractPropertyValue(pageProps[props.aiSummary.name]) as
      | string
      | null,
    tags: (extractPropertyValue(pageProps[props.tags.name]) as string[]) || [],
    status: extractPropertyValue(pageProps[props.status.name]) as string | null,
    status1: extractPropertyValue(pageProps[props.status1.name]) as
      | string
      | null,
    timerStatus: extractPropertyValue(pageProps[props.timerStatus.name]) as
      | string
      | null,
    startTime: extractPropertyValue(pageProps[props.startTime.name]) as
      | string
      | null,
    endTime: extractPropertyValue(pageProps[props.endTime.name]) as
      | string
      | null,
    createdTime: page.created_time,
    lastEditedTime: page.last_edited_time,
  };
}

/**
 * Get recent Ideas (convenience method)
 */
export async function getRecentIdeas(
  limit: number = 10
): Promise<IdeaResponse[]> {
  const pages = await queryIdeas({ hidden: false });
  return pages.slice(0, limit).map(normalizeIdeaResponse);
}

/**
 * Get Ideas by status (convenience method)
 */
export async function getIdeasByStatus(
  status: IdeaStatusValue
): Promise<IdeaResponse[]> {
  const pages = await queryIdeas({ status });
  return pages.map(normalizeIdeaResponse);
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

export async function createMeeting(
  input: CreateMeetingInput
): Promise<{ pageId: string; url: string }> {
  const props = notionConfig.meetings.properties;

  const properties: CreatePageParameters["properties"] = {
    [props.title.name]: propertyBuilders.title(input.title),
    [props.eventTime.name]: propertyBuilders.date(
      input.eventTime,
      input.eventTimeEnd
    ),
  };

  if (input.attendeeIds && input.attendeeIds.length > 0) {
    properties[props.attendees.name] = propertyBuilders.people(
      input.attendeeIds
    );
  }

  const page = await createPage("meetings", properties);

  return {
    pageId: page.id,
    url: page.url,
  };
}

/**
 * Query meetings for a specific date
 * @param date - Date in YYYY-MM-DD format
 */
export async function queryMeetingsByDate(
  date: string
): Promise<PageObjectResponse[]> {
  const props = notionConfig.meetings.properties;

  return queryDatabase("meetings", {
    filter: {
      property: props.eventTime.name,
      date: { equals: date },
    },
    sorts: [{ property: props.eventTime.name, direction: "ascending" }],
  });
}

/**
 * Query meetings within a date range
 * @param startDate - Start date in YYYY-MM-DD format
 * @param endDate - End date in YYYY-MM-DD format
 */
export async function queryMeetingsByDateRange(
  startDate: string,
  endDate: string
): Promise<PageObjectResponse[]> {
  const props = notionConfig.meetings.properties;

  return queryDatabase("meetings", {
    filter: {
      and: [
        {
          property: props.eventTime.name,
          date: { on_or_after: startDate },
        },
        {
          property: props.eventTime.name,
          date: { on_or_before: endDate },
        },
      ],
    },
    sorts: [{ property: props.eventTime.name, direction: "ascending" }],
  });
}

/**
 * Normalize a Notion page response to MeetingResponse
 */
export function normalizeMeetingResponse(
  page: PageObjectResponse
): MeetingResponse {
  const props = notionConfig.meetings.properties;
  const pageProps = page.properties;

  // Extract date range if available
  const dateProperty = pageProps[props.eventTime.name];
  let eventTime: string | null = null;
  let eventTimeEnd: string | null = null;

  if (dateProperty && dateProperty.type === "date" && dateProperty.date) {
    eventTime = dateProperty.date.start;
    eventTimeEnd = dateProperty.date.end || null;
  }

  return {
    pageId: page.id,
    url: page.url,
    title: extractPropertyValue(pageProps[props.title.name]) as string,
    eventTime,
    eventTimeEnd,
    attendeeIds:
      (extractPropertyValue(pageProps[props.attendees.name]) as string[]) || [],
    createdTime: page.created_time,
    lastEditedTime: page.last_edited_time,
  };
}

/**
 * Get meetings for today
 */
export async function getTodaysMeetings(): Promise<MeetingResponse[]> {
  const today = new Date().toISOString().split("T")[0];
  const pages = await queryMeetingsByDate(today);
  return pages.map(normalizeMeetingResponse);
}

/**
 * Get upcoming meetings for the next N days
 */
export async function getUpcomingMeetings(
  days: number = 7
): Promise<MeetingResponse[]> {
  const today = new Date();
  const endDate = new Date(today);
  endDate.setDate(endDate.getDate() + days);

  const pages = await queryMeetingsByDateRange(
    today.toISOString().split("T")[0],
    endDate.toISOString().split("T")[0]
  );
  return pages.map(normalizeMeetingResponse);
}
