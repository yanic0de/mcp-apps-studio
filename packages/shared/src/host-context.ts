import { z } from 'zod';

export const displayModeSchema = z.enum(['inline', 'fullscreen', 'pip']);

export const hostContextSchema = z.object({
  theme: z.enum(['light', 'dark']),
  locale: z.string(),
  displayMode: displayModeSchema,
  availableDisplayModes: z.array(displayModeSchema).optional(),
  /** Fixed `width`/`height` or `maxWidth`/`maxHeight` bounds, as in the SDK. */
  containerDimensions: z
    .object({
      width: z.number().optional(),
      maxWidth: z.number().optional(),
      height: z.number().optional(),
      maxHeight: z.number().optional(),
    })
    .optional(),
  styles: z
    .object({
      variables: z.record(z.string(), z.string()).optional(),
      css: z.object({ fonts: z.string().optional() }).optional(),
    })
    .optional(),
  safeAreaInsets: z.object({ top: z.number(), right: z.number(), bottom: z.number(), left: z.number() }).optional(),
  timeZone: z.string().optional(),
  userAgent: z.string().optional(),
  platform: z.enum(['web', 'desktop', 'mobile']).optional(),
  deviceCapabilities: z.object({ touch: z.boolean().optional(), hover: z.boolean().optional() }).optional(),
});
export type HostContext = z.infer<typeof hostContextSchema>;

export const defaultHostContext: HostContext = {
  theme: 'light',
  locale: 'en',
  displayMode: 'inline',
  platform: 'web',
  userAgent: 'mcp-apps-studio',
};
