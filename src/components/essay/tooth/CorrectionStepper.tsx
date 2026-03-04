import { useEssayVar } from '../EssayContext';
import { ProjectionCanvas } from './ProjectionCanvas';

const STEPS = [
  {
    label: 'Original',
    projection: null,
    stepNum: null,
    stepAxis: null,
    description: 'Răng nghiêng trong không gian 3D. Chưa có hiệu chỉnh nào được áp dụng.',
  },
  {
    label: 'Z-axis (1)',
    projection: 'xy' as const,
    stepNum: 'Step 1-1',
    stepAxis: 'Z-axis',
    description:
      'Chiếu lên mặt phẳng X-Y. Tìm reference point A và B trên convex hull. Xoay quanh trục Z để căn A\u2013B theo phương ngang.',
  },
  {
    label: 'Z-axis (2)',
    projection: 'xy' as const,
    stepNum: 'Step 1-2',
    stepAxis: 'Z-axis',
    description:
      'Chiếu lại lên X-Y sau lần xoay Z đầu. Phép xoay 3D thay đổi các điểm trên hull boundary, lộ ra góc lệch dư. Lần xoay Z thứ hai hiệu chỉnh phần dư này.',
  },
  {
    label: 'X-axis',
    projection: 'yz' as const,
    stepNum: 'Step 2',
    stepAxis: 'X-axis',
    description:
      'Chiếu lên mặt phẳng Y-Z sau cả hai lần xoay Z. Tìm A và B, xoay quanh trục X để chỉnh độ nghiêng ngang.',
  },
  {
    label: 'Y-axis',
    projection: 'xz' as const,
    stepNum: 'Step 3',
    stepAxis: 'Y-axis',
    description:
      'Chiếu lên mặt phẳng X-Z sau các hiệu chỉnh Z và X. Tìm A và B, xoay quanh trục Y để chỉnh độ nghiêng trước-sau còn lại.',
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
                <ProjectionCanvas projection={s.projection!} step={i} ghostStep={i} ghostOnly intense />
              ) : null}
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
