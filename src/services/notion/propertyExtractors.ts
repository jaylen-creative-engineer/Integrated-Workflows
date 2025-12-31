import { notion } from "./client.js";
import type { PageObjectResponse } from "@notionhq/client/build/src/api-endpoints.js";

/**
 * Property Extractors
 * Helpers to extract values from Notion properties and blocks
 */

/**
 * Extract a value from a Notion property based on its type
 */
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

/**
 * Retrieve all blocks from a Notion page and convert to plain text
 * Recursively handles nested blocks (toggle lists, callouts, etc.)
 */
export async function getPageBlocksAsText(pageId: string): Promise<string> {
  const blocks: string[] = [];
  let cursor: string | undefined = undefined;

  // Recursively retrieve all blocks (handles pagination)
  do {
    const response = await notion.blocks.children.list({
      block_id: pageId,
      start_cursor: cursor,
      page_size: 100,
    });

    for (const block of response.results) {
      const text = extractBlockText(block);
      if (text) {
        blocks.push(text);
      }

      // Recursively handle nested blocks (e.g., toggle lists, callouts)
      if ("has_children" in block && block.has_children) {
        const nestedText = await getNestedBlocksAsText(block.id);
        if (nestedText) {
          blocks.push(nestedText);
        }
      }
    }

    cursor = response.next_cursor || undefined;
  } while (cursor);

  return blocks.join("\n\n");
}

/**
 * Recursively retrieve nested blocks as text
 */
async function getNestedBlocksAsText(blockId: string): Promise<string> {
  const blocks: string[] = [];
  let cursor: string | undefined = undefined;

  do {
    const response = await notion.blocks.children.list({
      block_id: blockId,
      start_cursor: cursor,
      page_size: 100,
    });

    for (const block of response.results) {
      const text = extractBlockText(block);
      if (text) {
        blocks.push(text);
      }

      // Recursively handle deeper nesting
      if ("has_children" in block && block.has_children) {
        const nestedText = await getNestedBlocksAsText(block.id);
        if (nestedText) {
          blocks.push(nestedText);
        }
      }
    }

    cursor = response.next_cursor || undefined;
  } while (cursor);

  return blocks.join("\n");
}

/**
 * Extract plain text from a Notion block
 */
function extractBlockText(block: any): string | null {
  if (!block) return null;

  const blockType = block.type;
  const blockContent = block[blockType];

  if (!blockContent) return null;

  // Extract rich text from various block types
  let richText: any[] = [];

  if (blockContent.rich_text) {
    richText = blockContent.rich_text;
  } else if (blockContent.caption) {
    richText = blockContent.caption;
  } else if (blockContent.title) {
    richText = blockContent.title;
  }

  // Convert rich text array to plain text
  const text = richText
    .map((rt: any) => rt.plain_text || "")
    .join("")
    .trim();

  if (!text) return null;

  // Add formatting based on block type
  switch (blockType) {
    case "heading_1":
      return `# ${text}`;
    case "heading_2":
      return `## ${text}`;
    case "heading_3":
      return `### ${text}`;
    case "bulleted_list_item":
      return `• ${text}`;
    case "numbered_list_item":
      return `1. ${text}`;
    case "to_do":
      const checked = blockContent.checked ? "✓" : "☐";
      return `${checked} ${text}`;
    case "toggle":
      return `▶ ${text}`;
    case "quote":
      return `> ${text}`;
    case "callout":
      const emoji = blockContent.icon?.emoji || "💡";
      return `${emoji} ${text}`;
    case "code":
      return `\`\`\`\n${text}\n\`\`\``;
    case "divider":
      return "---";
    default:
      return text;
  }
}

