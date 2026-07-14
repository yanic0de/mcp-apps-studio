export type WidgetSource =
  | { kind: 'resource'; uri: string; html: string }
  | { kind: 'dev'; url: string };
