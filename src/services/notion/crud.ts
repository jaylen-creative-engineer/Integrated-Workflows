import type {
  CreatePageParameters,
  UpdatePageParameters,
  QueryDataSourceParameters,
  PageObjectResponse,
  PartialPageObjectResponse,
  DatabaseObjectResponse,
} from "@notionhq/client/build/src/api-endpoints.js";
import { notion } from "./client.js";
import { getDatabaseId, type NotionConfig } from "../../config/notionConfig.js";

/**
 * Generic CRUD Operations
 * Core functions for interacting with Notion databases
 */

// Type guard for full page responses
function isFullPage(
  page: PageObjectResponse | PartialPageObjectResponse
): page is PageObjectResponse {
  return "properties" in page;
}

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

