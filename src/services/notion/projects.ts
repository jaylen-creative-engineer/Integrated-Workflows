import type { QueryDataSourceParameters, PageObjectResponse } from "@notionhq/client/build/src/api-endpoints.js";
import { notionConfig } from "../../config/notionConfig.js";
import { propertyBuilders } from "./propertyBuilders.js";
import { createPage, queryDatabase } from "./crud.js";
import type { CreateProjectInput } from "./types.js";

/**
 * Projects Domain
 * Operations for Projects/Initiatives database
 */

export async function createProject(
  input: CreateProjectInput
): Promise<{ pageId: string; url: string }> {
  const props = notionConfig.projects.properties;

  const properties: import("@notionhq/client/build/src/api-endpoints.js").CreatePageParameters["properties"] = {
    [props.title.name]: propertyBuilders.title(input.title),
  };

  if (input.summary) {
    properties[props.summary.name] = propertyBuilders.richText(input.summary);
  }
  if (input.status) {
    properties[props.status.name] = propertyBuilders.status(input.status);
  }
  if (input.priority) {
    properties[props.priority.name] = propertyBuilders.select(input.priority);
  }
  if (input.initiative) {
    properties[props.initiative.name] = propertyBuilders.multiSelect(
      input.initiative
    );
  }
  if (input.dates) {
    properties[props.dates.name] = propertyBuilders.date(
      input.dates.start,
      input.dates.end
    );
  }

  const page = await createPage("projects", properties);

  return {
    pageId: page.id,
    url: page.url,
  };
}

export async function queryProjects(filter?: {
  status?: string;
  initiative?: string;
}): Promise<PageObjectResponse[]> {
  const props = notionConfig.projects.properties;
  const filters: Array<QueryDataSourceParameters["filter"]> = [];

  if (filter?.status) {
    filters.push({
      property: props.status.name,
      status: { equals: filter.status },
    });
  }

  if (filter?.initiative) {
    filters.push({
      property: props.initiative.name,
      multi_select: { contains: filter.initiative },
    });
  }

  const queryFilter: QueryDataSourceParameters["filter"] | undefined =
    filters.length > 1
      ? ({ and: filters } as QueryDataSourceParameters["filter"])
      : filters.length === 1
      ? filters[0]
      : undefined;

  return queryDatabase("projects", { filter: queryFilter });
}

