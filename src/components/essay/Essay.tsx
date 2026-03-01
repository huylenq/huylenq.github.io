import type { ReactNode } from 'react';
import { EssayProvider } from './EssayContext';

export function Essay({
  initialState,
  children,
}: {
  initialState: Record<string, number>;
  children: ReactNode;
}) {
  return (
    <EssayProvider initialState={initialState}>
      <article className="note-content">{children}</article>
    </EssayProvider>
  );
}
