import { useEssayVar } from '../EssayContext';
import { ProjectionCanvas } from './ProjectionCanvas';

const STEPS = [
  {
    label: 'Original',
    projection: null,
    stepLabel: null,
    description: 'The tooth is tilted in 3D space. No corrections have been applied yet.',
  },
  {
    label: 'Z-axis (1)',
    projection: 'xy' as const,
    stepLabel: 'Step 1-1: Z-axis',
    description:
      'Project onto the X-Y plane. Find reference points A and B on the convex hull, then rotate around the Z-axis to align A\u2013B with the horizontal axis.',
  },
  {
    label: 'Z-axis (2)',
    projection: 'xy' as const,
    stepLabel: 'Step 1-2: Z-axis',
    description:
      'Re-project onto X-Y after the first correction. The hull shape has changed, so a second Z-axis pass refines the residual rotation.',
  },
  {
    label: 'X-axis',
    projection: 'yz' as const,
    stepLabel: 'Step 2: X-axis',
    description:
      'Project onto the Y-Z plane. Rotate around the X-axis to correct the tooth\u2019s lateral tilt.',
  },
  {
    label: 'Y-axis',
    projection: 'xz' as const,
    stepLabel: 'Step 3: Y-axis',
    description:
      'Project onto the X-Z plane. Rotate around the Y-axis to correct the remaining front-to-back tilt.',
  },
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
        {PROJECTIONS.map((s, i) => {
          const isActive = i + 1 === step;
          const isFuture = i + 1 > Math.max(step, 1);
          const isDimmed = step === 0 && i === 0;
          return (
            <div
              key={i}
              className={`essay-stepper-panel${isActive ? ' essay-stepper-panel-active' : ''}${isFuture ? ' essay-stepper-panel-future' : ''}${isDimmed ? ' essay-stepper-panel-dimmed' : ''}`}
            >
              <span className="essay-stepper-label">{s.stepLabel}</span>
              <ProjectionCanvas projection={s.projection!} dimmed={isFuture || isDimmed} intense />
            </div>
          );
        })}
      </div>
      <p className="essay-stepper-description">{STEPS[step]?.description}</p>
    </div>
  );
}
