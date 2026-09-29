import type { HostContext } from '@studio/shared';

type DisplayMode = HostContext['displayMode'];

/** Host device presets: the chat column width and what the host tells the widget about the device. */
export const DEVICES = {
  desktop: {
    column: 640,
    context: {
      platform: 'web',
      deviceCapabilities: { touch: false, hover: true },
      safeAreaInsets: { top: 0, right: 0, bottom: 0, left: 0 },
    },
  },
  mobile: {
    column: 375,
    context: {
      platform: 'mobile',
      deviceCapabilities: { touch: true, hover: false },
      safeAreaInsets: { top: 47, right: 0, bottom: 34, left: 0 },
    },
  },
} as const satisfies Record<string, { column: number; context: Partial<HostContext> }>;

export type Device = keyof typeof DEVICES;

const INLINE_MAX_HEIGHT = 800;
const PIP_WIDTH = 360;
const PIP_MAX_HEIGHT = 320;
const MIN_HEIGHT = 40;
const DEFAULT_HEIGHT = 240;
const GUTTER = 16;

export interface Size {
  width: number;
  height: number;
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

export function deviceContext(device: Device): Partial<HostContext> {
  const { platform, deviceCapabilities, safeAreaInsets } = DEVICES[device].context;
  return { platform, deviceCapabilities: { ...deviceCapabilities }, safeAreaInsets: { ...safeAreaInsets } };
}

function fullscreenSize(device: Device, canvas: Size): Size {
  const width = Math.max(0, canvas.width - 2 * GUTTER);
  const height = Math.max(0, canvas.height - 2 * GUTTER);
  return { width: device === 'mobile' ? Math.min(DEVICES.mobile.column, width) : width, height };
}

/** Frame size a host would give the widget: the host owns the width, the widget's reports drive the height. */
export function frameSize(mode: DisplayMode, device: Device, reportedHeight: number | undefined, canvas: Size): Size {
  const height = reportedHeight ?? DEFAULT_HEIGHT;
  switch (mode) {
    case 'inline':
      return { width: DEVICES[device].column, height: clamp(height, MIN_HEIGHT, INLINE_MAX_HEIGHT) };
    case 'pip':
      return { width: Math.min(PIP_WIDTH, DEVICES[device].column), height: clamp(height, MIN_HEIGHT, PIP_MAX_HEIGHT) };
    case 'fullscreen':
      return fullscreenSize(device, canvas);
  }
}

/** `hostContext.containerDimensions` for the mode: fixed size in fullscreen, a max height otherwise. */
export function containerDimensions(
  mode: DisplayMode,
  device: Device,
  canvas: Size,
): NonNullable<HostContext['containerDimensions']> {
  switch (mode) {
    case 'inline':
      return { width: DEVICES[device].column, maxHeight: INLINE_MAX_HEIGHT };
    case 'pip':
      return { width: Math.min(PIP_WIDTH, DEVICES[device].column), maxHeight: PIP_MAX_HEIGHT };
    case 'fullscreen':
      return fullscreenSize(device, canvas);
  }
}
