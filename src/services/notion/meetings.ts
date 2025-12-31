import type { PageObjectResponse } from "@notionhq/client/build/src/api-endpoints.js";
import { notionConfig } from "../../config/notionConfig.js";
import { propertyBuilders } from "./propertyBuilders.js";
import { extractPropertyValue } from "./propertyExtractors.js";
import { createPage, queryDatabase } from "./crud.js";
import type { CreateMeetingInput, MeetingResponse } from "./types.js";

/**
 * Meetings Domain
 * Operations for Meetings database
 */

export async function createMeeting(
  input: CreateMeetingInput
): Promise<{ pageId: string; url: string }> {
  const props = notionConfig.meetings.properties;

  const properties: import("@notionhq/client/build/src/api-endpoints.js").CreatePageParameters["properties"] = {
    [props.title.name]: propertyBuilders.title(input.title),
    [props.eventTime.name]: propertyBuilders.date(
      input.eventTime,
      input.eventTimeEnd
    ),
  };

  if (input.attendeeIds && input.attendeeIds.length > 0) {
    properties[props.attendees.name] = propertyBuilders.people(
      input.attendeeIds
    );
  }

  const page = await createPage("meetings", properties);

  return {
    pageId: page.id,
    url: page.url,
  };
}

/**
 * Query meetings for a specific date
 * @param date - Date in YYYY-MM-DD format
 */
export async function queryMeetingsByDate(
  date: string
): Promise<PageObjectResponse[]> {
  const props = notionConfig.meetings.properties;

  return queryDatabase("meetings", {
    filter: {
      property: props.eventTime.name,
      date: { equals: date },
    },
    sorts: [{ property: props.eventTime.name, direction: "ascending" }],
  });
}

/**
 * Query meetings within a date range
 * @param startDate - Start date in YYYY-MM-DD format
 * @param endDate - End date in YYYY-MM-DD format
 */
export async function queryMeetingsByDateRange(
  startDate: string,
  endDate: string
): Promise<PageObjectResponse[]> {
  const props = notionConfig.meetings.properties;

  return queryDatabase("meetings", {
    filter: {
      and: [
        {
          property: props.eventTime.name,
          date: { on_or_after: startDate },
        },
        {
          property: props.eventTime.name,
          date: { on_or_before: endDate },
        },
      ],
    },
    sorts: [{ property: props.eventTime.name, direction: "ascending" }],
  });
}

/**
 * Normalize a Notion page response to MeetingResponse
 */
export function normalizeMeetingResponse(
  page: PageObjectResponse
): MeetingResponse {
  const props = notionConfig.meetings.properties;
  const pageProps = page.properties;

  // Extract date range if available
  const dateProperty = pageProps[props.eventTime.name];
  let eventTime: string | null = null;
  let eventTimeEnd: string | null = null;

  if (dateProperty && dateProperty.type === "date" && dateProperty.date) {
    eventTime = dateProperty.date.start;
    eventTimeEnd = dateProperty.date.end || null;
  }

  return {
    pageId: page.id,
    url: page.url,
    title: extractPropertyValue(pageProps[props.title.name]) as string,
    eventTime,
    eventTimeEnd,
    attendeeIds:
      (extractPropertyValue(pageProps[props.attendees.name]) as string[]) || [],
    createdTime: page.created_time,
    lastEditedTime: page.last_edited_time,
  };
}

/**
 * Get meetings for today
 */
export async function getTodaysMeetings(): Promise<MeetingResponse[]> {
  const today = new Date().toISOString().split("T")[0];
  const pages = await queryMeetingsByDate(today);
  return pages.map(normalizeMeetingResponse);
}

/**
 * Get upcoming meetings for the next N days
 */
export async function getUpcomingMeetings(
  days: number = 7
): Promise<MeetingResponse[]> {
  const today = new Date();
  const endDate = new Date(today);
  endDate.setDate(endDate.getDate() + days);

  const pages = await queryMeetingsByDateRange(
    today.toISOString().split("T")[0],
    endDate.toISOString().split("T")[0]
  );
  return pages.map(normalizeMeetingResponse);
}

