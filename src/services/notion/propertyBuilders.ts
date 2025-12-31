/**
 * Property Builders
 * Helpers to construct Notion property values for page creation/updates
 */

export const propertyBuilders = {
  title: (text: string) => ({
    title: [{ text: { content: text } }],
  }),

  richText: (text: string) => ({
    rich_text: [{ text: { content: text } }],
  }),

  select: (name: string) => ({
    select: { name },
  }),

  multiSelect: (names: string[]) => ({
    multi_select: names.map((name) => ({ name })),
  }),

  status: (name: string) => ({
    status: { name },
  }),

  date: (start: string, end?: string) => ({
    date: { start, ...(end && { end }) },
  }),

  number: (value: number) => ({
    number: value,
  }),

  checkbox: (checked: boolean) => ({
    checkbox: checked,
  }),

  url: (url: string) => ({
    url,
  }),

  relation: (pageIds: string[]) => ({
    relation: pageIds.map((id) => ({ id })),
  }),

  people: (userIds: string[]) => ({
    people: userIds.map((id) => ({ id })),
  }),
};

