# Scrub-to-Scroll

Drag-to-scroll for the stacked panes UI. Desktop only — mobile is untouched.

## Interaction Model

```
mousedown on grabbable area
  ├─ mousemove > 5px  → DRAGGING
  │   ├─ tracks velocity for momentum
  │   ├─ container.scrollLeft follows mouse
  │   └─ mouseup → momentum coast via smooth scrollBy, suppress next click
  └─ mouseup ≤ 5px   → no-op (normal click propagation)
```

## Key Concepts

### Grabbable Areas

`isGrabbable(target, container, x, y)` determines what can be dragged.

| Area | Grabbable? | Why |
|---|---|---|
| Container background (gaps between panes) | Yes | `target === container` |
| Pane header bar (padding around title) | Yes | `target.closest('.thought-pane-header')` |
| Pane title text | No | `target.closest('.thought-pane-title')` — selectable |
| Pane body blank space | Yes | `!isOverText(x, y)` via caret hit-testing |
| Pane body text | No | `isOverText(x, y)` — selectable |
| Links, buttons | No | Always clickable |
| Ghost pane column | No | Has its own click handlers |
| Collapsed pane strips | No | Has its own onClick → scrollTarget |

### Caret Hit-Testing (`isOverText`)

CSS can't distinguish "over text pixels" from "over blank pixels within an element." We use `document.caretRangeFromPoint(x, y)` to check at the pixel level:

1. Get the nearest caret position from the browser
2. If not a text node or empty text → blank space
3. Expand the collapsed range to the nearest character
4. Check if `(x, y)` is within that character's bounding rect (5px tolerance)
5. If yes → over text; if no → blank space

This runs in two places:
- **mousedown** — via `isGrabbable` to decide if drag should start
- **mousemove** — via the cursor `useEffect` to toggle `cursor: grab` vs default

The mousemove listener is rAF-throttled (~60 calls/sec max). `caretRangeFromPoint` is a browser-native hit test (microseconds per call).

### Scrollability Detection

The `.scrollable` class on the container controls whether grab cursors appear.

- Toggled by a `ResizeObserver` + `panes.length` dependency
- Check: `container.scrollWidth > container.clientWidth`
- When not scrollable: no grab cursor anywhere, mousedown handler bails early
- The dynamic body cursor effect also checks `.scrollable` before showing grab

### Momentum

On mouseup after drag, velocity (px/ms from last mousemove frame) is projected forward:

```
momentum = -velocity * 300
```

Applied via `scrollBy({ left: momentum, behavior: 'smooth' })`. The CSS smooth scroll does the easing. Momentum < 10px is ignored (avoids tiny drift on slow release).

`scroll-behavior` is toggled: `auto` during drag (so direct scrollLeft assignment is instant), restored to CSS default on mouseup, briefly set to `smooth` for the momentum coast.

## CSS Rules (`stacked-thoughts.css`)

```
.scrollable              → cursor: grab
.scrollable .body > *    → cursor: auto  (text I-beam over text, default over margins)
.scrollable .title       → cursor: auto  (selectable)
.scrollable a, button    → cursor: pointer
.dragging, .dragging *   → cursor: grabbing !important
.dragging                → user-select: none
```

The JS mousemove cursor effect patches the body element's inline `style.cursor` for pixel-accurate grab/text switching. It only activates inside `.thought-pane-body` and only when `.scrollable` is present.

## Click Suppression

After a drag ends, the browser fires a `click` event. `suppressNextClickRef` (a React ref) is set to `true` on mouseup in DRAGGING state. The `handleContainerClick` handler checks and consumes it at the top, preventing accidental link navigation after a drag.

## Event Wiring

On the container `<div>`:
- `onClick` → link interception (existing) + click suppression guard
- `onMouseDown` → drag state machine entry point
- `onMouseOver` / `onMouseOut` → forward ghost hover (existing) + dragging guard

Window-level (attached/detached per drag gesture via closure):
- `mousemove` → drag tracking + velocity
- `mouseup` → drag end + momentum + cleanup

Container-level (persistent via useEffect):
- `mousemove` → rAF-throttled cursor toggle over pane bodies
- `mouseout` → reset body cursor

## Files

- `src/components/StackedThoughts.tsx` — all JS logic (helpers at module scope, handlers + effects inside component)
- `src/styles/stacked-thoughts.css` — cursor rules in `@media (min-width: 768px)` block at top of file
