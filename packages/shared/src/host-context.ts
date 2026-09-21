import { z } from 'zod';

export const hostContextSchema = z.object({
  theme: z.enum(['light', 'dark']),
  locale: z.string(),
  displayMode: z.enum(['inline', 'fullscreen', 'pip']),
  containerDimensions: z.object({ width: z.number(), maxHeight: z.number() }).optional(),
  styles: z
    .object({
      variables: z.record(z.string(), z.string()).optional(),
      css: z.object({ fonts: z.string().optional() }).optional(),
    })
    .optional(),
  safeAreaInsets: z.object({ top: z.number(), right: z.number(), bottom: z.number(), left: z.number() }).optional(),
});
export type HostContext = z.infer<typeof hostContextSchema>;

export const defaultHostContext: HostContext = {
  theme: 'light',
  locale: 'en',
  displayMode: 'inline',
};
