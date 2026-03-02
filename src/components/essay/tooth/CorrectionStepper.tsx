import { useEssayVar } from '../EssayContext';
import { ProjectionCanvas } from './ProjectionCanvas';

const STEPS = [
  { label: 'Original', projection: null },
  { label: 'Z-axis', projection: 'xy' as const },
  { label: 'X-axis', projection: 'yz' as const },
  { label: 'Y-axis', projection: 'xz' as const },
] as const;

const PROJECTIONS = STEPS.filter((s) => s.projection !== null);

export function CorrectionStepper() {
  const [step, setStep] = useEssayVar('step');

  return (
    <div className="essay-stepper">
      <div className="stepper-track">
        {STEPS.map((s, i) => (
          <button
            key={i}
            className={`stepper-dot${i === step ? ' stepper-dot-active' : ''}${i < step ? ' stepper-dot-done' : ''}`}
            onClick={() => setStep(i)}
          >
            <span className="stepper-dot-circle">{i}</span>
            <span className="stepper-dot-label">{s.label}</span>
          </button>
        ))}
      </div>
      <div className="essay-stepper-panels">
        {PROJECTIONS.map((s, i) => (
          <div key={s.projection} className="essay-stepper-panel">
            <span className="essay-stepper-label">Step {i + 1}: {s.label}</span>
            <ProjectionCanvas projection={s.projection!} dimmed={i + 1 > step} intense />
          </div>
        ))}
      </div>
    </div>
  );
}
