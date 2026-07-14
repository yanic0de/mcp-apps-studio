import { Canvas } from './components/Canvas.js';
import { HeaderControls } from './components/HeaderControls.js';
import { TracePanel } from './components/TracePanel.js';

export function App() {
  return (
    <div className="app">
      <header className="header">
        <span className="brand">
          MCP Apps <em>Studio</em>
        </span>
        <HeaderControls />
      </header>
      <Canvas />
      <TracePanel />
    </div>
  );
}
