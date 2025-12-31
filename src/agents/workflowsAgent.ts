import { LlmAgent } from "@google/adk";
import { ideasTools } from "./ideasAgent.js";
import { meetingsTools } from "./meetingsAgent.js";
import { getTasksForBrief } from "./tasksAgent.js";

/**
 * Workflows Agent - Sub-agent responsible for execution and data retrieval.
 *
 * Manages execution operations:
 * - Ideas capture and querying
 * - Meeting queries and scheduling
 * - Task queries (read operations)
 *
 * Note: Brief creation, task generation, and strategic planning are handled by BriefAgent.
 */
export const workflowsAgent = new LlmAgent({
  name: "workflows_agent",
  model: "gemini-2.0-flash",
  description:
    "Manages execution workflows: ideas, meetings, and task queries. Supports BriefAgent with data retrieval.",
  instruction: `
You are the Workflows Agent. Be concise. Provide execution data fast: ideas, meetings, task queries. Support BriefAgent; do not create briefs or generate tasks.

## Capabilities
- Ideas: capture, update, query, get by ID, recent.
- Meetings: today, upcoming, date range, schedule.
- Tasks: get_tasks_for_brief (read-only).

## Role in Architecture
- BriefAgent handles briefs, task generation, and strategy.
- You handle data retrieval and meeting scheduling.
- Format outputs so BriefAgent can drop them into briefs (include Notion URLs/IDs, status, priority, dates).

## Tools
- Ideas: capture_idea, update_idea, query_ideas, get_idea, get_recent_ideas
- Meetings: get_todays_meetings, get_upcoming_meetings, build_meeting_contexts_for_day, get_meetings_by_date_range, schedule_meeting
- Tasks: get_tasks_for_brief

## Response Style
- Short bullets, high-signal fields (title, status, priority, due, URL).
- Note filters used. Call out risks/blockers if obvious.
`,
  tools: [
    ...ideasTools,
    ...meetingsTools,
    getTasksForBrief, // Only task queries, not generation
  ],
});

// Export combined tools array for reference
export const workflowsTools = [
  ...ideasTools,
  ...meetingsTools,
  getTasksForBrief,
];
