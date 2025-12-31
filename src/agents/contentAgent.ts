import { FunctionTool } from "@google/adk";
import { LlmAgent } from "@google/adk";
import { Schema, Type } from "@google/genai";
import {
  getPageBlocksAsText,
  createContent,
  queryContent,
  type CreateContentInput,
} from "../services/notion/index.js";
import type { CreatePageParameters } from "@notionhq/client/build/src/api-endpoints.js";
import {
  ContentStatus,
  ContentPlatform,
  ContentType,
  ContentGoal,
  ContentTargetAudience,
  ContentEditingWorkflow,
  type ContentStatusValue,
  type ContentGoalValue,
  type ContentPlatformValue,
  type ContentTypeValue,
  type ContentTargetAudienceValue,
  type ContentEditingWorkflowValue,
} from "../config/notionConfig.js";
import { visionTools } from "./visionAgent.js";

// ============================================================================
// Constants
// ============================================================================

/**
 * Notion page ID for the 2026 strategy document
 * This is a read-only reference artifact for content alignment
 */
const STRATEGY_2026_PAGE_ID = "29e82787-0ecb-801c-a110-c6a50af733f4";

// ============================================================================
// Tool: Get 2026 Strategy
// ============================================================================

export const get2026StrategyTool = new FunctionTool({
  name: "get_2026_strategy",
  description:
    "Retrieve the 2026 strategy document from Notion for content alignment and planning. Use this when creating content outlines to ensure alignment with strategic goals.",
  parameters: {
    type: Type.OBJECT,
    properties: {},
    required: [],
  },
  execute: async () => {
    try {
      const strategyContent = await getPageBlocksAsText(STRATEGY_2026_PAGE_ID);

      if (!strategyContent || strategyContent.trim().length === 0) {
        return {
          status: "not_found",
          message:
            "2026 strategy document exists but contains no readable content.",
        };
      }

      return {
        status: "success",
        strategyContent,
        pageId: STRATEGY_2026_PAGE_ID,
        note: "This is a read-only reference. Use this strategy to guide content creation, ensure alignment with goals, and maintain strategic focus.",
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
// Tool: Create Content Outline
// ============================================================================

interface CreateContentOutlineParams {
  contentType: string;
  topic: string;
  platform?: string[];
  targetAudience?: string;
  keyPoints?: string[];
  contentGoal?: string;
  strategicIntent?: string;
}

const createContentOutlineSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    contentType: {
      type: Type.STRING,
      description:
        "Type of content: newsletter, blog, youtube_script, whitepaper, linkedin, instagram, threads, twitter, or other",
    },
    topic: {
      type: Type.STRING,
      description: "Main topic or theme for the content",
    },
    platform: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description:
        "Target platforms: Linkedin, Instagram, X, TikTok, YouTube, etc.",
    },
    targetAudience: {
      type: Type.STRING,
      description: "Target audience level: Beginner, Intermediate, Advanced, Mixed",
    },
    keyPoints: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: "Key points or messages to include in the content",
    },
    contentGoal: {
      type: Type.STRING,
      description: "Content goal: Awareness, Education, Conversion, Engagement",
    },
    strategicIntent: {
      type: Type.STRING,
      description: "Strategic intent or purpose for this content",
    },
  },
  required: ["contentType", "topic"],
};

export const createContentOutlineTool = new FunctionTool({
  name: "create_content_outline",
  description:
    "Generate a structured outline for content (newsletter, blog, YouTube script, whitepaper, social posts). Returns outline structure with sections, key points, and recommendations—NOT full content. Use this to help plan content before writing.",
  parameters: createContentOutlineSchema,
  execute: async (input) => {
    const {
      contentType,
      topic,
      platform,
      targetAudience,
      keyPoints,
      contentGoal,
      strategicIntent,
    } = input as CreateContentOutlineParams;

    // This tool returns guidance for the agent to generate the outline
    // The actual outline generation happens in the agent's instruction
    return {
      status: "success",
      contentType,
      topic,
      platform: platform || [],
      targetAudience: targetAudience || "Mixed",
      keyPoints: keyPoints || [],
      contentGoal: contentGoal || "Engagement",
      strategicIntent: strategicIntent || "",
      note: "Use this information to generate a structured outline with sections, key points, and recommendations. Do not generate full content.",
    };
  },
});

// ============================================================================
// Tool: Optimize Content for Platform
// ============================================================================

interface OptimizeForPlatformParams {
  platform: string;
  draftContent: string;
  contentType?: string;
}

const optimizeForPlatformSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    platform: {
      type: Type.STRING,
      description:
        "Target platform: Linkedin, Instagram, X (Twitter), Threads, TikTok, YouTube",
    },
    draftContent: {
      type: Type.STRING,
      description: "Draft content to optimize",
    },
    contentType: {
      type: Type.STRING,
      description: "Type of content: Text, Video, Image, Carousel, etc.",
    },
  },
  required: ["platform", "draftContent"],
};

