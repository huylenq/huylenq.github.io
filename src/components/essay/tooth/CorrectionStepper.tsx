import { useEssayGet } from '../EssayContext';
import { ProjectionCanvas } from './ProjectionCanvas';

const STEPS = [
  { projection: 'xy' as const, label: 'Step 1: Z-axis', desc: 'X-Y projection' },
  { projection: 'yz' as const, label: 'Step 2: X-axis', desc: 'Y-Z projection' },
  { projection: 'xz' as const, label: 'Step 3: Y-axis', desc: 'X-Z projection' },
];

export function CorrectionStepper() {
  const step = useEssayGet('step');

  return (
    <div className="essay-stepper">
      {STEPS.map((s, i) => (
        <div key={s.projection} className="essay-stepper-panel">
          <span className="essay-stepper-label">{s.label}</span>
          <ProjectionCanvas projection={s.projection} dimmed={i >= step} />
          {i < STEPS.length - 1 && <span className="essay-stepper-arrow">→</span>}
        </div>
      ))}
    </div>
  );
}
