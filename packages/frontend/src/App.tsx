import { GraphCanvas } from './components/GraphCanvas';
import { ActivationPanel } from './components/panels';

export function App() {
  return (
    <div className="canvas-container">
      <GraphCanvas />
      <ActivationPanel />
    </div>
  );
}
