import { LlmAgent } from '@google/adk';
import { ideasTools } from './ideasAgent';
import { meetingsTools } from './meetingsAgent';
import { projectsTools } from './projectsAgent';
import { tasksTools } from './tasksAgent';

export const rootAgent = new LlmAgent({
	name: 'creative_os_root',
	model: 'gemini-2.0-flash',
	description: 'Orchestrates daily and product briefs for a creative studio.',
	instruction: `
You are the orchestration agent for a creative studio.
- Map ideas → product briefs.
- Map product briefs → workflows (tasks, meetings).
- Compose daily briefs using energy data + tasks + meetings + briefs.
Prefer calling tools over freeform text. Keep outputs concise and structured.`,
	tools: [
		...projectsTools,
		...tasksTools,
		...meetingsTools,
		...ideasTools,
	],
});

export const allDomainTools = [
	...projectsTools,
	...tasksTools,
	...meetingsTools,
	...ideasTools,
];

