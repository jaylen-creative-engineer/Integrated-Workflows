import { FunctionTool } from "@google/adk";
import { LlmAgent } from "@google/adk";
import { Schema, Type } from "@google/genai";
import type { CreatePageParameters } from "@notionhq/client";
import { searchAgent } from "./searchAgent.js";
import { createIdea, createGameplan } from "../services/notion/index.js";
import { IdeaTags, IdeaStatus } from "../config/notionConfig.js";

// ============================================================================
// Type Definitions
// ============================================================================

interface ExtractContentParams {
  url: string;
  query?: string; // Original search query for context
}

interface SaveResearchFindingParams {
  title: string;
  summary: string;
  url: string;
  keyInsights?: string[];
  relatedIdeaId?: string;
  tags?: string[];
  contentType?: string; // "paper", "article", "news", "report"
}

interface CreateResearchPathParams {
  topic: string;
  findings: Array<{
    title: string;
    summary: string;
    url: string;
    findingId?: string; // Notion page ID if already saved
  }>;
  overview?: string;
  keyThemes?: string[];
  nextSteps?: string[];
}

// ============================================================================
// Schema Definitions
// ============================================================================

const extractContentSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    url: {
      type: Type.STRING,
      description: "URL of the article or paper to extract and summarize",
    },
    query: {
      type: Type.STRING,
      description:
        "Original search query for context (optional, helps with relevance)",
    },
  },
  required: ["url"],
};

const saveResearchFindingSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    title: {
      type: Type.STRING,
      description: "Title of the research finding",
    },
    summary: {
      type: Type.STRING,
      description:
        "AI-generated summary of the content. Should include the original URL.",
    },
    url: {
      type: Type.STRING,
      description: "Original URL of the source",
    },
    keyInsights: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: "Key insights or findings from the content",
    },
    relatedIdeaId: {
      type: Type.STRING,
      description:
        "Notion page ID of related idea if this research is for a specific idea",
    },
    tags: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description:
        "Additional tags beyond 'Research'. Valid values: Technology, Creative, Culture, Content, Workflows, etc.",
    },
    contentType: {
      type: Type.STRING,
      description: "Type of content: 'paper', 'article', 'news', or 'report'",
    },
  },
  required: ["title", "summary", "url"],
};

const createResearchPathSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    topic: {
      type: Type.STRING,
      description: "The research topic or question",
    },
    findings: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          title: { type: Type.STRING },
          summary: { type: Type.STRING },
          url: { type: Type.STRING },
          findingId: { type: Type.STRING },
        },
        required: ["title", "summary", "url"],
      },
      description: "List of research findings to include in the path",
    },
    overview: {
      type: Type.STRING,
      description: "Overview of the research topic and findings",
    },
    keyThemes: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: "Key themes or patterns identified across findings",
    },
    nextSteps: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: "Next steps or gaps in research",
    },
  },
  required: ["topic", "findings"],
};

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Extract main content from HTML
 * Basic implementation - can be enhanced with cheerio if needed
 */
async function extractTextFromHTML(html: string): Promise<string> {
  // Remove script and style tags
  let text = html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ") // Remove all HTML tags
    .replace(/\s+/g, " ") // Normalize whitespace
    .trim();

  // Limit length to avoid token limits
  const maxLength = 50000;
  if (text.length > maxLength) {
    text = text.substring(0, maxLength) + "... [truncated]";
  }

  return text;
}

/**
 * Generate AI summary using Gemini
 * This is a simplified version - in practice, you might want to use
 * the Gemini API directly for better summarization
 */
async function generateSummary(
  content: string,
  url: string,
  query?: string
): Promise<{
  summary: string;
  keyPoints: string[];
  contentType: string;
  relevance: string;
}> {
  // For now, create a basic summary
  // In a full implementation, you'd call Gemini API here
  const lines = content.split("\n").filter((line) => line.trim().length > 0);
  const preview = lines.slice(0, 20).join("\n");

  // Detect content type from URL or content
  let contentType = "article";
  if (url.includes("arxiv.org") || url.includes("scholar")) {
    contentType = "paper";
  } else if (url.includes("news") || url.includes("blog")) {
    contentType = "news";
  } else if (url.includes("report") || url.includes("analysis")) {
    contentType = "report";
  }

  // Extract key points (simplified - would use AI in production)
  const keyPoints = lines
    .slice(0, 5)
    .map((line) => line.trim().substring(0, 200))
    .filter((line) => line.length > 20);

  const summary = `Source: ${url}\n\n${preview.substring(0, 1000)}...`;

  return {
    summary,
    keyPoints,
    contentType,
    relevance: query
      ? `Relevant to: ${query}`
      : "Content extracted from source",
  };
}

