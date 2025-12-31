import type { QueryDataSourceParameters, PageObjectResponse } from "@notionhq/client/build/src/api-endpoints.js";
import {
  notionConfig,
  IdeaStatus,
  type IdeaStatusValue,
  type IdeaStatus1Value,
  type IdeaTagValue,
} from "../../config/notionConfig.js";
import { propertyBuilders } from "./propertyBuilders.js";
import { extractPropertyValue } from "./propertyExtractors.js";
import { createPage, updatePage, getPage, queryDatabase } from "./crud.js";
import type {
  CreateIdeaInput,
  UpdateIdeaInput,
  IdeaResponse,
} from "./types.js";

/**
 * Ideas Domain
 * Operations for Ideas database
 */

/**
 * Create a new Idea in Notion
 */
export async function createIdea(
  input: CreateIdeaInput
): Promise<{ pageId: string; url: string }> {
  const props = notionConfig.ideas.properties;

  const properties: import("@notionhq/client/build/src/api-endpoints.js").CreatePageParameters["properties"] = {
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
  const properties: import("@notionhq/client/build/src/api-endpoints.js").UpdatePageParameters["properties"] = {};

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

