import type { QueryDataSourceParameters, PageObjectResponse } from "@notionhq/client/build/src/api-endpoints.js";
import {
  notionConfig,
  ContentStatus,
  type ContentStatusValue,
  type ContentPlatformValue,
  type ContentTypeValue,
  type ContentGoalValue,
} from "../../config/notionConfig.js";
import { propertyBuilders } from "./propertyBuilders.js";
import { extractPropertyValue } from "./propertyExtractors.js";
import { createPage, updatePage, queryDatabase } from "./crud.js";
import type {
  CreateContentInput,
  UpdateContentInput,
  ContentResponse,
} from "./types.js";

/**
 * Content Domain
 * Operations for Content database
 */

/**
 * Create a new Content entry in Notion
 */
export async function createContent(
  input: CreateContentInput
): Promise<{ pageId: string; url: string }> {
  const props = notionConfig.content.properties;

  const properties: import("@notionhq/client/build/src/api-endpoints.js").CreatePageParameters["properties"] = {
    [props.title.name]: propertyBuilders.title(input.title),
  };

  // Set default status to Post Idea if not provided
  properties[props.status.name] = propertyBuilders.status(
    input.status || ContentStatus.POST_IDEA
  );

  if (input.contentGoal) {
    properties[props.contentGoal.name] = propertyBuilders.select(
      input.contentGoal
    );
  }
  if (input.platform && input.platform.length > 0) {
    properties[props.platform.name] = propertyBuilders.multiSelect(
      input.platform
    );
  }
  if (input.contentType && input.contentType.length > 0) {
    properties[props.contentType.name] = propertyBuilders.multiSelect(
      input.contentType
    );
  }
  if (input.targetAudience) {
    properties[props.targetAudience.name] = propertyBuilders.select(
      input.targetAudience
    );
  }
  if (input.targetAudiences && input.targetAudiences.length > 0) {
    properties[props.targetAudiences.name] = propertyBuilders.multiSelect(
      input.targetAudiences
    );
  }
  if (input.postDate) {
    properties[props.postDate.name] = propertyBuilders.date(input.postDate);
  }
  if (input.strategicIntent) {
    properties[props.strategicIntent.name] = propertyBuilders.richText(
      input.strategicIntent
    );
  }
  if (input.editorInstructions) {
    properties[props.editorInstructions.name] = propertyBuilders.richText(
      input.editorInstructions
    );
  }
  if (input.successMetrics) {
    properties[props.successMetrics.name] = propertyBuilders.richText(
      input.successMetrics
    );
  }
  if (input.editingWorkflow) {
    properties[props.editingWorkflow.name] = propertyBuilders.select(
      input.editingWorkflow
    );
  }
  if (input.postUrl) {
    properties[props.postUrl.name] = propertyBuilders.url(input.postUrl);
  }
  if (input.owner && input.owner.length > 0) {
    properties[props.owner.name] = propertyBuilders.people(input.owner);
  }

  const page = await createPage("content", properties, input.contentBlocks);

  return {
    pageId: page.id,
    url: page.url,
  };
}

/**
 * Update an existing Content entry in Notion
 */
