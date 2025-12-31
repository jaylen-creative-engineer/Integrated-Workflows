/**
 * Notion Service
 * Modular service for interacting with Notion databases
 *
 * This barrel file re-exports all domain functions and utilities
 * for backward compatibility with existing imports.
 */

// Core utilities
export { notion } from "./client.js";
export { propertyBuilders } from "./propertyBuilders.js";
export {
  extractPropertyValue,
  getPageBlocksAsText,
} from "./propertyExtractors.js";
export {
  queryDatabase,
  createPage,
  updatePage,
  getPage,
  getDatabase,
} from "./crud.js";

// Types
export type {
  CreateProjectInput,
  CreateTaskInput,
  CreateIdeaInput,
  UpdateIdeaInput,
  IdeaResponse,
  CreateMeetingInput,
  MeetingResponse,
  CreateGameplanInput,
  GameplanResponse,
  CreateContentInput,
  UpdateContentInput,
  ContentResponse,
} from "./types.js";

// Projects domain
export { createProject, queryProjects } from "./projects.js";

// Tasks domain
export { createTask, queryTasksByProject } from "./tasks.js";

// Ideas domain
export {
  createIdea,
  updateIdea,
  queryIdeas,
  getIdea,
  normalizeIdeaResponse,
  getRecentIdeas,
  getIdeasByStatus,
} from "./ideas.js";

// Meetings domain
export {
  createMeeting,
  queryMeetingsByDate,
  queryMeetingsByDateRange,
  normalizeMeetingResponse,
  getTodaysMeetings,
  getUpcomingMeetings,
} from "./meetings.js";

// Gameplans domain
export {
  createGameplan,
  normalizeGameplanResponse,
  queryGameplansByDate,
  getGameplanForDate,
  getTodaysGameplan,
  appendGameplanContent,
} from "./gameplans.js";

// Content domain
export {
  createContent,
  updateContent,
  queryContent,
  normalizeContentResponse,
} from "./content.js";

