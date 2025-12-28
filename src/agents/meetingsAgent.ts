import { FunctionTool } from '@google/adk';
import { z } from 'zod';

export const buildMeetingContextsForDay = new FunctionTool({
	name: 'build_meeting_contexts_for_day',
	description: 'Build meeting context docs for a date, mapped to product briefs and tasks.',
	parameters: z.object({
		date: z.string().describe('ISO date (YYYY-MM-DD)'),
	}),
	execute: async ({ date }) => {
		const meetings = [
			{
				title: 'QA Sync',
				time: `${date}T13:00:00-05:00`,
				productBriefId: 'brief-stub',
				keyQuestions: [
					'Are key routes and events mapped?',
					'What is blocking the next shipping step?',
				],
			},
		];

		return {
			status: 'stubbed',
			date,
			meetings,
		};
	},
});

export const meetingsTools = [buildMeetingContextsForDay];

