import { useState, useEffect, useLayoutEffect, useRef, useCallback, useMemo } from 'react';
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
  fromPaneIndex: number;
}

function isOverText(x: number, y: number): boolean {
  const range = document.caretRangeFromPoint(x, y);
  if (!range) return false;
  const node = range.startContainer;
  if (node.nodeType !== Node.TEXT_NODE) return false;
  if (!node.textContent?.trim()) return false;

  const offset = range.startOffset;
  const textLen = node.textContent.length;
  const charRange = document.createRange();
  if (offset < textLen) {
    charRange.setStart(node, offset);
    charRange.setEnd(node, offset + 1);
  } else if (offset > 0) {
    charRange.setStart(node, offset - 1);
    charRange.setEnd(node, offset);
  } else {
    return false;
  }

  const rect = charRange.getBoundingClientRect();
  const tolerance = 5;
  return (
    x >= rect.left - tolerance && x <= rect.right + tolerance &&
    y >= rect.top - tolerance && y <= rect.bottom + tolerance
  );
}

function isGrabbable(target: HTMLElement, container: HTMLElement, x: number, y: number): boolean {
  if (target === container) return true;
  if (target.closest('.thought-pane-body')) {
    if (target.closest('a') || target.closest('button')) return false;
    return !isOverText(x, y);
  }
  if (target.closest('.ghost-pane-column') || target.closest('.inline-forward-ghost')) return false;
  if (target.closest('a') || target.closest('button')) return false;
  if (target.closest('.thought-pane-title')) return false;
  if (target.closest('.thought-pane-header')) return true;
  const pane = target.closest('.thought-pane');
  if (pane && !pane.classList.contains('collapsed') && target === pane) return true;
  return false;
}

