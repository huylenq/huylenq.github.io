import { useEssayVar } from '../mdx/EssayContext';
import { ProjectionCanvas } from './ProjectionCanvas';

const STEPS = [
  {
    label: 'Original',
    projection: null,
    stepNum: null,
    stepAxis: null,
    description: 'Tooth tilted in 3D space. No corrections applied yet.',
  },
  {
    label: 'Z-axis (1)',
    projection: 'xy' as const,
    stepNum: 'Step 1-1',
    stepAxis: 'Z-axis',
    description:
      'Project onto the X-Y plane. Find reference points A and B on the convex hull. Rotate around the Z-axis to align A\u2013B horizontally.',
  },
  {
    label: 'Z-axis (2)',
    projection: 'xy' as const,
    stepNum: 'Step 1-2',
    stepAxis: 'Z-axis',
    description:
      'Re-project onto X-Y after the first Z rotation. The 3D rotation shifts points on the hull boundary, exposing a residual angular error. The second Z rotation corrects this remainder.',
  },
  {
    label: 'X-axis',
    projection: 'yz' as const,
    stepNum: 'Step 2',
    stepAxis: 'X-axis',
    description:
      'Project onto the Y-Z plane after both Z rotations. Find A and B, rotate around the X-axis to correct the lateral tilt.',
  },
  {
    label: 'Y-axis',
    projection: 'xz' as const,
    stepNum: 'Step 3',
    stepAxis: 'Y-axis',
    description:
      'Project onto the X-Z plane after the Z and X corrections. Find A and B, rotate around the Y-axis to correct the remaining anterior-posterior tilt.',
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
        <div
          className={`essay-stepper-panel${step === 0 ? ' essay-stepper-panel-active' : ''}`}
          onClick={() => setStep(0)}
        >
          <span className="essay-stepper-label">Original</span>
          <ProjectionCanvas projection="xy" step={0} intense showRef={false} />
        </div>
        <div className="essay-stepper-separator" />
        {PROJECTIONS.map((s, i) => {
          const stepIdx = i + 1;
          const isNext = stepIdx === step + 1;
          const isActive = stepIdx === step;
          const isPast = stepIdx < step;
          const isFuture = stepIdx > step + 1;
          return (
            <div
              key={i}
              className={`essay-stepper-panel${isActive ? ' essay-stepper-panel-active' : ''}${isFuture ? ' essay-stepper-panel-future' : ''}`}
              onClick={() => setStep(stepIdx)}
            >
              <span className="essay-stepper-label">{s.stepNum}</span>
              {isPast || isActive ? (
                <ProjectionCanvas projection={s.projection!} step={stepIdx} ghostStep={i} intense />
              ) : isNext ? (
                <ProjectionCanvas projection={s.projection!} step={step} refOnSettle />
              ) : (
                <ProjectionCanvas projection={s.projection!} step={step} showRef={false} />
              )}
            </div>
          );
        })}
      </div>
      <div className="essay-stepper-description-wrapper">
        {STEPS.map((s, i) => (
          <p key={i} className={`essay-stepper-description${i === step ? '' : ' essay-stepper-description-hidden'}`}>
            {s.description}
          </p>
        ))}
      </div>
    </div>
  );
}
