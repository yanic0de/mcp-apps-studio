# Proposal

## Why

The studio's display-mode selector only flips a field in the host context: the iframe stays a fixed 360×240 box whatever the widget reports through `ui/notifications/size-changed` (the emulator's `onSizeChanged` is not even wired) and whatever the mode. Widgets therefore cannot be checked for the things hosts actually do to them — grow to their content inline, fill the screen in fullscreen, shrink to a picture-in-picture box, run on a narrow touch device — and `containerDimensions`, `platform`, `deviceCapabilities`, `safeAreaInsets` never reach the widget.

## What Changes

- The iframe height follows the widget's `size-changed` reports (inline and pip), clamped to the mode's maximum; the width is the container's, as in a chat column.
- Display modes lay the frame out: `inline` — the device's column width; `fullscreen` — fills the canvas; `pip` — a small floating box.
- Device presets (`desktop`, `mobile`) set the column width and the host context fields `platform`, `deviceCapabilities`, `safeAreaInsets`; a "Device" selector joins the header controls.
- The host context carries `containerDimensions` for the current mode and device and is updated when they change.

## Capabilities

### New Capabilities
<!-- none -->

### Modified Capabilities
- `studio-app`: canvas layout per display mode, auto-height from `size-changed`, device presets, container dimensions in the host context.

## Impact

- Code: `apps/studio` only (new pure `viewport.ts`, store, Canvas, HeaderControls, styles), e2e.
- No protocol or package API changes.
