import type { PageObjectResponse } from "@notionhq/client/build/src/api-endpoints.js";
import {
  notionConfig,
  GameplanStatus,
  type GameplanStatusValue,
} from "../../config/notionConfig.js";
import { propertyBuilders } from "./propertyBuilders.js";
import { extractPropertyValue } from "./propertyExtractors.js";
import { createPage, queryDatabase } from "./crud.js";
import { notion } from "./client.js";
import type {
  CreateGameplanInput,
  GameplanResponse,
} from "./types.js";

/**
 * Gameplans Domain
 * Operations for Gameplans database
 */

/**
 * Create a new Gameplan in Notion
 */
export async function createGameplan(
  input: CreateGameplanInput
): Promise<{ pageId: string; url: string }> {
  const props = notionConfig.gameplans.properties;

  const properties: import("@notionhq/client/build/src/api-endpoints.js").CreatePageParameters["properties"] = {
    [props.title.name]: propertyBuilders.title(input.title),
  };

  // Set default status to Draft if not provided
  properties[props.status.name] = propertyBuilders.status(
    input.status || GameplanStatus.DRAFT
  );

  if (input.summary) {
    properties[props.summary.name] = propertyBuilders.richText(input.summary);
  }
  if (input.priority) {
    properties[props.priority.name] = propertyBuilders.select(input.priority);
  }
  if (input.category && input.category.length > 0) {
    properties[props.category.name] = propertyBuilders.multiSelect(
      input.category
    );
  }

  const page = await createPage("gameplans", properties, input.contentBlocks);

  return {
    pageId: page.id,
    url: page.url,
  };
}

/**
 * Normalize a Notion page response to GameplanResponse
 */
export function normalizeGameplanResponse(
  page: PageObjectResponse
): GameplanResponse {
  const props = notionConfig.gameplans.properties;
  const pageProps = page.properties;

  return {
    pageId: page.id,
    url: page.url,
    title: extractPropertyValue(pageProps[props.title.name]) as string,
    summary: extractPropertyValue(pageProps[props.summary.name]) as
      | string
      | null,
    status: extractPropertyValue(pageProps[props.status.name]) as string | null,
    priority: extractPropertyValue(pageProps[props.priority.name]) as
      | string
      | null,
    category:
      (extractPropertyValue(pageProps[props.category.name]) as string[]) || [],
    createdTime: page.created_time,
    lastEditedTime: page.last_edited_time,
  };
}

/**
 * Query gameplans by creation date
 * @param date - Date in YYYY-MM-DD format
 */
export async function queryGameplansByDate(
  date: string
): Promise<PageObjectResponse[]> {
  const props = notionConfig.gameplans.properties;

  // Query by created_time within the day
  const startOfDay = `${date}T00:00:00.000Z`;
  const endOfDay = `${date}T23:59:59.999Z`;

  return queryDatabase("gameplans", {
    filter: {
      and: [
        {
          timestamp: "created_time",
          created_time: { on_or_after: startOfDay },
        },
        {
          timestamp: "created_time",
          created_time: { on_or_before: endOfDay },
        },
      ],
    },
    sorts: [{ timestamp: "created_time", direction: "descending" }],
  });
}

/**
 * Get a gameplan for a specific date if it exists
 * @param date - Date in YYYY-MM-DD format
 */
export async function getGameplanForDate(
  date: string
): Promise<GameplanResponse | null> {
  const pages = await queryGameplansByDate(date);
  if (pages.length === 0) {
    return null;
  }
  return normalizeGameplanResponse(pages[0]);
}

/**
 * Get today's gameplan if it exists
 */
export async function getTodaysGameplan(): Promise<GameplanResponse | null> {
  const today = new Date().toISOString().split("T")[0];
  return getGameplanForDate(today);
}

/**
 * Append content blocks to an existing Gameplan page
 */
export async function appendGameplanContent(
  pageId: string,
  blocks: import("@notionhq/client/build/src/api-endpoints.js").CreatePageParameters["children"]
): Promise<void> {
  if (!blocks || blocks.length === 0) return;

  await notion.blocks.children.append({
    block_id: pageId,
    children: blocks as Parameters<
      typeof notion.blocks.children.append
    >[0]["children"],
  });
}

