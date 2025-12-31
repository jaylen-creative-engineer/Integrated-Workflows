import type { PageObjectResponse } from "@notionhq/client/build/src/api-endpoints.js";
import { notionConfig } from "../../config/notionConfig.js";
import { propertyBuilders } from "./propertyBuilders.js";
import { createPage, queryDatabase } from "./crud.js";
import type { CreateTaskInput } from "./types.js";

/**
 * Tasks Domain
 * Operations for Tasks database
 */

export async function createTask(
  input: CreateTaskInput
): Promise<{ pageId: string; url: string }> {
  const props = notionConfig.tasks.properties;

  const properties: import("@notionhq/client/build/src/api-endpoints.js").CreatePageParameters["properties"] = {
    [props.title.name]: propertyBuilders.title(input.title),
  };

  if (input.status) {
    properties[props.status.name] = propertyBuilders.status(input.status);
  }
  if (input.projectId) {
    properties[props.project.name] = propertyBuilders.relation([
      input.projectId,
    ]);
  }
  if (input.dueDate) {
    properties[props.dueDate.name] = propertyBuilders.date(input.dueDate);
  }
  if (input.assigneeId) {
    properties[props.assignee.name] = propertyBuilders.people([
      input.assigneeId,
    ]);
  }
  if (input.priority) {
    properties[props.priority.name] = propertyBuilders.select(input.priority);
  }
  if (input.tags && input.tags.length > 0) {
    properties[props.tags.name] = propertyBuilders.multiSelect(input.tags);
  }
  if (input.taskType && input.taskType.length > 0) {
    properties[props.taskType.name] = propertyBuilders.multiSelect(
      input.taskType
    );
  }
  if (input.summary) {
    properties[props.summary.name] = propertyBuilders.richText(input.summary);
  }

  const page = await createPage("tasks", properties);

  return {
    pageId: page.id,
    url: page.url,
  };
}

export async function queryTasksByProject(
  projectId: string
): Promise<PageObjectResponse[]> {
  const props = notionConfig.tasks.properties;

  return queryDatabase("tasks", {
    filter: {
      property: props.project.name,
      relation: { contains: projectId },
    },
  });
}