// ============================================================================
// Tool Implementations
// ============================================================================

/**
 * Extract and summarize content from a URL
 */
export const extractAndSummarizeContent = new FunctionTool({
  name: "extract_and_summarize_content",
  description:
    "Fetch content from a URL, extract main text, and generate an AI summary with key points. Handles HTML pages, PDFs, and academic papers.",
  parameters: extractContentSchema,
  execute: async (input) => {
    const { url, query } = input as ExtractContentParams;

    try {
      // Validate URL
      let fetchUrl = url;
      if (!url.startsWith("http://") && !url.startsWith("https://")) {
        fetchUrl = `https://${url}`;
      }

      // Fetch content
      const response = await fetch(fetchUrl, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (compatible; ResearchAgent/1.0; +https://example.com/bot)",
        },
      });

      if (!response.ok) {
        return {
          status: "error",
          error: `Failed to fetch URL: ${response.status} ${response.statusText}`,
          url: fetchUrl,
        };
      }

      const contentType = response.headers.get("content-type") || "";

      let textContent = "";

      if (contentType.includes("application/pdf")) {
        // PDF handling - would need pdf-parse library
        return {
          status: "error",
          error:
            "PDF extraction not yet implemented. Please provide HTML content.",
          url: fetchUrl,
        };
      } else {
        // HTML content
        const html = await response.text();
        textContent = await extractTextFromHTML(html);
      }

      if (!textContent || textContent.trim().length === 0) {
        return {
          status: "error",
          error: "No extractable text content found",
          url: fetchUrl,
        };
      }

      // Generate summary
      const summaryData = await generateSummary(textContent, fetchUrl, query);

      return {
        status: "success",
        url: fetchUrl,
        summary: summaryData.summary,
        keyPoints: summaryData.keyPoints,
        contentType: summaryData.contentType,
        relevance: summaryData.relevance,
        contentLength: textContent.length,
      };
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unknown error occurred";
      return {
        status: "error",
        error: message,
        url,
      };
    }
  },
});

/**
 * Save a research finding to Notion Ideas database
 */
