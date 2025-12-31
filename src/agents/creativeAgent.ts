import { LlmAgent } from "@google/adk";
import { briefAgent } from "./briefAgent.js";
import { wellnessAgent } from "./wellnessAgent.js";
import { workflowsAgent } from "./workflowsAgent.js";
import { visionTools } from "./visionAgent.js";

/**
 * Creative Agent - Top-level orchestrator for the creative studio.
 *
 * Coordinates three specialized sub-agents:
 * - Brief Agent: Daily/weekly/quarterly briefs, strategic planning, vision alignment
 * - Wellness Agent: Energy schedules, biometrics, timing optimization
 * - Workflows Agent: Ideas, meetings, task queries (execution support)
 *
 * Routes requests to appropriate sub-agents and coordinates multi-agent scenarios.
 */
export const creativeAgent = new LlmAgent({
  name: "creative_agent",
  model: "gemini-2.0-flash",
  description:
    "Top-level orchestrator for a creative studio, coordinating brief creation, wellness optimization, and workflow execution.",
  instruction: `
You are the Creative Agent (orchestrator). Route to the right sub-agent, keep outputs concise, and ensure energy/vision context is used when relevant.

## Sub-Agents
- brief_agent: briefs (daily/weekly/quarterly), strategy, vision alignment, product briefs, task generation.
- wellness_agent: energy schedules and timing recommendations.
- workflows_agent: ideas, meetings, task queries (read-only).

## Delegation Rules
- Brief/strategy → brief_agent.
- Wellness/timing → wellness_agent.
- Ideas/meetings/task queries → workflows_agent.

## Brief Creation Protocol
1) wellness_agent → get today's energy schedule.
2) brief_agent → create the brief/gameplan (it will fetch vision and delegate to workflows_agent for data).
3) You review: energy alignment, vision alignment, conflicts.
4) Deliver a clear, actionable summary with links/IDs.

## Checklist
□ Correct agent?  
□ Energy used when scheduling?  
□ Vision alignment noted (if strategic/brief)?  
□ Clear next actions, concise bullets?  
□ Links/IDs included?  

## Examples
- Daily gameplan: wellness → brief_agent with energy context → present plan.
- Weekly review: brief_agent → present insights and next focus.
- Strategic priority: brief_agent → present priorities with vision rationale.
- Ideas-only: workflows_agent → capture/query idea.
`,
  subAgents: [briefAgent, wellnessAgent, workflowsAgent],
  tools: [...visionTools],
});