export const optimizeForPlatformTool = new FunctionTool({
  name: "optimize_content_for_platform",
  description:
    "Provide platform-specific optimization suggestions for social media content. Returns recommendations for character limits, formatting, hashtags, engagement tactics, and best practices—NOT rewritten content.",
  parameters: optimizeForPlatformSchema,
  execute: async (input) => {
    const { platform, draftContent, contentType } =
      input as OptimizeForPlatformParams;

    // Platform-specific guidance
    const platformGuidance: Record<string, any> = {
      linkedin: {
        characterLimit: 3000,
        optimalLength: "1300-2000 characters",
        hashtags: "3-5 relevant hashtags",
        engagement: "Ask questions, use polls, tag relevant people",
        formatting: "Use line breaks, bullet points, emojis sparingly",
      },
      instagram: {
        characterLimit: 2200,
        optimalLength: "125-150 characters for captions",
        hashtags: "5-10 hashtags (mix of popular and niche)",
        engagement: "First line is crucial (hook), use call-to-action",
        formatting: "Emojis work well, use line breaks for readability",
      },
      x: {
        characterLimit: 280,
        optimalLength: "240-260 characters (leaves room for engagement)",
        hashtags: "1-2 hashtags max",
        engagement: "Thread for longer content, use polls, quote tweets",
        formatting: "Concise, punchy, use line breaks for threads",
      },
      threads: {
        characterLimit: 500,
        optimalLength: "200-400 characters",
        hashtags: "2-3 hashtags",
        engagement: "Conversational tone, reply to threads",
        formatting: "Similar to Twitter but slightly longer",
      },
      tiktok: {
        characterLimit: 2200,
        optimalLength: "100-150 characters for captions",
        hashtags: "3-5 trending hashtags",
        engagement: "Hook in first 3 seconds, use trending sounds",
        formatting: "Short, punchy, use emojis",
      },
      youtube: {
        characterLimit: 5000,
        optimalLength: "200-300 characters for descriptions",
        hashtags: "3-5 hashtags in description",
        engagement: "Ask to subscribe, use timestamps, pin comments",
        formatting: "Use line breaks, timestamps, links",
      },
    };

    const guidance =
      platformGuidance[platform.toLowerCase()] ||
      platformGuidance["linkedin"];

    return {
      status: "success",
      platform: platform.toLowerCase(),
      contentType: contentType || "Text",
      draftLength: draftContent.length,
      recommendations: {
        characterLimit: guidance.characterLimit,
        optimalLength: guidance.optimalLength,
        hashtags: guidance.hashtags,
        engagement: guidance.engagement,
        formatting: guidance.formatting,
      },
      note: "Provide specific optimization suggestions based on these guidelines. Do not rewrite the content.",
    };
  },
});

// ============================================================================
// Tool: Enhance Content Draft
// ============================================================================

