import { selectActiveWidget, useStudioStore } from '../store.js';

export function HeaderControls() {
  const widgets = useStudioStore((s) => s.widgets);
  const activeWidget = useStudioStore(selectActiveWidget);
  const hostContext = useStudioStore((s) => s.hostContext);
  const scenario = useStudioStore((s) => s.scenario);
  const setActiveWidget = useStudioStore((s) => s.setActiveWidget);
  const setHostContext = useStudioStore((s) => s.setHostContext);
  const setScenario = useStudioStore((s) => s.setScenario);

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
              {name === 'live' ? 'live (example-server)' : name}
            </option>
          ))}
        </select>
      </label>
      <label className="control">
        Theme
        <select value={hostContext.theme} onChange={(e) => setHostContext({ theme: e.target.value as 'light' | 'dark' })}>
          <option value="light">light</option>
          <option value="dark">dark</option>
        </select>
      </label>
      <label className="control">
        Display
        <select
          value={hostContext.displayMode}
          onChange={(e) => setHostContext({ displayMode: e.target.value as 'inline' | 'fullscreen' | 'pip' })}
        >
          <option value="inline">inline</option>
          <option value="fullscreen">fullscreen</option>
          <option value="pip">pip</option>
        </select>
      </label>
    </div>
  );
}
