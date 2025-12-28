import { FunctionTool } from '@google/adk';
import { z } from 'zod';

export const captureIdea = new FunctionTool({
	name: 'capture_idea',
	description: 'Capture a raw idea and optionally elevate it into a Product Brief candidate.',
	parameters: z.object({
		rawText: z.string(),
		autoElevateToBrief: z.boolean().default(false),
	}),
	execute: async ({ rawText, autoElevateToBrief }) => {
		const ideaId = `idea-${Date.now()}`;

		const briefCandidate = autoElevateToBrief
			? {
					title: 'Auto-derived title from raw text',
					ideaSummary: rawText.slice(0, 240),
			  }
			: null;

		return {
			status: 'stubbed',
			ideaId,
			briefCandidate,
		};
	},
});

export const ideasTools = [captureIdea];