interface EnhanceContentParams {
  draftContent: string;
  enhancementLevel: string;
  focusAreas?: string[];
  contentType?: string;
}

const enhanceContentSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    draftContent: {
      type: Type.STRING,
      description: "Draft content to enhance",
    },
    enhancementLevel: {
      type: Type.STRING,
      description: "Enhancement depth: light, medium, deep",
    },
    focusAreas: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description:
        "Specific areas to focus on: clarity, engagement, structure, tone, hooks, flow, etc.",
    },
    contentType: {
      type: Type.STRING,
      description: "Type of content being enhanced",
    },
  },
  required: ["draftContent", "enhancementLevel"],
};

export const enhanceContentTool = new FunctionTool({
  name: "enhance_content_draft",
  description:
    "Provide enhancement suggestions for content drafts with configurable depth levels. Returns suggestions and recommendations—NOT rewritten content. Light: grammar/style fixes. Medium: structure + engagement improvements. Deep: comprehensive rewrite suggestions.",
  parameters: enhanceContentSchema,
  execute: async (input) => {
    const { draftContent, enhancementLevel, focusAreas, contentType } =
      input as EnhanceContentParams;

    const levelGuidance: Record<string, any> = {
      light: {
        focus: "Grammar, spelling, punctuation, basic style",
        depth: "Surface-level improvements",
      },
      medium: {
        focus: "Structure, flow, engagement, clarity, tone",
        depth: "Moderate restructuring and improvements",
      },
      deep: {
        focus: "Complete rewrite suggestions, major restructuring, strategic improvements",
        depth: "Comprehensive enhancement recommendations",
      },
    };

    const guidance =
      levelGuidance[enhancementLevel.toLowerCase()] || levelGuidance["medium"];

    return {
      status: "success",
      enhancementLevel: enhancementLevel.toLowerCase(),
      contentType: contentType || "Text",
      draftLength: draftContent.length,
      focusAreas: focusAreas || ["clarity", "engagement", "structure"],
      guidance: {
        focus: guidance.focus,
        depth: guidance.depth,
      },
      note: "Provide specific enhancement suggestions based on the level and focus areas. Do not rewrite the content.",
    };
  },
});

// ============================================================================
// Tool: Generate Reflection Prompts
// ============================================================================

interface GenerateReflectionPromptsParams {
  topic: string;
  contentType: string;
  context?: string;
}

const generateReflectionPromptsSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    topic: {
      type: Type.STRING,
      description: "Content topic or theme",
    },
    contentType: {
      type: Type.STRING,
      description: "Type of content being created",
    },
    context: {
      type: Type.STRING,
      description: "Additional context about the content or your perspective",
    },
  },
  required: ["topic", "contentType"],
};

export const generateReflectionPromptsTool = new FunctionTool({
  name: "generate_reflection_prompts",
  description:
    "Generate reflection prompts to help you add unique personal perspective to content. Returns prompts that encourage you to reflect on your experiences, insights, and unique viewpoint. These prompts are for you to answer separately—they help ensure your content has authentic, unique elements.",
  parameters: generateReflectionPromptsSchema,
  execute: async (input) => {
    const { topic, contentType, context } =
      input as GenerateReflectionPromptsParams;

    // This tool returns guidance for the agent to generate prompts
    return {
      status: "success",
      topic,
      contentType,
      context: context || "",
      note: "Generate 3-5 reflection prompts that help the user add their unique perspective, experiences, and insights to the content. These prompts should be thought-provoking and help surface authentic viewpoints.",
    };
  },
});

// ============================================================================
// Tool: Save Content Entry
// ============================================================================

interface SaveContentEntryParams {
  title: string;
  status?: string;
  contentGoal?: string;
  platform?: string[];
  contentType?: string[];
  targetAudience?: string;
  strategicIntent?: string;
  editorInstructions?: string;
  successMetrics?: string;
  editingWorkflow?: string;
  postDate?: string;
  outline?: string;
}

