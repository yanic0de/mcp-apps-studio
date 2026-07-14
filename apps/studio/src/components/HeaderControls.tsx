import type { ScenarioId } from '../store.js';
import { useStudioStore } from '../store.js';

export function HeaderControls() {
  const hostContext = useStudioStore((s) => s.hostContext);
  const scenario = useStudioStore((s) => s.scenario);
  const setHostContext = useStudioStore((s) => s.setHostContext);
  const setScenario = useStudioStore((s) => s.setScenario);

  return (
    <div className="controls">
      <label className="control">
        Scenario
        <select value={scenario} onChange={(e) => setScenario(e.target.value as ScenarioId)}>
          <option value="default">default</option>
          <option value="loading">loading</option>
          <option value="error">error</option>
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
