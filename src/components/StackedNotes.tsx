import { useState, useEffect, useRef, useCallback } from 'react';
import type { NoteGraph, BacklinkEntry } from '../lib/types';
import { fetchNote } from '../lib/notes';
import NotePane from './NotePane';

interface Pane {
  slug: string;
  title: string;
  html: string;
  backlinks: BacklinkEntry[];
}

interface StackedNotesProps {
  initialSlug: string;
  initialHtml: string;
  initialTitle: string;
  initialBacklinks: BacklinkEntry[];
  graph: NoteGraph;
}

export default function StackedNotes({
  initialSlug,
  initialHtml,
  initialTitle,
  initialBacklinks,
  graph,
}: StackedNotesProps) {
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

    Promise.all(validSlugs.map(fetchNote)).then((notes) => {
      setPanes((prev) => [...prev, ...notes]);
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
    const paneEls = containerRef.current.querySelectorAll('.note-pane');
    const target = paneEls[scrollTarget] as HTMLElement | undefined;
    if (target) {
      target.scrollIntoView({ behavior: 'smooth', inline: 'start', block: 'nearest' });
    }
    setScrollTarget(null);
  }, [scrollTarget]);

  const openNote = useCallback(
    async (slug: string, fromPaneIndex: number) => {
      // Already the next pane? Just scroll to it.
      if (panes[fromPaneIndex + 1]?.slug === slug) {
        setScrollTarget(fromPaneIndex + 1);
        return;
      }

      const note = await fetchNote(slug);
      setPanes((prev) => {
        const truncated = prev.slice(0, fromPaneIndex + 1);
        return [...truncated, note];
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
      if (!href || !href.startsWith('/')) return;

      const slug = href.replace(/^\//, '').replace(/\/$/, '');
      if (!(slug in graph)) return; // Not a known note — let browser navigate

      e.preventDefault();

      // Determine which pane the click came from
      const paneEl = anchor.closest<HTMLElement>('.note-pane');
      let fromIndex = 0;
      if (paneEl && containerRef.current) {
        const paneEls = Array.from(containerRef.current.querySelectorAll('.note-pane'));
        const idx = paneEls.indexOf(paneEl);
        if (idx >= 0) fromIndex = idx;
      }

      openNote(slug, fromIndex);
    },
    [graph, openNote],
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
      const viewportWidth = container.clientWidth;
      const newCollapsed = new Set<number>();

      const paneEls = container.querySelectorAll('.note-pane');
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

  return (
    <div
      className={`stacked-container${panes.length === 1 ? ' single-pane' : ''}`}
      ref={containerRef}
      onClick={handleContainerClick}
    >
      {visiblePanes.map((pane, visualIndex) => {
        const realIndex = isMobile ? panes.length - 1 : visualIndex;
        const isCollapsed = collapsedSet.has(realIndex);

        return (
          <div
            key={`${pane.slug}-${realIndex}`}
            className={`note-pane${isCollapsed ? ' collapsed' : ''}`}
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
                {mobileShowBack && realIndex === panes.length - 1 && (
                  <div style={{ padding: '12px 24px 0' }}>
                    <button className="mobile-back" onClick={goBack}>
                      &larr; Back
                    </button>
                  </div>
                )}
                <NotePane
                  slug={pane.slug}
                  title={pane.title}
                  html={pane.html}
                  backlinks={pane.backlinks}
                  isFirst={realIndex === 0}
                  index={realIndex}
                  onClose={() => closePane(realIndex)}
                  onNavigateBacklink={(slug) => openNote(slug, realIndex)}
                />
              </>
            )}
          </div>
        );
      })}
    </div>
  );
}