const saveContentEntrySchema: Schema = {
  type: Type.OBJECT,
  properties: {
    title: {
      type: Type.STRING,
      description: "Content title or post name",
    },
    status: {
      type: Type.STRING,
      description:
        "Status: Post Idea, Draft, Ready for Review, Scheduled, Published, Cancelled",
    },
    contentGoal: {
      type: Type.STRING,
      description: "Content goal: Awareness, Education, Conversion, Engagement",
    },
    platform: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: "Target platforms: Linkedin, Instagram, X, TikTok, YouTube",
    },
    contentType: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description:
        "Content types: Text, Image / photo, Video, Link, Carousel, Poll, Story, Live stream",
    },
    targetAudience: {
      type: Type.STRING,
      description: "Target audience: Beginner, Intermediate, Advanced, Mixed",
    },
    strategicIntent: {
      type: Type.STRING,
      description: "Strategic intent for this content",
    },
    editorInstructions: {
      type: Type.STRING,
      description: "Instructions for editing this content",
    },
    successMetrics: {
      type: Type.STRING,
      description: "Success metrics for this content",
    },
    editingWorkflow: {
      type: Type.STRING,
      description: "Editing workflow: Educational, Motivational, Tutorial, Conceptual",
    },
    postDate: {
      type: Type.STRING,
      description: "Post date in YYYY-MM-DD format",
    },
    outline: {
      type: Type.STRING,
      description: "Content outline or draft to save as page content",
    },
  },
  required: ["title"],
};

