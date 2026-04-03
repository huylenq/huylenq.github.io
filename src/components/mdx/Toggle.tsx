import { useEssayVar } from './EssayContext';

export function Toggle({
  name,
  labels = ['Off', 'On'],
}: {
  name: string;
  labels?: [string, string];
}) {
  const [value, setValue] = useEssayVar(name);
  const isOn = value !== 0;
  return (
    <button
      className={`essay-toggle ${isOn ? 'essay-toggle-on' : ''}`}
      onClick={() => setValue(isOn ? 0 : 1)}
      type="button"
    >
      {isOn ? labels[1] : labels[0]}
    </button>
  );
}
