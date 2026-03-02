import { useState, useEffect, useLayoutEffect, useRef, useCallback } from 'react';
import type { ThoughtGraph, BacklinkEntry, ThoughtApiResponse } from '../lib/types';
import { fetchThought } from '../lib/thoughts';
import ThoughtPane from './ThoughtPane';

interface Pane {
  slug: string;
  title: string;
  html: string;
  backlinks: BacklinkEntry[];
}

interface ForwardGhost {
  slug: string;
  thought: ThoughtApiResponse | null; // null while loading
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
  const prevPaneCountRef = useRef(1);
  const firstPaneStartLeft = useRef<number | null>(null);
  const initialPaneSlugs = useRef(new Set([initialSlug]));

  // On mount: restore stacked panes from URL (desktop only)
  useEffect(() => {
    if (initializedRef.current) return;
    initializedRef.current = true;
    if (window.innerWidth < 768) return;

    const params = new URLSearchParams(window.location.search);
    const stackedSlugs = params.getAll('stacked');
    if (stackedSlugs.length === 0) return;

    const validSlugs = stackedSlugs.filter((s) => s in graph);
    if (validSlugs.length === 0) return;

    validSlugs.forEach((s) => initialPaneSlugs.current.add(s));
    Promise.all(validSlugs.map(fetchThought)).then((thoughts) => {
      setPanes((prev) => [...prev, ...thoughts]);
    });
  }, [graph]);

  // Animate first pane sliding (open: left, close: right to center) — FLIP technique
  // useLayoutEffect runs after React commits DOM but before paint, so width/tilt/padding
  // changes from class swaps are already applied invisibly — we only animate position.
  useLayoutEffect(() => {
    const prevCount = prevPaneCountRef.current;
    prevPaneCountRef.current = panes.length;
    const startLeft = firstPaneStartLeft.current;

    const isOpening = prevCount === 1 && panes.length > 1;
    const isClosingToSingle = prevCount === 2 && panes.length === 1;

    if ((isOpening || isClosingToSingle) && startLeft !== null && containerRef.current) {
      firstPaneStartLeft.current = null;
      const firstPane = containerRef.current.querySelector('.thought-pane') as HTMLElement;
      if (!firstPane) return;

      const containerRect = containerRef.current.getBoundingClientRect();
      const currentLeft = firstPane.getBoundingClientRect().left - containerRect.left;
      const deltaX = startLeft - currentLeft;

      if (Math.abs(deltaX) < 1) return;

      // Pin pane at old position (transition:none so CSS class changes stay invisible)
      firstPane.style.transition = 'none';
      firstPane.style.transform = `translateX(${deltaX}px)`;

      requestAnimationFrame(() => {
        firstPane.style.transition = 'transform 0.25s ease';
        firstPane.style.transform = '';

        const cleanup = () => {
          firstPane.style.transition = '';
          firstPane.removeEventListener('transitionend', cleanup);
        };
        firstPane.addEventListener('transitionend', cleanup);
      });
    }
  }, [panes.length]);

  // Sync URL when panes change (desktop only)
  useEffect(() => {
    if (typeof window !== 'undefined' && window.innerWidth < 768) return;
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

      // Snapshot first pane position before re-render (for slide animation)
      if (panes.length === 1 && containerRef.current) {
        const firstPane = containerRef.current.querySelector('.thought-pane') as HTMLElement;
        if (firstPane) {
          const containerRect = containerRef.current.getBoundingClientRect();
          const paneRect = firstPane.getBoundingClientRect();
          firstPaneStartLeft.current = paneRect.left - containerRect.left;
        }
      }

      try {
        const thought = await fetchThought(slug);
        setPanes((prev) => {
          const truncated = prev.slice(0, fromPaneIndex + 1);
          return [...truncated, thought];
        });
        setScrollTarget(fromPaneIndex + 1);
      } catch (err) {
        console.error('[StackedThoughts] Failed to open thought:', slug, err);
      }
    },
    [panes],
  );

  const closePane = useCallback(
    (index: number) => {
      const containerEl = containerRef.current;
      const paneEls = containerEl?.querySelectorAll('.thought-pane');
      const closingEl = paneEls?.[index] as HTMLElement | undefined;

      if (!closingEl) {
        setPanes((prev) => prev.filter((_, i) => i !== index));
        return;
      }

      // Snapshot first pane position for reverse FLIP in useLayoutEffect
      if (panes.length === 2 && containerEl) {
        const firstPaneEl = paneEls![0] as HTMLElement;
        const containerRect = containerEl.getBoundingClientRect();
        firstPaneStartLeft.current = firstPaneEl.getBoundingClientRect().left - containerRect.left;
      }

      closingEl.classList.add('closing');
      setTimeout(() => {
        setPanes((prev) => prev.filter((_, i) => i !== index));
      }, 200);
    },
    [panes.length],
  );

  // Event delegation: intercept internal link clicks
  const handleContainerClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const anchor = (e.target as HTMLElement).closest('a');
      if (!anchor) return;
      if (window.innerWidth < 768) return; // let browser navigate

