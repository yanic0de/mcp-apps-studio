# Design

## Context

The emulator already reports `size-changed` through `onSizeChanged` and pushes context patches; the studio simply never used either for layout. All layout math can be a pure function, keeping DOM measurement at the edge (Canvas).

## Goals / Non-Goals

**Goals:** frame size and host context agree with what a host would do for each mode and device; everything that decides sizes is unit-tested.

**Non-Goals:** pixel-exact replicas of Claude/ChatGPT chrome; custom device sizes (presets only); widget-reported width (hosts own the width in inline mode).

## Decisions

**1. Pure `viewport.ts`.** `DEVICES` (preset → column width, platform, capabilities, insets), `frameSize(mode, device, reportedHeight, canvas)` and `containerDimensions(mode, device, canvas)`. Canvas only measures itself (ResizeObserver) and feeds numbers in.

**2. Sizes.** Inline: width = device column (desktop 640, mobile 375), height = reported height (default 240) clamped to 40…800, `containerDimensions = { width, maxHeight: 800 }`. Pip: width = min(360, column), height = reported clamped to 40…320, `{ width, maxHeight: 320 }`. Fullscreen: fills the canvas minus a 16 px gutter (mobile: column width × canvas height), `{ width, height }`.

**3. Context sync from one effect.** Canvas computes the device/mode patch (`platform`, `deviceCapabilities`, `safeAreaInsets`, `containerDimensions`) and calls `setHostContext` only when it differs from the stored values, so resizes do not flood the widget and nothing loops.

**4. Reported height is per iframe.** It lives in Canvas state keyed to the widget+scenario, so a remount starts from the default height.

## Risks / Trade-offs

- [Canvas resizes in fullscreen send context updates] → only when the rounded dimensions change.
