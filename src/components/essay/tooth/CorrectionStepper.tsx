import { useEssayVar } from '../EssayContext';
import { ProjectionCanvas } from './ProjectionCanvas';

const STEPS = [
  { label: 'Original', projection: null, stepLabel: null },
  { label: 'Z-axis (1)', projection: 'xy' as const, stepLabel: 'Step 1-1: Z-axis' },
  { label: 'Z-axis (2)', projection: 'xy' as const, stepLabel: 'Step 1-2: Z-axis' },
  { label: 'X-axis', projection: 'yz' as const, stepLabel: 'Step 2: X-axis' },
  { label: 'Y-axis', projection: 'xz' as const, stepLabel: 'Step 3: Y-axis' },
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
          <div key={i} className={`essay-stepper-panel${i + 1 > step ? ' essay-stepper-panel-dimmed' : ''}`}>
            <span className="essay-stepper-label">{s.stepLabel}</span>
            <ProjectionCanvas projection={s.projection!} dimmed={i + 1 > step} intense />
          </div>
        ))}
      </div>
    </div>
  );
}
