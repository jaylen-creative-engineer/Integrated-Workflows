import { FunctionTool } from '@google/adk';
import { z } from 'zod';

export const createProductBrief = new FunctionTool({
	name: 'create_product_brief',
	description: 'Create or update a Product Brief given an idea and constraints.',
	parameters: z.object({
		title: z.string(),
		ideaSummary: z.string(),
		scopeNotes: z.string().optional(),
		timeboxDays: z.number().int().positive().optional(),
		targetSurface: z.string().optional(), // e.g. "Next.js app", "Spec"
	}),
	// Stub executor; replace with Notion + business logic later.
	execute: async ({ title, ideaSummary, scopeNotes, timeboxDays, targetSurface }) => {
		const briefId = `brief-${Date.now()}`;

		return {
			status: 'stubbed',
			briefId,
			notionUrl: 'https://notion.invalid/brief-placeholder',
			summary: `Created/updated brief '${title}'`,
			ideaSummary,
			scopeNotes,
			timeboxDays,
			targetSurface,
		};
	},
});

export const projectsTools = [createProductBrief];

