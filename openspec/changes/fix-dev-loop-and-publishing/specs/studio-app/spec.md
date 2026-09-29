# Spec Delta: studio-app

## MODIFIED Requirements

### Requirement: Live reload
When served by the CLI, the studio SHALL subscribe to `/api/events`; on a `manifest` event it SHALL reload the manifest, keep the selected widget and scenario when they still exist, and remount the widget. A reloaded manifest without widgets SHALL show the built-in demo widget (and any discovery errors), exactly like a fresh start.

#### Scenario: Scenario data edited
- **WHEN** the mocked value in the active scenario is changed in the story file
- **THEN** the widget shows the new value without a manual refresh, in the same scenario

#### Scenario: Every story deleted
- **WHEN** a reload returns no widgets and no errors
- **THEN** the studio shows the demo widget instead of the deleted stories

## ADDED Requirements

### Requirement: Widget requests panel
The studio SHALL list what the widget asked the host to do — open a link, send a message, update the model context, download files, log, request teardown — with a one-line human description per request, newest last, capped at 50 and cleared with the trace. A link SHALL be rendered as clickable only for `http:` and `https:` URLs and SHALL open in a new tab with `rel="noopener noreferrer"`.

#### Scenario: Open link request
- **WHEN** the widget requests `ui/open-link` with `https://example.com/docs`
- **THEN** the panel shows an "Open link" entry whose link targets that URL with `rel="noopener noreferrer"`

#### Scenario: Message request
- **WHEN** the widget sends `ui/message` with a text block `Summarize this`
- **THEN** the panel shows a "Message" entry containing `Summarize this`

### Requirement: Teardown before removal
Before the studio removes a widget (scenario or widget switch, reload, unmount) it SHALL ask the emulator to tear the widget down, and dispose of the iframe transport only after the teardown finished or timed out.

#### Scenario: Scenario switch
- **WHEN** the user switches the scenario of a widget that completed the handshake
- **THEN** the trace of the old instance ends with a `ui/resource-teardown` request
