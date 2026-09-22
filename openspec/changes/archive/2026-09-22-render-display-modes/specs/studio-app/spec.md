## ADDED Requirements

### Requirement: Frame follows the widget and the display mode
The canvas SHALL size the iframe by display mode and device: `inline` — the device column width and the height last reported by `size-changed` (default 240) clamped to 40…800; `pip` — width `min(360, column)` and the reported height clamped to 40…320, shown as a floating box; `fullscreen` — the canvas area minus a 16 px gutter (on `mobile`, the column width by the canvas height). The widget-reported width MUST NOT change the frame width.

#### Scenario: Widget reports its height
- **WHEN** the widget sends `size-changed` with `{ height: 190 }` in `inline` mode on `desktop`
- **THEN** the iframe is 640 px wide and 190 px high

#### Scenario: Height beyond the inline maximum
- **WHEN** the widget reports `{ height: 5000 }` inline
- **THEN** the iframe is 800 px high

#### Scenario: Fullscreen
- **WHEN** the user selects `fullscreen`
- **THEN** the iframe fills the canvas minus the gutter

### Requirement: Device presets
The studio SHALL offer `desktop` (column 640, `platform: 'web'`, hover, no touch) and `mobile` (column 375, `platform: 'mobile'`, touch, no hover, `safeAreaInsets` `{ top: 47, right: 0, bottom: 34, left: 0 }`) through a "Device" selector; the selected preset's fields SHALL be part of the host context.

#### Scenario: Switch to mobile
- **WHEN** the user selects `mobile`
- **THEN** the widget receives `host-context-changed` with `platform: 'mobile'` and `deviceCapabilities: { touch: true, hover: false }`
- **AND** the inline frame is 375 px wide

### Requirement: Container dimensions in the host context
The host context SHALL carry `containerDimensions` for the current mode and device — inline `{ width: column, maxHeight: 800 }`, pip `{ width, maxHeight: 320 }`, fullscreen `{ width, height }` of the frame — and SHALL be updated only when these values change.

#### Scenario: Fullscreen dimensions
- **WHEN** the mode becomes `fullscreen` on a 1000×700 canvas on `desktop`
- **THEN** `containerDimensions` equals `{ width: 968, height: 668 }`
