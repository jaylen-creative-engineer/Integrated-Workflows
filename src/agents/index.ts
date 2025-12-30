// ============================================================================
// Hierarchical Agent Exports (New Architecture)
// ============================================================================

// Top-level orchestrator
export { creativeAgent } from "./creativeAgent.js";

// Sub-agents
export { wellnessAgent } from "./wellnessAgent.js";
export { workflowsAgent, workflowsTools } from "./workflowsAgent.js";

// ============================================================================
// Domain Tool Exports
// ============================================================================

// Wellness domain
export { energyTools } from "./energyAgent.js";

// Workflows domain
export { ideasTools } from "./ideasAgent.js";
export { meetingsTools } from "./meetingsAgent.js";
export { projectsTools } from "./projectsAgent.js";
export { tasksTools } from "./tasksAgent.js";
export { gameplansTools } from "./gameplansAgent.js";
