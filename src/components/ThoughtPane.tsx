import { useEffect, useRef, useState } from 'react';
import type { BacklinkEntry } from '../lib/types';

interface ThoughtPaneProps {
  slug: string;
  title: string;
  html: string;
  backlinks: BacklinkEntry[];
  isFirst: boolean;
  index: number;
  onClose: () => void;
}

export default function ThoughtPane({
  title,
  html,
  isFirst,
  onClose,
}: ThoughtPaneProps) {
  const [scrolled, setScrolled] = useState(false);
  const [canScrollDown, setCanScrollDown] = useState(false);
  const headerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const scrollContainer = headerRef.current?.closest('.thought-pane') as HTMLElement | null;
    if (!scrollContainer) return;

    const updateScrollState = () => {
      const { scrollTop, scrollHeight, clientHeight } = scrollContainer;
      setScrolled(scrollTop > 0);
      setCanScrollDown(scrollHeight - scrollTop - clientHeight > 1);
    };

    scrollContainer.addEventListener('scroll', updateScrollState, { passive: true });
    updateScrollState();
    return () => scrollContainer.removeEventListener('scroll', updateScrollState);
  }, []);

  return (
    <>
      <div className={`thought-pane-header${scrolled ? ' scrolled' : ''}`} ref={headerRef}>
        <span className="thought-pane-title">{title}</span>
        {!isFirst && (
          <button
            className="thought-pane-close"
            onClick={onClose}
            aria-label="Close pane"
          >
            &times;
          </button>
        )}
      </div>
      <div className="thought-pane-body">
        <div
          className="thought-content"
          dangerouslySetInnerHTML={{ __html: html }}
        />
      </div>
      <div className={`thought-pane-fade thought-pane-fade--bottom${canScrollDown ? ' visible' : ''}`} />
    </>
  );
}