export async function updateContent(
  input: UpdateContentInput
): Promise<{ pageId: string; url: string }> {
  const props = notionConfig.content.properties;
  const properties: import("@notionhq/client/build/src/api-endpoints.js").UpdatePageParameters["properties"] = {};

  if (input.title !== undefined) {
    properties[props.title.name] = propertyBuilders.title(input.title);
  }
  if (input.status !== undefined) {
    properties[props.status.name] = propertyBuilders.status(input.status);
  }
  if (input.contentGoal !== undefined) {
    properties[props.contentGoal.name] = propertyBuilders.select(
      input.contentGoal
    );
  }
  if (input.platform !== undefined) {
    properties[props.platform.name] = propertyBuilders.multiSelect(
      input.platform
    );
  }
  if (input.contentType !== undefined) {
    properties[props.contentType.name] = propertyBuilders.multiSelect(
      input.contentType
    );
  }
  if (input.targetAudience !== undefined) {
    properties[props.targetAudience.name] = propertyBuilders.select(
      input.targetAudience
    );
  }
  if (input.targetAudiences !== undefined) {
    properties[props.targetAudiences.name] = propertyBuilders.multiSelect(
      input.targetAudiences
    );
  }
  if (input.postDate !== undefined) {
    properties[props.postDate.name] = input.postDate
      ? propertyBuilders.date(input.postDate)
      : { date: null };
  }
  if (input.strategicIntent !== undefined) {
    properties[props.strategicIntent.name] = propertyBuilders.richText(
      input.strategicIntent
    );
  }
  if (input.editorInstructions !== undefined) {
    properties[props.editorInstructions.name] = propertyBuilders.richText(
      input.editorInstructions
    );
  }
  if (input.successMetrics !== undefined) {
    properties[props.successMetrics.name] = propertyBuilders.richText(
      input.successMetrics
    );
  }
  if (input.editingWorkflow !== undefined) {
    properties[props.editingWorkflow.name] = propertyBuilders.select(
      input.editingWorkflow
    );
  }
  if (input.postUrl !== undefined) {
    properties[props.postUrl.name] = input.postUrl
      ? propertyBuilders.url(input.postUrl)
      : { url: null };
  }
  if (input.owner !== undefined) {
    properties[props.owner.name] = propertyBuilders.people(input.owner);
  }

  const page = await updatePage(input.pageId, properties);

  return {
    pageId: page.id,
    url: page.url,
  };
}

/**
 * Query Content entries from Notion with optional filters
 */
export async function queryContent(filter?: {
  status?: ContentStatusValue;
  platform?: ContentPlatformValue;
  contentType?: ContentTypeValue;
  contentGoal?: ContentGoalValue;
}): Promise<PageObjectResponse[]> {
  const props = notionConfig.content.properties;
  const filters: Array<QueryDataSourceParameters["filter"]> = [];

  if (filter?.status) {
    filters.push({
      property: props.status.name,
      status: { equals: filter.status },
    });
  }

  if (filter?.platform) {
    filters.push({
      property: props.platform.name,
      multi_select: { contains: filter.platform },
    });
  }

  if (filter?.contentType) {
    filters.push({
      property: props.contentType.name,
      multi_select: { contains: filter.contentType },
    });
  }

  if (filter?.contentGoal) {
    filters.push({
      property: props.contentGoal.name,
      select: { equals: filter.contentGoal },
    });
  }

  const queryFilter: QueryDataSourceParameters["filter"] | undefined =
    filters.length > 1
      ? ({ and: filters } as QueryDataSourceParameters["filter"])
      : filters.length === 1
      ? filters[0]
      : undefined;

  return queryDatabase("content", {
    filter: queryFilter,
    sorts: [{ timestamp: "created_time", direction: "descending" }],
  });
}

/**
 * Normalize a Notion page response to ContentResponse
 */
export function normalizeContentResponse(
  page: PageObjectResponse
): ContentResponse {
  const props = notionConfig.content.properties;
  const pageProps = page.properties;

  return {
    pageId: page.id,
    url: page.url,
    title: extractPropertyValue(pageProps[props.title.name]) as string,
    status: extractPropertyValue(pageProps[props.status.name]) as string | null,
    contentGoal: extractPropertyValue(pageProps[props.contentGoal.name]) as
      | string
      | null,
    platform:
      (extractPropertyValue(pageProps[props.platform.name]) as string[]) || [],
    contentType:
      (extractPropertyValue(pageProps[props.contentType.name]) as string[]) ||
      [],
    targetAudience: extractPropertyValue(
      pageProps[props.targetAudience.name]
    ) as string | null,
    targetAudiences:
      (extractPropertyValue(
        pageProps[props.targetAudiences.name]
      ) as string[]) || [],
    postDate: extractPropertyValue(pageProps[props.postDate.name]) as
      | string
      | null,
    strategicIntent: extractPropertyValue(
      pageProps[props.strategicIntent.name]
    ) as string | null,
    editorInstructions: extractPropertyValue(
      pageProps[props.editorInstructions.name]
    ) as string | null,
    successMetrics: extractPropertyValue(
      pageProps[props.successMetrics.name]
    ) as string | null,
    editingWorkflow: extractPropertyValue(
      pageProps[props.editingWorkflow.name]
    ) as string | null,
    postUrl: extractPropertyValue(pageProps[props.postUrl.name]) as
      | string
      | null,
    createdTime: page.created_time,
    lastEditedTime: page.last_edited_time,
  };
}

