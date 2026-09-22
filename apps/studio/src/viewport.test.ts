import { describe, expect, it } from 'vitest';
import { containerDimensions, DEVICES, deviceContext, frameSize } from './viewport.js';

const canvas = { width: 1000, height: 700 };

describe('frameSize', () => {
  it('inline: device column width, reported height, default 240', () => {
    expect(frameSize('inline', 'desktop', 190, canvas)).toEqual({ width: 640, height: 190 });
    expect(frameSize('inline', 'desktop', undefined, canvas)).toEqual({ width: 640, height: 240 });
    expect(frameSize('inline', 'mobile', 190, canvas)).toEqual({ width: 375, height: 190 });
  });

  it('inline: clamps the reported height to 40…800', () => {
    expect(frameSize('inline', 'desktop', 5000, canvas).height).toBe(800);
    expect(frameSize('inline', 'desktop', 3, canvas).height).toBe(40);
  });

  it('pip: small box, height clamped to 320', () => {
    expect(frameSize('pip', 'desktop', 5000, canvas)).toEqual({ width: 360, height: 320 });
    expect(frameSize('pip', 'mobile', 100, canvas)).toEqual({ width: 360, height: 100 });
  });

  it('fullscreen: fills the canvas minus the gutter; mobile keeps its column', () => {
    expect(frameSize('fullscreen', 'desktop', 190, canvas)).toEqual({ width: 968, height: 668 });
    expect(frameSize('fullscreen', 'mobile', 190, canvas)).toEqual({ width: 375, height: 668 });
  });
});

describe('containerDimensions', () => {
  it('describes the bounds the host gives the widget per mode', () => {
    expect(containerDimensions('inline', 'desktop', canvas)).toEqual({ width: 640, maxHeight: 800 });
    expect(containerDimensions('pip', 'desktop', canvas)).toEqual({ width: 360, maxHeight: 320 });
    expect(containerDimensions('fullscreen', 'desktop', canvas)).toEqual({ width: 968, height: 668 });
  });
});

describe('deviceContext', () => {
  it('maps presets to host context fields', () => {
    expect(deviceContext('desktop')).toEqual({
      platform: 'web',
      deviceCapabilities: { touch: false, hover: true },
      safeAreaInsets: { top: 0, right: 0, bottom: 0, left: 0 },
    });
    expect(deviceContext('mobile')).toMatchObject({
      platform: 'mobile',
      deviceCapabilities: { touch: true, hover: false },
      safeAreaInsets: { top: 47, right: 0, bottom: 34, left: 0 },
    });
  });

  it('offers exactly the desktop and mobile presets', () => {
    expect(Object.keys(DEVICES)).toEqual(['desktop', 'mobile']);
  });
});
