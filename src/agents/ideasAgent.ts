import { FunctionTool } from '@google/adk';
import { Schema, Type } from '@google/genai';

type IdeaParams = {
	rawText: string;
	autoElevateToBrief?: boolean;
};

const ideasSchema: Schema = {
	type: Type.OBJECT,
	properties: {
		rawText: { type: Type.STRING },
		autoElevateToBrief: { type: Type.BOOLEAN },
	},
	required: ['rawText'],
	additionalProperties: false,
};

export const captureIdea = new FunctionTool({
	name: 'capture_idea',
	description: 'Capture a raw idea and optionally elevate it into a Product Brief candidate.',
	parameters: ideasSchema,
	execute: async (input) => {
		const { rawText, autoElevateToBrief = false } = input as IdeaParams;
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

