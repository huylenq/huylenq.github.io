import { useEffect, useRef, useState } from 'react';
import type { BacklinkEntry } from '../lib/types';
import Backlinks from './Backlinks';

interface ThoughtPaneProps {
  slug: string;
  title: string;
  html: string;
  backlinks: BacklinkEntry[];
  isFirst: boolean;
  index: number;
  onClose: () => void;
  onNavigateBacklink: (slug: string) => void;
}

export default function ThoughtPane({
  title,
  html,
  backlinks,
  isFirst,
  onClose,
  onNavigateBacklink,
}: ThoughtPaneProps) {
  const [scrolled, setScrolled] = useState(false);
  const headerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // The scrolling container is the parent .thought-pane div
    const scrollContainer = headerRef.current?.closest('.thought-pane');
    if (!scrollContainer) return;

    const onScroll = () => setScrolled(scrollContainer.scrollTop > 0);
    scrollContainer.addEventListener('scroll', onScroll, { passive: true });
    return () => scrollContainer.removeEventListener('scroll', onScroll);
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
        <Backlinks backlinks={backlinks} onNavigate={onNavigateBacklink} />
      </div>
    </>
  );
}