function thoughtSlugFromHref(href: string | null, graph: ThoughtGraph): string | null {
  if (!href || !href.startsWith('/thoughts/')) return null;
  const slug = href.replace(/^\/thoughts\//, '').replace(/\/$/, '');
  return slug in graph ? slug : null;
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
  const [scrollTarget, setScrollTarget] = useState<{ index: number; mode: 'into-view' | 'reveal' } | null>(null);
  const initializedRef = useRef(false);
  const prevPaneCountRef = useRef(1);
  const firstPaneStartLeft = useRef<number | null>(null);
  const initialPaneSlugs = useRef(new Set([initialSlug]));
  const suppressNextClickRef = useRef(false);

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

  // Scroll to a pane — two modes:
  // 'into-view': new pane added to the right, use scrollIntoView
  // 'reveal': existing pane in the stack, use overlap detection
  useEffect(() => {
    if (scrollTarget === null || !containerRef.current) return;
    const container = containerRef.current;
    const paneEls = container.querySelectorAll('.thought-pane');
    const target = paneEls[scrollTarget.index] as HTMLElement | undefined;
    if (target) {
      if (scrollTarget.mode === 'into-view') {
        target.scrollIntoView({ behavior: 'smooth', inline: 'start', block: 'nearest' });
      } else {
        const containerRect = container.getBoundingClientRect();
        const paneRect = target.getBoundingClientRect();
        const stickyOffset = scrollTarget.index * 40;
        const PADDING = 16;

        // Right side: covered by the next pane?
        const nextPane = paneEls[scrollTarget.index + 1] as HTMLElement | undefined;
        const rightBound = nextPane
          ? nextPane.getBoundingClientRect().left
          : containerRect.right;
        const rightOverlap = paneRect.right - rightBound;

        // Left side: behind sticky strips?
        const visibleLeft = containerRect.left + stickyOffset;
        const leftOverlap = visibleLeft - paneRect.left;

        if (rightOverlap > PADDING) {
          // No next pane → pane extends past viewport right → scroll right to reveal
          // Has next pane → pane covered by next pane's overlap → scroll left to separate
          const direction = nextPane ? -1 : 1;
          container.scrollBy({ left: direction * (rightOverlap + PADDING), behavior: 'smooth' });
        } else if (leftOverlap > PADDING) {
          container.scrollBy({ left: leftOverlap + PADDING, behavior: 'smooth' });
        }
      }
    }
    setScrollTarget(null);
  }, [scrollTarget]);

  // Flash highlight on an existing pane when navigated to via link click
  const flashPane = useCallback((index: number) => {
    const container = containerRef.current;
    if (!container) return;
    const target = container.querySelectorAll('.thought-pane')[index] as HTMLElement | undefined;
    if (!target) return;
    target.classList.remove('flash-highlight'); // reset if already flashing
    void target.offsetWidth; // force reflow to restart animation
    target.classList.add('flash-highlight');
    target.addEventListener('animationend', () => {
      target.classList.remove('flash-highlight');
    }, { once: true });
  }, []);

  const openThought = useCallback(
    async (slug: string, fromPaneIndex: number) => {
      // Already open in the stack? Scroll to it and flash.
      const existingIndex = panes.findIndex((p) => p.slug === slug);
      if (existingIndex >= 0) {
        setForwardGhost(null);
        setScrollTarget({ index: existingIndex, mode: 'reveal' });
        flashPane(existingIndex);
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
        // Batch ghost removal + pane insertion in one render to avoid
        // the ~260px flex layout zigzag (ghost yanked → panes jump left
        // → new pane inserted → panes jump right).
        setForwardGhost(null);
        setPanes((prev) => [
          ...prev.slice(0, fromPaneIndex + 1),
          thought,
          ...prev.slice(fromPaneIndex + 1),
        ]);
        setScrollTarget({ index: fromPaneIndex + 1, mode: 'into-view' });
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
      if (suppressNextClickRef.current) {
        suppressNextClickRef.current = false;
        e.preventDefault();
        return;
      }

      const anchor = (e.target as HTMLElement).closest('a');
      if (!anchor) return;
      if (window.innerWidth < 768) return; // let browser navigate

      const slug = thoughtSlugFromHref(anchor.getAttribute('href'), graph);
      if (!slug) return;

      e.preventDefault();

      if (hoverTimeoutRef.current) {
        clearTimeout(hoverTimeoutRef.current);
        hoverTimeoutRef.current = null;
      }
      // Don't yank ghost here — let openThought batch the removal
      // with setPanes so the layout doesn't zigzag.

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

  // Toggle .scrollable class when container content overflows
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const update = () => {
      container.classList.toggle('scrollable', container.scrollWidth > container.clientWidth);
    };
    const ro = new ResizeObserver(update);
    ro.observe(container);
    update();
    return () => ro.disconnect();
  }, [panes.length]);

  // Mobile: only show the last pane (determined after mount to avoid hydration mismatch)
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    setIsMobile(window.innerWidth < 768);
  }, []);
  const visiblePanes = isMobile ? [panes[panes.length - 1]] : panes;
  // Ghost backlinks from the last pane (bidirectional/cyclic links are fine)
  const lastPane = panes[panes.length - 1];
  const ghostBacklinks = lastPane.backlinks;

  // Forward ghost pane — shown on hover over a forward link
  const [forwardGhost, setForwardGhost] = useState<ForwardGhost | null>(null);

  // Invariant: never show a forward ghost for a slug already in the stack.
  // Handles all race conditions between async pane addition and mouse events.
  useLayoutEffect(() => {
    if (forwardGhost && panes.some((p) => p.slug === forwardGhost.slug)) {
      setForwardGhost(null);
    }
  }, [forwardGhost, panes]);
  const forwardGhostFetchRef = useRef<AbortController | null>(null);
  const forwardGhostCache = useRef<Map<string, ThoughtApiResponse>>(new Map());
  const hoverTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hoveredPaneRef = useRef<HTMLElement | null>(null);

  const showForwardGhost = useCallback(
    (slug: string, fromPaneIndex: number) => {
      // Check cache first
      const cached = forwardGhostCache.current.get(slug);
      if (cached) {
        // Avoid re-render if already showing this slug
        setForwardGhost((prev) => (prev?.slug === slug && prev.thought === cached ? prev : { slug, thought: cached, fromPaneIndex }));
        return;
      }

      // Show ghost immediately (loading state), then fetch
      setForwardGhost((prev) => (prev?.slug === slug ? prev : { slug, thought: null, fromPaneIndex }));

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

      // Inline ghost: reverse curtain (right pane slides back to cover)
      const inlineWrapper = containerRef.current?.querySelector<HTMLElement>('.inline-ghost-reveal');
      if (inlineWrapper) {
        inlineWrapper.classList.add('closing');
        setTimeout(() => setForwardGhost(null), 300);
        return;
      }

      // Column ghost: fade out (symmetric to fade-in entry)
      const columnGhost = containerRef.current?.querySelector<HTMLElement>('.forward-ghost-pane');
      if (columnGhost) {
        columnGhost.classList.add('closing');
        setTimeout(() => setForwardGhost(null), 200);
        return;
      }

      setForwardGhost(null);
    }, 100);
  }, []);

  const cancelHideForwardGhost = useCallback(() => {
    if (hideTimeoutRef.current) {
      clearTimeout(hideTimeoutRef.current);
      hideTimeoutRef.current = null;
    }
  }, []);

  // Dynamic grab cursor over blank areas in pane body
  useEffect(() => {
    if (isMobile) return;
    const container = containerRef.current;
    if (!container) return;

    let rafId = 0;
    const onMouseMove = (e: MouseEvent) => {
      if (rafId) return;
      rafId = requestAnimationFrame(() => {
        rafId = 0;
        const target = e.target as HTMLElement;
        const body = target.closest('.thought-pane-body') as HTMLElement | null;
        if (!body) return;
        const scrollable = container.classList.contains('scrollable');
        body.style.cursor = (!scrollable || isOverText(e.clientX, e.clientY)) ? '' : 'grab';
      });
    };

    const onMouseOut = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const body = target.closest('.thought-pane-body') as HTMLElement | null;
      if (body) body.style.cursor = '';
    };

    container.addEventListener('mousemove', onMouseMove, { passive: true });
    container.addEventListener('mouseout', onMouseOut, { passive: true });
    return () => {
      container.removeEventListener('mousemove', onMouseMove);
      container.removeEventListener('mouseout', onMouseOut);
      if (rafId) cancelAnimationFrame(rafId);
    };
  }, [isMobile]);

  // Drag-to-scroll on structural areas + click-to-reveal partially-visible panes
  const handleContainerMouseDown = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (isMobile) return;
      if (e.button !== 0) return;
      const container = containerRef.current;
      if (!container) return;

      if (container.scrollWidth <= container.clientWidth) return;

      const target = e.target as HTMLElement;
      if (!isGrabbable(target, container, e.clientX, e.clientY)) return;

      const startX = e.clientX;
      const startScrollLeft = container.scrollLeft;
      let state: 'PENDING' | 'DRAGGING' = 'PENDING';
      let lastX = startX;
      let lastTime = performance.now();
      let velocity = 0;

      const onMouseMove = (ev: MouseEvent) => {
        const deltaX = ev.clientX - startX;
        if (state === 'PENDING') {
          if (Math.abs(deltaX) <= 5) return;
          state = 'DRAGGING';
          container.classList.add('dragging');
          container.style.scrollBehavior = 'auto';
        }
        const now = performance.now();
        const dt = now - lastTime;
        if (dt > 0) velocity = (ev.clientX - lastX) / dt;
        lastX = ev.clientX;
        lastTime = now;
        container.scrollLeft = startScrollLeft - deltaX;
      };

      const onMouseUp = () => {
        window.removeEventListener('mousemove', onMouseMove);
        window.removeEventListener('mouseup', onMouseUp);
        container.classList.remove('dragging');

        if (state === 'DRAGGING') {
          suppressNextClickRef.current = true;
          // Momentum: coast in the drag direction
          const momentum = -velocity * 300;
          if (Math.abs(momentum) > 10) {
            container.style.scrollBehavior = 'smooth';
            container.scrollBy({ left: momentum });
          }
          container.style.scrollBehavior = '';
          return;
        }

        container.style.scrollBehavior = '';
      };

      window.addEventListener('mousemove', onMouseMove);
      window.addEventListener('mouseup', onMouseUp);
      e.preventDefault();
    },
    [isMobile],
  );

  // Event delegation for hover on forward links
  const handleContainerMouseOver = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (isMobile) return;
      if (containerRef.current?.classList.contains('dragging')) return;
      const anchor = (e.target as HTMLElement).closest('a');
      if (!anchor) return;

      const slug = thoughtSlugFromHref(anchor.getAttribute('href'), graph);
      if (!slug) return;

      // Already open in the stack? Show a soft glow hint instead of a ghost.
      const existingIndex = panes.findIndex((p) => p.slug === slug);
      if (existingIndex >= 0) {
        const target = containerRef.current?.querySelectorAll('.thought-pane')[existingIndex] as HTMLElement | undefined;
        if (target && !target.classList.contains('flash-highlight') && !target.classList.contains('animate-in')) {
          hoveredPaneRef.current?.classList.remove('hover-highlight');
          target.classList.add('hover-highlight');
          hoveredPaneRef.current = target;
        }
        return;
      }

      // Cancel any pending hide
      cancelHideForwardGhost();

      // Determine which pane the hover came from
      const paneEl = anchor.closest<HTMLElement>('.thought-pane');
      let fromIndex = panes.length - 1;
      if (paneEl && containerRef.current) {
        const paneEls = Array.from(containerRef.current.querySelectorAll('.thought-pane'));
        const idx = paneEls.indexOf(paneEl);
        if (idx >= 0) fromIndex = idx;
      }

      // Debounce slightly to avoid flicker on fast mouse moves
      if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
      hoverTimeoutRef.current = setTimeout(() => {
        showForwardGhost(slug, fromIndex);
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
      if (related?.closest('.forward-ghost-pane') || related?.closest('.inline-forward-ghost')) return;

      // Clear hover highlight
      hoveredPaneRef.current?.classList.remove('hover-highlight');
      hoveredPaneRef.current = null;

      hideForwardGhost();
    },
    [hideForwardGhost],
  );

  // Forward ghost from the last pane falls back to the ghost column
  const forwardGhostInColumn = forwardGhost && forwardGhost.fromPaneIndex === panes.length - 1;
  const hasGhostColumn = ghostBacklinks.length > 0 || !!forwardGhostInColumn;

  // Pre-compute open pane slugs to avoid O(n²) scans in ghost column rendering
  const openPaneSlugs = useMemo(() => new Set(panes.map((p) => p.slug)), [panes]);

  const handleForwardGhostClick = useCallback(() => {
    if (!forwardGhost) return;
    const { slug, fromPaneIndex } = forwardGhost;
    hideForwardGhost();
    openThought(slug, fromPaneIndex);
  }, [forwardGhost, hideForwardGhost, openThought]);

  const forwardGhostContent = forwardGhost && (
    forwardGhost.thought ? (
      <>
        <span className="ghost-pane-title">{forwardGhost.thought.title}</span>
        <div
          className="ghost-pane-context forward-ghost-content"
          dangerouslySetInnerHTML={{ __html: forwardGhost.thought.html }}
        />
      </>
    ) : (
      <span className="ghost-pane-title" style={{ fontStyle: 'italic', color: 'var(--ink-light)' }}>Loading…</span>
    )
  );

  const ghostColumnRef = useRef<HTMLDivElement>(null);

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

  // Single-pane mode based on stable ghosts (backlinks) only — transient forward
  // ghost is absolutely positioned so it won't shift the centered pane.
  const hasStableGhosts = ghostBacklinks.length > 0;
  const isSinglePane = panes.length === 1 && !hasStableGhosts;
  const isSinglePaneWithGhosts = panes.length === 1 && hasStableGhosts;

  return (
    <div
      className={`stacked-container${isSinglePane ? ' single-pane' : ''}${isSinglePaneWithGhosts ? ' single-pane-with-ghosts' : ''}`}
      ref={containerRef}
      onClick={handleContainerClick}
      onMouseDown={handleContainerMouseDown}
      onMouseOver={handleContainerMouseOver}
      onMouseOut={handleContainerMouseOut}
    >
      {visiblePanes.flatMap((pane, visualIndex) => {
        const realIndex = isMobile ? panes.length - 1 : visualIndex;
        const isCollapsed = collapsedSet.has(realIndex);
        const isLastPane = realIndex === panes.length - 1;
        const ghostInsertAfter = !isMobile && forwardGhost && forwardGhost.fromPaneIndex === realIndex && !isLastPane;

        const elements = [
          <div
            key={pane.slug}
            className={`thought-pane${isCollapsed ? ' collapsed' : ''}${!initialPaneSlugs.current.has(pane.slug) ? ' animate-in' : ''}`}
            onAnimationEnd={(e) => {
              if (e.animationName === 'pane-pop') {
                e.currentTarget.classList.remove('animate-in');
              }
            }}
            style={{
              left: `${realIndex * 40}px`,
              '--tilt': isCollapsed ? '0deg' : realIndex % 2 === 0 ? '0.6deg' : '-0.4deg',
              marginTop: realIndex % 2 === 0 ? '8px' : '1px',
              marginBottom: realIndex % 2 === 0 ? '8px' : '1px',
            } as React.CSSProperties}
            onClick={
              isCollapsed
                ? () => {
                    // Un-collapse: scroll to this pane
                    setScrollTarget({ index: realIndex, mode: 'reveal' });
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
          </div>,
        ];

        if (ghostInsertAfter) {
          elements.push(
            <div
              key={`inline-ghost-reveal-${forwardGhost.fromPaneIndex}`}
              className="inline-ghost-reveal"
              style={{ left: `${realIndex * 40 + 625}px` }}
            >
              <div
                className="inline-forward-ghost"
                onMouseEnter={cancelHideForwardGhost}
                onMouseLeave={() => { if (forwardGhost) hideForwardGhost(); }}
                onClick={handleForwardGhostClick}
              >
                <div key={forwardGhost.slug} className="ghost-content-fade">
                  {forwardGhostContent}
                </div>
              </div>
            </div>,
          );
        }

        return elements;
      })}
      {!isMobile && hasGhostColumn && (
        <div className={`ghost-pane-column${ghostBacklinks.some((bl) => openPaneSlugs.has(bl.slug)) ? ' has-linked-ghosts' : ''}`}
          ref={ghostColumnRef}
          onMouseEnter={cancelHideForwardGhost}
          onMouseLeave={() => { if (forwardGhost) hideForwardGhost(); }}
        >
          {forwardGhostInColumn && (
            <div
              className="ghost-pane forward-ghost-pane"
              onClick={handleForwardGhostClick}
            >
              {forwardGhostContent}
            </div>
          )}
          {ghostBacklinks.some((bl) => !openPaneSlugs.has(bl.slug)) && (
            <div className="ghost-unlinked-group">
              <span className="ghost-section-label">Backlinks</span>
              {ghostBacklinks.filter((bl) => !openPaneSlugs.has(bl.slug)).map((bl) => (
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
          {ghostBacklinks.some((bl) => openPaneSlugs.has(bl.slug)) && (
            <div className="ghost-linked-group">
              {ghostBacklinks.filter((bl) => openPaneSlugs.has(bl.slug)).map((bl) => {
                const openIndex = panes.findIndex((p) => p.slug === bl.slug);
                return (
                  <div
                    key={`ghost-${bl.slug}`}
                    className="ghost-pane ghost-pane-linked"
                    data-ghost-slug={bl.slug}
                    onClick={() => openThought(bl.slug, panes.length - 1)}
                    onMouseEnter={() => {
                      const target = containerRef.current?.querySelectorAll('.thought-pane')[openIndex] as HTMLElement | undefined;
                      if (target && !target.classList.contains('flash-highlight')) {
                        hoveredPaneRef.current?.classList.remove('hover-highlight');
                        target.classList.add('hover-highlight');
                        hoveredPaneRef.current = target;
                      }
                    }}
                    onMouseLeave={() => {
                      hoveredPaneRef.current?.classList.remove('hover-highlight');
                      hoveredPaneRef.current = null;
                    }}
                  >
                    <span className="ghost-pane-title">{bl.title}</span>
                    {bl.context && (
                      <div
                        className="ghost-pane-context"
                        dangerouslySetInnerHTML={{ __html: bl.context }}
                      />
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
