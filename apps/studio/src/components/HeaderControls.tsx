import { hostContextSchema } from '@studio/shared';
import { adapter } from '../adapter.js';
import { selectActiveWidget, useStudioStore } from '../store.js';
import { DEVICES, type Device } from '../viewport.js';

// Option lists come from the protocol schema and the adapter, never from a second hand-written copy.
const themeSchema = hostContextSchema.shape.theme;
const displayModeSchema = hostContextSchema.shape.displayMode;
const displayModes = adapter.capabilities().displayModes;
const devices = Object.keys(DEVICES) as Device[];
const isDevice = (v: string): v is Device => v in DEVICES;

export function HeaderControls() {
  const widgets = useStudioStore((s) => s.widgets);
  const activeWidget = useStudioStore(selectActiveWidget);
  const hostContext = useStudioStore((s) => s.hostContext);
  const scenario = useStudioStore((s) => s.scenario);
  const setActiveWidget = useStudioStore((s) => s.setActiveWidget);
  const setHostContext = useStudioStore((s) => s.setHostContext);
  const setScenario = useStudioStore((s) => s.setScenario);
  const device = useStudioStore((s) => s.device);
  const setDevice = useStudioStore((s) => s.setDevice);

  return (
    <div className="controls">
      {widgets.length > 1 && (
        <label className="control">
          Widget
          <select value={activeWidget?.id ?? ''} onChange={(e) => setActiveWidget(e.target.value)}>
            {widgets.map((w) => (
              <option key={w.id} value={w.id}>
                {w.title}
              </option>
            ))}
          </select>
        </label>
      )}
      <label className="control">
        Scenario
        <select value={scenario} onChange={(e) => setScenario(e.target.value)}>
          {Object.keys(activeWidget?.scenarios ?? {}).map((name) => (
            <option key={name} value={name}>
              {name === 'live' ? 'live (MCP server)' : name}
            </option>
          ))}
        </select>
      </label>
      <label className="control">
        Theme
        <select
          value={hostContext.theme}
          onChange={(e) => setHostContext({ theme: themeSchema.parse(e.target.value) })}
        >
          {themeSchema.options.map((theme) => (
            <option key={theme} value={theme}>
              {theme}
            </option>
          ))}
        </select>
      </label>
      <label className="control">
        Device
        <select value={device} onChange={(e) => isDevice(e.target.value) && setDevice(e.target.value)}>
          {devices.map((d) => (
            <option key={d} value={d}>
              {d}
            </option>
          ))}
        </select>
      </label>
      <label className="control">
        Display
        <select
          value={hostContext.displayMode}
          onChange={(e) => setHostContext({ displayMode: displayModeSchema.parse(e.target.value) })}
        >
          {displayModes.map((mode) => (
            <option key={mode} value={mode}>
              {mode}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}