      const href = anchor.getAttribute('href');
      if (!href || !href.startsWith('/thoughts/')) return;

      const slug = href.replace(/^\/thoughts\//, '').replace(/\/$/, '');
      if (!(slug in graph)) return; // Not a known thought — let browser navigate

      e.preventDefault();

      // Clear pending hover timeout so the ghost doesn't reappear after click
      if (hoverTimeoutRef.current) {
        clearTimeout(hoverTimeoutRef.current);
        hoverTimeoutRef.current = null;
      }
      setForwardGhost(null);

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

  // Mobile: only show the last pane (determined after mount to avoid hydration mismatch)
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    setIsMobile(window.innerWidth < 768);
  }, []);
  const visiblePanes = isMobile ? [panes[panes.length - 1]] : panes;
  // Ghost backlinks from the last pane
  const lastPane = panes[panes.length - 1];
  const ghostBacklinks = lastPane.backlinks;

  // Forward ghost pane — shown on hover over a forward link
  const [forwardGhost, setForwardGhost] = useState<ForwardGhost | null>(null);
  const forwardGhostFetchRef = useRef<AbortController | null>(null);
  const forwardGhostCache = useRef<Map<string, ThoughtApiResponse>>(new Map());
  const hoverTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showForwardGhost = useCallback(
    (slug: string) => {
      // Check cache first
      const cached = forwardGhostCache.current.get(slug);
      if (cached) {
        // Avoid re-render if already showing this slug
        setForwardGhost((prev) => (prev?.slug === slug && prev.thought === cached ? prev : { slug, thought: cached }));
        return;
      }

      // Show ghost immediately (loading state), then fetch
      setForwardGhost((prev) => (prev?.slug === slug ? prev : { slug, thought: null }));

      forwardGhostFetchRef.current?.abort();
      const controller = new AbortController();
      forwardGhostFetchRef.current = controller;

      fetchThought(slug).then((thought) => {
        if (controller.signal.aborted) return;
        forwardGhostCache.current.set(slug, thought);
        setForwardGhost((prev) => (prev?.slug === slug ? { ...prev, thought } : prev));
      }).catch(() => {
        if (!controller.signal.aborted) {
          setForwardGhost((prev) => (prev?.slug === slug ? null : prev));
        }
      });
    },
    [],
  );

  const hideTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const hideForwardGhost = useCallback(() => {
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
      hoverTimeoutRef.current = null;
    }
    // Small delay so the user can cross the gap between pane edge and ghost
    hideTimeoutRef.current = setTimeout(() => {
      forwardGhostFetchRef.current?.abort();
      setForwardGhost(null);
    }, 100);
  }, []);

  const cancelHideForwardGhost = useCallback(() => {
    if (hideTimeoutRef.current) {
      clearTimeout(hideTimeoutRef.current);
      hideTimeoutRef.current = null;
    }
  }, []);

  // Event delegation for hover on forward links
  const handleContainerMouseOver = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (isMobile) return;
      const anchor = (e.target as HTMLElement).closest('a');
      if (!anchor) return;

      const href = anchor.getAttribute('href');
      if (!href || !href.startsWith('/thoughts/')) return;

      const slug = href.replace(/^\/thoughts\//, '').replace(/\/$/, '');
      if (!(slug in graph)) return;

      // Don't show ghost if this slug is already open as the next pane
      const paneEl = anchor.closest<HTMLElement>('.thought-pane');
      if (paneEl && containerRef.current) {
        const paneEls = Array.from(containerRef.current.querySelectorAll('.thought-pane'));
        const idx = paneEls.indexOf(paneEl);
        if (idx >= 0 && panes[idx + 1]?.slug === slug) return;
      }

      // Cancel any pending hide
      cancelHideForwardGhost();

      // Debounce slightly to avoid flicker on fast mouse moves
      if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
      hoverTimeoutRef.current = setTimeout(() => {
        showForwardGhost(slug);
      }, 80);
    },
    [graph, panes, isMobile, showForwardGhost, cancelHideForwardGhost],
  );

  const handleContainerMouseOut = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const anchor = (e.target as HTMLElement).closest('a');
      if (!anchor) return;

      const href = anchor.getAttribute('href');
      if (!href || !href.startsWith('/thoughts/')) return;

      const related = e.relatedTarget as HTMLElement | null;
      // Still inside the same link (moved between child elements) — ignore
      if (related && anchor.contains(related)) return;
      // Moving to the ghost pane itself — keep it visible
      if (related?.closest('.forward-ghost-pane')) return;

      hideForwardGhost();
    },
    [hideForwardGhost],
  );

  const hasGhostColumn = ghostBacklinks.length > 0 || !!forwardGhost;

  // FLIP animation for backward ghost panes when forward ghost appears/disappears
  const ghostColumnRef = useRef<HTMLDivElement>(null);
  const backwardGhostPositions = useRef<Map<string, number>>(new Map());
  const prevForwardGhostSlug = useRef<string | null>(null);

  // Snapshot backward ghost positions after each paint — ready for the NEXT render's FLIP
  useEffect(() => {
    const col = ghostColumnRef.current;
    if (!col) return;
    const ghosts = col.querySelectorAll<HTMLElement>('.ghost-pane:not(.forward-ghost-pane)');
    const positions = new Map<string, number>();
    ghosts.forEach((el) => {
      const key = el.dataset.ghostSlug;
      if (key) positions.set(key, el.getBoundingClientRect().top);
    });
    backwardGhostPositions.current = positions;
  });

  // After DOM update: FLIP animate backward ghosts if forwardGhost toggled on/off
  useLayoutEffect(() => {
    const prevSlug = prevForwardGhostSlug.current;
    const curSlug = forwardGhost?.slug ?? null;
    prevForwardGhostSlug.current = curSlug;

    // Only animate when forward ghost appears or disappears (not slug changes)
    const wasVisible = prevSlug !== null;
    const isVisible = curSlug !== null;
    if (wasVisible === isVisible) return;

    const col = ghostColumnRef.current;
    if (!col) return;

    const oldPositions = backwardGhostPositions.current;
    if (oldPositions.size === 0) return;

    const ghosts = col.querySelectorAll<HTMLElement>('.ghost-pane:not(.forward-ghost-pane)');
    ghosts.forEach((el) => {
      const key = el.dataset.ghostSlug;
      if (!key) return;
      const oldTop = oldPositions.get(key);
      if (oldTop === undefined) return;

      const newTop = el.getBoundingClientRect().top;
      const deltaY = oldTop - newTop;
      if (Math.abs(deltaY) < 1) return;

      el.style.transition = 'none';
      el.style.transform = `translateY(${deltaY}px)`;

      requestAnimationFrame(() => {
        el.style.transition = 'transform 0.2s ease';
        el.style.transform = '';
        const cleanup = () => {
          el.style.transition = '';
          el.removeEventListener('transitionend', cleanup);
        };
        el.addEventListener('transitionend', cleanup);
      });
    });
  }, [forwardGhost]);

  // Stabilize scroll position when ghost column appears/disappears
  // (prevents horizontal scroll jump when column is added/removed from flex layout)
  const prevHasGhostColumn = useRef(hasGhostColumn);
  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const wasVisible = prevHasGhostColumn.current;
    prevHasGhostColumn.current = hasGhostColumn;
    if (wasVisible !== hasGhostColumn) {
      // Pin scrollLeft — the column change may have shifted scrollWidth
      container.scrollLeft = container.scrollLeft;
    }
  }, [hasGhostColumn]);

  // Single-pane mode only when no ghost column content exists
  const isSinglePane = panes.length === 1 && !hasGhostColumn;
  const isSinglePaneWithGhosts = panes.length === 1 && hasGhostColumn;

  return (
    <div
      className={`stacked-container${isSinglePane ? ' single-pane' : ''}${isSinglePaneWithGhosts ? ' single-pane-with-ghosts' : ''}`}
      ref={containerRef}
      onClick={handleContainerClick}
      onMouseOver={handleContainerMouseOver}
      onMouseOut={handleContainerMouseOut}
    >
      {visiblePanes.map((pane, visualIndex) => {
        const realIndex = isMobile ? panes.length - 1 : visualIndex;
        const isCollapsed = collapsedSet.has(realIndex);
        const isLastPane = realIndex === panes.length - 1;

        return (
          <div
            key={pane.slug}
            className={`thought-pane${isCollapsed ? ' collapsed' : ''}${!initialPaneSlugs.current.has(pane.slug) ? ' animate-in' : ''}`}
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
              </>
            )}
          </div>
        );
      })}
      {!isMobile && hasGhostColumn && (
        <div className="ghost-pane-column"
          ref={ghostColumnRef}
          onMouseEnter={cancelHideForwardGhost}
          onMouseLeave={() => { if (forwardGhost) hideForwardGhost(); }}
        >
          {forwardGhost && (
            <div
              className="ghost-pane forward-ghost-pane"
              onClick={() => {
                const slug = forwardGhost.slug;
                // Find which pane contains the link to this slug
                const paneEl = containerRef.current?.querySelector(
                  `.thought-pane:has(a[href="/thoughts/${slug}"])`,
                );
                let fromIndex = panes.length - 1;
                if (paneEl && containerRef.current) {
                  const paneEls = Array.from(containerRef.current.querySelectorAll('.thought-pane'));
                  const idx = paneEls.indexOf(paneEl);
                  if (idx >= 0) fromIndex = idx;
                }
                hideForwardGhost();
                openThought(slug, fromIndex);
              }}
            >
              {forwardGhost.thought ? (
                <>
                  <span className="ghost-pane-title">{forwardGhost.thought.title}</span>
                  <div
                    className="ghost-pane-context forward-ghost-content"
                    dangerouslySetInnerHTML={{ __html: forwardGhost.thought.html }}
                  />
                </>
              ) : (
                <span className="ghost-pane-title" style={{ fontStyle: 'italic', color: 'var(--ink-light)' }}>Loading…</span>
              )}
            </div>
          )}
          {ghostBacklinks.map((bl) => (
            <div
              key={`ghost-${bl.slug}`}
              className="ghost-pane"
              data-ghost-slug={bl.slug}
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