export const saveContentEntryTool = new FunctionTool({
  name: "save_content_entry",
  description:
    "Save a content entry (outline, draft, or plan) to the Notion Content database. Creates a new page with all provided metadata and optional content blocks.",
  parameters: saveContentEntrySchema,
  execute: async (input) => {
    const {
      title,
      status,
      contentGoal,
      platform,
      contentType,
      targetAudience,
      strategicIntent,
      editorInstructions,
      successMetrics,
      editingWorkflow,
      postDate,
      outline,
    } = input as SaveContentEntryParams;

    try {
      // Map string values to enum values
      const statusValue = status
        ? (status as ContentStatusValue)
        : ContentStatus.POST_IDEA;
      const goalValue = contentGoal
        ? (contentGoal as ContentGoalValue)
        : undefined;
      const platformValues = platform
        ? (platform.map((p) => p as ContentPlatformValue))
        : undefined;
      const contentTypeValues = contentType
        ? (contentType.map((t) => t as ContentTypeValue))
        : undefined;
      const audienceValue = targetAudience
        ? (targetAudience as ContentTargetAudienceValue)
        : undefined;
      const workflowValue = editingWorkflow
        ? (editingWorkflow as ContentEditingWorkflowValue)
        : undefined;

      // Build content blocks if outline provided
      const contentBlocks: CreatePageParameters["children"] | undefined = outline
        ? [
            {
              object: "block",
              type: "heading_2",
              heading_2: {
                rich_text: [{ type: "text", text: { content: "Outline" } }],
              },
            },
            {
              object: "block",
              type: "paragraph",
              paragraph: {
                rich_text: [{ type: "text", text: { content: outline } }],
              },
            },
          ] as CreatePageParameters["children"]
        : undefined;

      const contentInput: CreateContentInput = {
        title,
        status: statusValue,
        contentGoal: goalValue,
        platform: platformValues,
        contentType: contentTypeValues,
        targetAudience: audienceValue,
        strategicIntent,
        editorInstructions,
        successMetrics,
        editingWorkflow: workflowValue,
        postDate,
        contentBlocks,
      };

      const result = await createContent(contentInput);

      return {
        status: "success",
        contentId: result.pageId,
        notionUrl: result.url,
        title,
        savedFields: {
          status: statusValue,
          contentGoal: goalValue || null,
          platform: platformValues || [],
          contentType: contentTypeValues || [],
          targetAudience: audienceValue || null,
        },
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
// Content Agent
// ============================================================================

/**
 * Content Agent - Helps with content creation process
 *
 * Provides outlines, platform optimization, enhancement suggestions, and reflection prompts.
 * Does NOT generate full content—helps in the creation process.
 */
export const contentAgent = new LlmAgent({
  name: "content_agent",
  model: "gemini-2.0-flash",
  description:
    "Helps with content creation process: outlines, platform optimization, enhancement suggestions, and long-form content planning. Does not generate full content.",
  instruction: `
You are the Content Agent. You help with the content creation process—you don't generate full content, but provide outlines, suggestions, optimization guidance, and reflection prompts.

## Capabilities

### Multi-Platform Content
- Generate optimized outlines for LinkedIn, Instagram, Threads, Twitter, TikTok, YouTube
- Provide platform-specific optimization suggestions (character limits, hashtags, engagement tactics)
- Help adapt content structure for different platforms

### Content Enhancement
- Light: Grammar, spelling, basic style improvements
- Medium: Structure, flow, engagement, clarity improvements
- Deep: Comprehensive rewrite suggestions and strategic improvements

### Long-Form Generation
- Newsletter outlines and structure
- Blog series planning
- YouTube script outlines
- Whitepaper frameworks

### Reflection Prompts
- Generate prompts that help the user add unique personal perspective
- Encourage reflection on experiences, insights, and authentic viewpoints
- These prompts are for the user to answer separately—they ensure content has unique elements

## Workflow

1. **Get Context**
   - get_2026_strategy → align with strategic goals
   - get_yearly_vision → ensure vision alignment
   - Query related content/ideas if needed

2. **Create Outline**
   - create_content_outline → generate structured outline
   - Include sections, key points, recommendations
   - Do NOT write full content

3. **Platform Optimization**
   - optimize_content_for_platform → provide platform-specific guidance
   - Character limits, hashtags, engagement tactics
   - Do NOT rewrite content

4. **Enhancement**
   - enhance_content_draft → provide enhancement suggestions
   - Based on level (light/medium/deep) and focus areas
   - Do NOT rewrite content

5. **Reflection Prompts**
   - generate_reflection_prompts → create prompts for unique perspective
   - 3-5 thought-provoking prompts
   - User will answer these separately to add authentic elements

6. **Save to Notion**
   - save_content_entry → save outline/draft to Content database
   - Include all metadata: status, goal, platform, audience, etc.
   - User will update the Content page manually with their reflections

## Tools

- Strategy: get_2026_strategy, get_yearly_vision
- Planning: create_content_outline
- Optimization: optimize_content_for_platform
- Enhancement: enhance_content_draft
- Reflection: generate_reflection_prompts
- Storage: save_content_entry

## Response Style

- Provide actionable outlines and suggestions
- Include platform-specific guidance
- Reference strategy/vision alignment
- Generate reflection prompts inline (user answers separately)
- Save drafts with clear titles and metadata
- Always include Notion URLs/IDs
- Be concise and actionable

## Important Notes

- You do NOT generate full content—only outlines, suggestions, and prompts
- Reflection prompts are for the user to answer separately
- The user will manually update the Content page with their reflections
- Focus on helping the creation process, not doing the creation
`,
  subAgents: [],
  tools: [
    get2026StrategyTool,
    ...visionTools,
    createContentOutlineTool,
    optimizeForPlatformTool,
    enhanceContentTool,
    generateReflectionPromptsTool,
    saveContentEntryTool,
  ],
});

// ============================================================================
// Export Tools
// ============================================================================

export const contentTools = [
  get2026StrategyTool,
  ...visionTools,
  createContentOutlineTool,
  optimizeForPlatformTool,
  enhanceContentTool,
  generateReflectionPromptsTool,
  saveContentEntryTool,
];

