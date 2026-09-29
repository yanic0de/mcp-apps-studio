# Spec Delta: host-emulator

## MODIFIED Requirements

### Requirement: Host context
The emulator SHALL hold a `HostContext` (default `defaultHostContext`); `setHostContext(patch)` SHALL merge the patch into the current context and, when the widget has completed the handshake (`ui/notifications/initialized` received) and the emulator is running, send the widget the notification produced by `adapter.pushHostEvent`. Before the handshake or after `stop()` it MUST NOT notify. Fields that changed after the `ui/initialize` response was produced but before `ui/notifications/initialized` arrived SHALL be sent in one `ui/notifications/host-context-changed` right after the handshake completes.

#### Scenario: Theme change
- **WHEN** `setHostContext({ theme: 'dark' })` is called after the handshake
- **THEN** the widget receives `ui/notifications/host-context-changed` with `params: { theme: 'dark' }`
- **AND** `getHostContext().theme === 'dark'`

#### Scenario: Change before the handshake
- **WHEN** `setHostContext({ theme: 'dark' })` is called before the widget sent `ui/initialize`
- **THEN** no notification is sent, and the `ui/initialize` result carries `theme: 'dark'`

#### Scenario: Change during the handshake
- **WHEN** `setHostContext({ theme: 'dark' })` is called after the `ui/initialize` response but before `ui/notifications/initialized`
- **THEN** right after `initialized` the widget receives `ui/notifications/host-context-changed` with `params: { theme: 'dark' }`

#### Scenario: Change after stop
- **WHEN** `stop()` was called and then `setHostContext({ theme: 'dark' })`
- **THEN** nothing is sent and `getHostContext().theme === 'dark'`
