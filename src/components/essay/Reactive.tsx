import { useEssayState } from './EssayContext';

export function Reactive({
  derive,
  minWidth,
}: {
  derive: (get: (name: string) => number) => number | string;
  minWidth?: string;
}) {
  const state = useEssayState();
  const isHydrated = Object.keys(state).length > 0;
  const get = (name: string): number => {
    if (!isHydrated) return 0; // SSR placeholder
    if (!(name in state)) {
      throw new Error(
        `Essay variable "${name}" not found in Reactive. Available: ${Object.keys(state).join(', ')}`
      );
    }
    return state[name];
  };
  const result = derive(get);
  const style = minWidth
    ? { display: 'inline-block', minWidth, fontVariantNumeric: 'tabular-nums', textAlign: 'right' }
    : undefined;
  return <span className="essay-reactive" style={style}>{String(result)}</span>;
}
