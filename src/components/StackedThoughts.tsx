import { useState, useEffect, useRef, useCallback } from 'react';
import type { ThoughtGraph, BacklinkEntry } from '../lib/types';
import { fetchThought } from '../lib/thoughts';
import ThoughtPane from './ThoughtPane';

interface Pane {
  slug: string;
  title: string;
  html: string;
  backlinks: BacklinkEntry[];
}

interface StackedThoughtsProps {
  initialSlug: string;
  initialHtml: string;
  initialTitle: string;
  initialBacklinks: BacklinkEntry[];
  graph: ThoughtGraph;
}

export default function StackedThoughts({
  initialSlug,
  initialHtml,
  initialTitle,
  initialBacklinks,
  graph,
}: StackedThoughtsProps) {
  const [panes, setPanes] = useState<Pane[]>([
    { slug: initialSlug, title: initialTitle, html: initialHtml, backlinks: initialBacklinks },
  ]);
  const containerRef = useRef<HTMLDivElement>(null);
  const [scrollTarget, setScrollTarget] = useState<number | null>(null);
  const initializedRef = useRef(false);

  // On mount: restore stacked panes from URL
  useEffect(() => {
    if (initializedRef.current) return;
    initializedRef.current = true;

    const params = new URLSearchParams(window.location.search);
    const stackedSlugs = params.getAll('stacked');
    if (stackedSlugs.length === 0) return;

    const validSlugs = stackedSlugs.filter((s) => s in graph);
    if (validSlugs.length === 0) return;

    Promise.all(validSlugs.map(fetchThought)).then((thoughts) => {
      setPanes((prev) => [...prev, ...thoughts]);
    });
  }, [graph]);

  // Sync URL when panes change
  useEffect(() => {
    const stackedSlugs = panes.slice(1).map((p) => p.slug);
    const url = new URL(window.location.href);
    url.searchParams.delete('stacked');
    stackedSlugs.forEach((s) => url.searchParams.append('stacked', s));
    history.replaceState(null, '', url.toString());
  }, [panes]);

  // Scroll to newly added pane
  useEffect(() => {
    if (scrollTarget === null || !containerRef.current) return;
    const paneEls = containerRef.current.querySelectorAll('.thought-pane');
    const target = paneEls[scrollTarget] as HTMLElement | undefined;
    if (target) {
      target.scrollIntoView({ behavior: 'smooth', inline: 'start', block: 'nearest' });
    }
    setScrollTarget(null);
  }, [scrollTarget]);

  const openThought = useCallback(
    async (slug: string, fromPaneIndex: number) => {
      // Already the next pane? Just scroll to it.
      if (panes[fromPaneIndex + 1]?.slug === slug) {
        setScrollTarget(fromPaneIndex + 1);
        return;
      }

      const thought = await fetchThought(slug);
      setPanes((prev) => {
        const truncated = prev.slice(0, fromPaneIndex + 1);
        return [...truncated, thought];
      });
      setScrollTarget(fromPaneIndex + 1);
    },
    [panes],
  );

  const closePane = useCallback((index: number) => {
    setPanes((prev) => prev.filter((_, i) => i !== index));
  }, []);

  // Mobile back: pop the last pane
  const goBack = useCallback(() => {
    setPanes((prev) => (prev.length > 1 ? prev.slice(0, -1) : prev));
  }, []);

  // Event delegation: intercept internal link clicks
  const handleContainerClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const anchor = (e.target as HTMLElement).closest('a');
      if (!anchor) return;

      const href = anchor.getAttribute('href');
      if (!href || !href.startsWith('/thoughts/')) return;

      const slug = href.replace(/^\/thoughts\//, '').replace(/\/$/, '');
      if (!(slug in graph)) return; // Not a known thought — let browser navigate

      e.preventDefault();

      // Determine which pane the click came from
      const paneEl = anchor.closest<HTMLElement>('.thought-pane');
      let fromIndex = 0;
      if (paneEl && containerRef.current) {
        const paneEls = Array.from(containerRef.current.querySelectorAll('.thought-pane'));
        const idx = paneEls.indexOf(paneEl);
        if (idx >= 0) fromIndex = idx;
      }

      openThought(slug, fromIndex);
    },
    [graph, openThought],
  );

  // Determine which panes are collapsed (all except last 2 visible ones on desktop)
  const [collapsedSet, setCollapsedSet] = useState<Set<number>>(new Set());

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (window.innerWidth < 768) {
      setCollapsedSet(new Set());
      return;
    }

    const container = containerRef.current;
    if (!container) return;

    const updateCollapsed = () => {
      const scrollLeft = container.scrollLeft;
      const newCollapsed = new Set<number>();

      const paneEls = container.querySelectorAll('.thought-pane');
      paneEls.forEach((el, i) => {
        const pane = el as HTMLElement;
        const paneRight = pane.offsetLeft + pane.offsetWidth;
        // Collapse if the pane's right edge is scrolled off to the left
        // (leaving room for the 40px collapsed strip)
        if (paneRight < scrollLeft + 60 && i < panes.length - 1) {
          newCollapsed.add(i);
        }
      });

      setCollapsedSet(newCollapsed);
    };

    container.addEventListener('scroll', updateCollapsed, { passive: true });
    updateCollapsed();
    return () => container.removeEventListener('scroll', updateCollapsed);
  }, [panes.length]);

  // Mobile: only show the last pane
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
  const visiblePanes = isMobile ? [panes[panes.length - 1]] : panes;
  const mobileShowBack = isMobile && panes.length > 1;

  // Ghost backlinks from the last pane
  const lastPane = panes[panes.length - 1];
  const ghostBacklinks = lastPane.backlinks;

  // Single-pane mode only when no ghost backlinks exist
  const isSinglePane = panes.length === 1 && ghostBacklinks.length === 0;
  const isSinglePaneWithGhosts = panes.length === 1 && ghostBacklinks.length > 0;

  return (
    <div
      className={`stacked-container${isSinglePane ? ' single-pane' : ''}${isSinglePaneWithGhosts ? ' single-pane-with-ghosts' : ''}`}
      ref={containerRef}
      onClick={handleContainerClick}
    >
      {visiblePanes.map((pane, visualIndex) => {
        const realIndex = isMobile ? panes.length - 1 : visualIndex;
        const isCollapsed = collapsedSet.has(realIndex);
        const isLastPane = realIndex === panes.length - 1;

        return (
          <div
            key={`${pane.slug}-${realIndex}`}
            className={`thought-pane${isCollapsed ? ' collapsed' : ''}`}
            style={{ left: `${realIndex * 40}px` }}
            onClick={
              isCollapsed
                ? () => {
                    // Un-collapse: scroll to this pane
                    setScrollTarget(realIndex);
                  }
                : undefined
            }
          >
            <span className="collapsed-title">{pane.title}</span>
            {!isCollapsed && (
              <>
                {mobileShowBack && isLastPane && (
                  <div style={{ padding: '12px 24px 0' }}>
                    <button className="mobile-back" onClick={goBack}>
                      &larr; Back
                    </button>
                  </div>
                )}
                <ThoughtPane
                  slug={pane.slug}
                  title={pane.title}
                  html={pane.html}
                  backlinks={pane.backlinks}
                  isFirst={realIndex === 0}
                  isLastPane={isLastPane}
                  index={realIndex}
                  onClose={() => closePane(realIndex)}
                  onNavigateBacklink={(slug) => openThought(slug, realIndex)}
                />
                {isMobile && isLastPane && pane.backlinks.length > 0 && (
                  <div className="mobile-ghost-backlinks">
                    {pane.backlinks.map((bl) => (
                      <div
                        key={bl.slug}
                        className="mobile-ghost-card"
                        onClick={() => openThought(bl.slug, realIndex)}
                      >
                        <span className="mobile-ghost-title">{bl.title}</span>
                        {bl.context && (
                          <div
                            className="mobile-ghost-context"
                            dangerouslySetInnerHTML={{ __html: bl.context }}
                          />
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        );
      })}
      {!isMobile && ghostBacklinks.length > 0 && (
        <div className="ghost-pane-column">
          {ghostBacklinks.map((bl) => (
            <div
              key={`ghost-${bl.slug}`}
              className="ghost-pane"
              onClick={() => openThought(bl.slug, panes.length - 1)}
            >
              <span className="ghost-pane-title">{bl.title}</span>
              {bl.context && (
                <div
                  className="ghost-pane-context"
                  dangerouslySetInnerHTML={{ __html: bl.context }}
                />
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
