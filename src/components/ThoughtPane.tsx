import { useEffect, useRef, useState } from 'react';
import type { BacklinkEntry } from '../lib/types';

interface ThoughtPaneProps {
  slug: string;
  title: string;
  html: string;
  backlinks: BacklinkEntry[];
  isFirst: boolean;
  isLastPane: boolean;
  index: number;
  onClose: () => void;
  onNavigateBacklink: (slug: string) => void;
}

export default function ThoughtPane({
  title,
  html,
  backlinks,
  isFirst,
  isLastPane,
  onClose,
  onNavigateBacklink,
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
        {backlinks.length > 0 && (
          <div className={`pane-backlinks${isLastPane ? ' pane-backlinks--hidden' : ''}`}>
            <h2 className="pane-backlinks-heading">Links to this thought</h2>
            <div className="pane-backlinks-list">
              {backlinks.map((bl) => (
                <a
                  key={bl.slug}
                  href={`/thoughts/${bl.slug}`}
                  className="pane-backlink-card"
                  onClick={(e) => {
                    if (window.innerWidth < 768) return; // let browser navigate
                    e.preventDefault();
                    e.stopPropagation();
                    onNavigateBacklink(bl.slug);
                  }}
                >
                  <span className="pane-backlink-title">{bl.title}</span>
                  {bl.context && (
                    <div
                      className="pane-backlink-context"
                      dangerouslySetInnerHTML={{ __html: bl.context }}
                    />
                  )}
                </a>
              ))}
            </div>
          </div>
        )}
      </div>
      <div className={`thought-pane-fade thought-pane-fade--bottom${canScrollDown ? ' visible' : ''}`} />
    </>
  );
}