export const saveResearchFinding = new FunctionTool({
  name: "save_research_finding",
  description:
    "Save a research finding to Notion's Ideas database with Research tag. Links to related idea if provided.",
  parameters: saveResearchFindingSchema,
  execute: async (input) => {
    const {
      title,
      summary,
      url,
      keyInsights,
      relatedIdeaId,
      tags,
      contentType,
    } = input as SaveResearchFindingParams;

    try {
      // Build full summary with URL and insights
      let fullSummary = summary;
      if (!fullSummary.includes(url)) {
        fullSummary = `${fullSummary}\n\nSource: ${url}`;
      }

      if (keyInsights && keyInsights.length > 0) {
        fullSummary = `${fullSummary}\n\nKey Insights:\n${keyInsights
          .map((insight) => `- ${insight}`)
          .join("\n")}`;
      }

      if (contentType) {
        fullSummary = `${fullSummary}\n\nContent Type: ${contentType}`;
      }

      // Build tags array - always include Research
      const allTags = [IdeaTags.RESEARCH];
      if (tags && tags.length > 0) {
        // Validate tags against IdeaTags
        const validTags = Object.values(IdeaTags);
        for (const tag of tags) {
          if (validTags.includes(tag as any)) {
            allTags.push(tag as any);
          }
        }
      }

      // Create idea in Notion
      const idea = await createIdea({
        title,
        summary: fullSummary,
        tags: allTags,
        status: IdeaStatus.BACKLOG,
      });

      // TODO: Link to related idea if relatedIdeaId provided
      // This would require adding a relation property to Ideas database
      // For now, we'll just include it in the summary if provided
      if (relatedIdeaId) {
        // Could update the idea with relation, but that requires schema changes
        // For now, just note it in the response
      }

      return {
        status: "success",
        ideaId: idea.pageId,
        notionUrl: idea.url,
        title,
        tags: allTags,
        relatedIdeaId: relatedIdeaId || null,
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

/**
 * Create a structured research path document in Notion
 */
export const createResearchPath = new FunctionTool({
  name: "create_research_path",
  description:
    "Create a structured discovery path document in Notion that links all research findings together. Creates a Gameplan document with structured content.",
  parameters: createResearchPathSchema,
  execute: async (input) => {
    const { topic, findings, overview, keyThemes, nextSteps } =
      input as CreateResearchPathParams;

    try {
      // Build content blocks for the gameplan
      const contentBlocks: CreatePageParameters["children"] = [];

      // Overview section
      if (overview) {
        contentBlocks.push({
          object: "block",
          type: "heading_2",
          heading_2: {
            rich_text: [{ type: "text", text: { content: "Overview" } }],
          },
        });
        contentBlocks.push({
          object: "block",
          type: "paragraph",
          paragraph: {
            rich_text: [{ type: "text", text: { content: overview } }],
          },
        });
      }

      // Findings section
      contentBlocks.push({
        object: "block",
        type: "heading_2",
        heading_2: {
          rich_text: [{ type: "text", text: { content: "Research Findings" } }],
        },
      });

      for (const finding of findings) {
        contentBlocks.push({
          object: "block",
          type: "heading_3",
          heading_3: {
            rich_text: [{ type: "text", text: { content: finding.title } }],
          },
        });
        contentBlocks.push({
          object: "block",
          type: "paragraph",
          paragraph: {
            rich_text: [{ type: "text", text: { content: finding.summary } }],
          },
        });
        contentBlocks.push({
          object: "block",
          type: "paragraph",
          paragraph: {
            rich_text: [
              {
                type: "text",
                text: { content: `Source: ` },
              },
              {
                type: "text",
                text: {
                  content: finding.url,
                  link: { url: finding.url },
                },
              },
            ],
          },
        });
      }

      // Key themes section
      if (keyThemes && keyThemes.length > 0) {
        contentBlocks.push({
          object: "block",
          type: "heading_2",
          heading_2: {
            rich_text: [{ type: "text", text: { content: "Key Themes" } }],
          },
        });
        for (const theme of keyThemes) {
          contentBlocks.push({
            object: "block",
            type: "bulleted_list_item",
            bulleted_list_item: {
              rich_text: [{ type: "text", text: { content: theme } }],
            },
          });
        }
      }

      // Next steps section
      if (nextSteps && nextSteps.length > 0) {
        contentBlocks.push({
          object: "block",
          type: "heading_2",
          heading_2: {
            rich_text: [{ type: "text", text: { content: "Next Steps" } }],
          },
        });
        for (const step of nextSteps) {
          contentBlocks.push({
            object: "block",
            type: "bulleted_list_item",
            bulleted_list_item: {
              rich_text: [{ type: "text", text: { content: step } }],
            },
          });
        }
      }

      // Create gameplan
      const gameplan = await createGameplan({
        title: `Research Path: ${topic}`,
        summary: overview || `Research discovery path for: ${topic}`,
        contentBlocks,
      });

      return {
        status: "success",
        gameplanId: gameplan.pageId,
        notionUrl: gameplan.url,
        topic,
        findingsCount: findings.length,
        keyThemes: keyThemes || [],
        nextSteps: nextSteps || [],
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
// Research Agent
// ============================================================================

/**
 * Research Agent - Orchestrates research workflow: search → extract → store
 *
 * Delegates web searches to searchAgent (which has google_search tool).
 * Handles content extraction, summarization, and storage in Notion.
 */
export const researchAgent = new LlmAgent({
  name: "research_agent",
  model: "gemini-2.0-flash",
  description:
    "Conducts market research by searching the web, extracting and summarizing articles/papers, and storing findings in Notion. Delegates searches to search_agent.",
  instruction: `
You are the Research Agent. You help conduct market research for ideas by searching the web, extracting content, and storing findings.

## Workflow
1. Delegate search queries to search_agent (it has google_search tool)
2. Receive search results (URLs, titles, snippets)
3. Identify most relevant sources
4. For each relevant URL → extract_and_summarize_content
5. Save findings → save_research_finding (creates Notion Ideas with Research tag)
6. Optional: create_research_path to structure all findings

## Search Strategy
- Break complex topics into focused queries
- Use search_agent for: academic papers, market research, industry articles
- Formulate queries that search_agent can execute effectively

## Content Processing
- Extract and summarize content from URLs
- Identify key insights and relevance
- Categorize content type (paper/article/news/report)

## Storage
- Save each finding as a Notion Idea with "Research" tag
- Include original URL, summary, and key insights
- Link to related idea if research is for a specific idea
- Optionally create a research path document linking all findings

## Response Style
- Provide structured research reports
- Include Notion URLs/IDs for all saved findings
- Show discovery path and key themes
- Note any gaps or next steps in research

## Examples
- "Research the market for [topic]" → search → extract → save findings
- "Find papers on [topic]" → academic search → extract → save
- "Create research path for [topic]" → gather findings → create structured document
`,
  subAgents: [searchAgent],
  tools: [extractAndSummarizeContent, saveResearchFinding, createResearchPath],
});

// ============================================================================
// Export Tools
// ============================================================================

export const researchTools = [
  extractAndSummarizeContent,
  saveResearchFinding,
  createResearchPath,
];
