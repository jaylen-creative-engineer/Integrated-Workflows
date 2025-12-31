import { Client } from "@notionhq/client";

/**
 * Notion API Client
 * Initialized with API key from environment variables
 */
export const notion = new Client({
  auth: process.env.NOTION_API_KEY,
});

