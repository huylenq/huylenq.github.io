# Ghost Panes: State & Animation Complexity Map

The ghost pane system in `StackedThoughts.tsx` is the most complex subsystem in the stacked thoughts UI. This document maps the interacting state, timers, effects, and known race conditions to help future debugging.

## State Inventory

| State / Ref | Type | Purpose |
|---|---|---|
| `forwardGhost` | `useState<ForwardGhost \| null>` | Currently previewed forward-linked thought |
| `forwardGhostFetchRef` | `useRef<AbortController>` | Abort handle for in-flight ghost fetch |
| `forwardGhostCache` | `useRef<Map<string, ThoughtApiResponse>>` | Persists fetched ghost content across hovers |
| `hoverTimeoutRef` | `useRef<setTimeout>` | 80ms debounce before showing ghost |
| `hideTimeoutRef` | `useRef<setTimeout>` | 100ms grace period before hiding ghost |
| `panes` | `useState<Pane[]>` | The real pane stack |
| `ghostBacklinks` | derived from `panes` | Backlinks of the last pane (backward ghosts) |
| `hasGhostColumn` | derived | `ghostBacklinks.length > 0 \|\| !!forwardGhost` |
| `prevForwardGhostSlug` | `useRef` | Previous ghost slug for FLIP animation trigger |
| `backwardGhostPositions` | `useRef<Map>` | Snapshot of backward ghost Y positions for FLIP |
| `prevHasGhostColumn` | `useRef` | Previous visibility for scroll stabilization |

## Timer Lifecycle

Two competing timers control forward ghost visibility:

```
  hover link ──→ [80ms debounce] ──→ showForwardGhost(slug)
                  hoverTimeoutRef

  leave link ──→ [100ms grace] ──→ setForwardGhost(null) + abort fetch
                  hideTimeoutRef
```

The grace period exists so users can cross the gap between the pane edge and the ghost column without the ghost vanishing. `cancelHideForwardGhost()` keeps the ghost alive when the mouse enters the ghost column.

## Event Flow: Hover → Show

```
1. onMouseOver (container, delegation)
   ├─ find closest <a> with /thoughts/ href
   ├─ extract slug, validate against graph
   ├─ guard: skip if slug is already the next pane (uses `panes` closure)
   ├─ cancelHideForwardGhost()           ← cancel any pending hide
   └─ set 80ms timeout → showForwardGhost(slug)

2. showForwardGhost(slug)
   ├─ if cached: setForwardGhost({ slug, thought }) (functional updater to skip no-op)
   └─ if not cached:
       ├─ setForwardGhost({ slug, thought: null })   ← loading state
       ├─ abort previous fetch
       └─ fetchThought(slug).then → cache + setForwardGhost updater
```

## Event Flow: Leave → Hide

```
1. onMouseOut (container, delegation)
   ├─ find closest <a> with /thoughts/ href
   ├─ guard: ignore if relatedTarget is inside same <a> (child element moves)
   ├─ guard: ignore if moving to .forward-ghost-pane (crossing gap)
   └─ hideForwardGhost()

2. hideForwardGhost()
   ├─ clear hoverTimeoutRef (cancel pending show)
   └─ set 100ms timeout → abort fetch + setForwardGhost(null)

3. Ghost column onMouseEnter → cancelHideForwardGhost()
4. Ghost column onMouseLeave → hideForwardGhost()
```

## Event Flow: Click Link → Open Pane

```
1. onClick (container, delegation)
   ├─ find closest <a> with /thoughts/ href
   ├─ e.preventDefault()
   ├─ clear hoverTimeoutRef
   ├─ setForwardGhost(null)                ← sync clear
   └─ openThought(slug, fromIndex)         ← ASYNC (await fetchThought)
       └─ setPanes([...truncated, thought]) ← happens after network round-trip
```

**Critical gap:** Between `setForwardGhost(null)` (sync) and `setPanes` (async), `panes` is stale. Any mouseover during this window sees old `panes`, and the "already next pane" guard in `handleContainerMouseOver` fails.

## Known Race Condition: Ghost Persists After Click

**Scenario:** Thought A → forward link to B → hover shows ghost → click opens B → ghost of B remains alongside real pane B.

**Root cause:** `openThought` updates `panes` asynchronously (after `await fetchThought`). Mouse events (from click jitter, layout reflow, or DOM changes) can re-trigger `showForwardGhost` during the async gap. The "already next pane" guard in `handleContainerMouseOver` uses `panes` from its closure, which is stale during this gap.

**Attempted fix (did not work):** `openingSlugRef` — a ref set on click and checked in the 80ms timeout. The ghost still persisted, suggesting the re-trigger path may not go through the debounce timeout at all, or the root cause is different than hypothesized.

**Current fix:** A `useLayoutEffect` invariant that clears `forwardGhost` whenever its slug is found in `panes`. This fires synchronously after DOM mutation but before paint, preventing the user from ever seeing a ghost for an already-open pane. This is a catch-all regardless of which code path sets the stale ghost.

```tsx
useLayoutEffect(() => {
  if (forwardGhost && panes.some((p) => p.slug === forwardGhost.slug)) {
    setForwardGhost(null);
  }
}, [forwardGhost, panes]);
```

**Status:** Under testing. If this also fails, the re-trigger path needs console instrumentation to identify.

## Animation Layers

### 1. Forward ghost entrance (CSS)
```css
.forward-ghost-pane { animation: forward-ghost-in 0.2s ease both; }
```
Pure CSS, fires on mount. No cleanup needed.

### 2. Backward ghost FLIP (when forward ghost toggles)
When forward ghost appears/disappears, backward ghosts shift vertically. FLIP animation:
- `useEffect` (no deps) snapshots backward ghost Y positions after every paint
- `useLayoutEffect([forwardGhost])` computes delta and applies `translateY` animation

### 3. First pane slide FLIP (single ↔ multi pane transition)
When going from 1→2 or 2→1 panes, the first pane slides horizontally:
- Click handler snapshots `firstPaneStartLeft` before state change
- `useLayoutEffect([panes.length])` computes delta and applies `translateX` animation

### 4. Ghost column scroll stabilization
```tsx
useLayoutEffect([hasGhostColumn]) → pin container.scrollLeft
```
Prevents horizontal scroll jump when ghost column appears/disappears.

### 5. Pane close animation (CSS + timeout)
```tsx
closingEl.classList.add('closing');
setTimeout(() => setPanes(...), 200);
```
CSS transition on width/opacity, then React removes after 200ms.

## Why This Is Hard

The complexity comes from the intersection of:
1. **Async state gaps** — `openThought` updates `panes` after a network fetch, creating windows where `panes` and `forwardGhost` are inconsistent
2. **Closure staleness** — `handleContainerMouseOver` captures `panes` at creation time; mouse events during the async gap see old values
3. **Multiple timers** — 80ms show debounce + 100ms hide grace period interact unpredictably with click events
4. **Browser mouse event quirks** — mouse jitter during click, layout-triggered mouseover from DOM changes, mouseover bubbling from child elements
5. **Animation coordination** — FLIP animations read DOM positions in effects, which interact with React's render cycle and the ghost state changes
