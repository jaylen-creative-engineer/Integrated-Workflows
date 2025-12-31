import { FunctionTool } from "@google/adk";
import { Schema, Type } from "@google/genai";
import { getPageBlocksAsText } from "../services/notion/index.js";

// ============================================================================
// Constants
// ============================================================================

/**
 * Notion page ID for the yearly vision document
 * This is a read-only reference artifact that guides decision-making
 */
const YEARLY_VISION_PAGE_ID = "29e82787-0ecb-801c-a110-c6a50af733f4";

// ============================================================================
// Tool: Get Yearly Vision
// ============================================================================

export const getYearlyVisionTool = new FunctionTool({
  name: "get_yearly_vision",
  description:
    "Retrieve the yearly vision document from Notion. This is a read-only reference artifact that guides decision-making, enables reflection, and keeps execution aligned with annual goals. Use this when creating gameplans, generating tasks, making strategic decisions, or conducting reviews to ensure alignment with the vision.",
  parameters: {
    type: Type.OBJECT,
    properties: {},
    required: [],
  },
  execute: async () => {
    try {
      const visionContent = await getPageBlocksAsText(YEARLY_VISION_PAGE_ID);

      if (!visionContent || visionContent.trim().length === 0) {
        return {
          status: "not_found",
          message:
            "Yearly vision document exists but contains no readable content.",
        };
      }

      return {
        status: "success",
        visionContent,
        pageId: YEARLY_VISION_PAGE_ID,
        note: "This is a read-only reference. Use this vision to guide decisions, ensure task alignment, and enable reflection on progress toward annual goals.",
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
// Export all tools
// ============================================================================

export const visionTools = [getYearlyVisionTool];
