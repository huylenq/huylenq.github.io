import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';

type EssayState = Record<string, number>;
type EssayContextValue = {
  state: EssayState;
  set: (name: string, value: number) => void;
};

const EssayContext = createContext<EssayContextValue | null>(null);

export function EssayProvider({
  initialState,
  children,
}: {
  initialState: EssayState;
  children: ReactNode;
}) {
  const [state, setState] = useState(initialState);

  const set = useCallback(
    (name: string, value: number) => {
      if (!(name in initialState)) {
        throw new Error(
          `Essay variable "${name}" not declared in initialState. ` +
            `Available: ${Object.keys(initialState).join(', ')}`
        );
      }
      setState((prev) => ({ ...prev, [name]: value }));
    },
    [initialState]
  );

  return (
    <EssayContext.Provider value={{ state, set }}>
      {children}
    </EssayContext.Provider>
  );
}

function useEssayContext(): EssayContextValue | null {
  return useContext(EssayContext);
}

export function useEssayVar(name: string): [number, (v: number) => void] {
  const ctx = useEssayContext();
  // During SSR, context is null — return 0 + noop. Hydration will fix it.
  if (!ctx) return [0, () => {}];
  if (!(name in ctx.state)) {
    throw new Error(
      `Essay variable "${name}" not found. Available: ${Object.keys(ctx.state).join(', ')}`
    );
  }
  return [ctx.state[name], (v: number) => ctx.set(name, v)];
}

export function useEssayGet(name: string): number {
  const ctx = useEssayContext();
  if (!ctx) return 0;
  if (!(name in ctx.state)) {
    throw new Error(
      `Essay variable "${name}" not found. Available: ${Object.keys(ctx.state).join(', ')}`
    );
  }
  return ctx.state[name];
}

export function useEssayState(): EssayState {
  const ctx = useEssayContext();
  if (!ctx) return {};
  return ctx.state;
}
