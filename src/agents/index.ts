// ============================================================================
// Hierarchical Agent Exports (New Architecture)
// ============================================================================

// Top-level orchestrator
export { creativeAgent } from "./creativeAgent.js";

// Sub-agents
export { briefAgent, briefTools } from "./briefAgent.js";
export { wellnessAgent } from "./wellnessAgent.js";
export { workflowsAgent, workflowsTools } from "./workflowsAgent.js";
export { researchAgent } from "./researchAgent.js";
export { searchAgent } from "./searchAgent.js";

// ============================================================================
// Domain Tool Exports
// ============================================================================

// Wellness domain
export { energyTools } from "./energyAgent.js";

// Brief domain
export { gameplansTools } from "./gameplansAgent.js";
export { projectsTools } from "./projectsAgent.js";
export { visionTools } from "./visionAgent.js";

// Workflows domain
export { ideasTools } from "./ideasAgent.js";
export { meetingsTools } from "./meetingsAgent.js";
export { tasksTools } from "./tasksAgent.js";

// Research domain
export { researchTools } from "./researchAgent.js";
