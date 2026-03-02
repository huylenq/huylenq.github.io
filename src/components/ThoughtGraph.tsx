import { useEffect, useRef, useCallback, useState } from "react";
import {
  forceSimulation,
  forceLink,
  forceManyBody,
  forceX,
  forceY,
  type SimulationNodeDatum,
  type SimulationLinkDatum,
} from "d3-force";
import { select } from "d3-selection";
import "d3-transition";
import { drag as d3Drag } from "d3-drag";
import type { PublicThought, ThoughtEdge, Maturity } from "../lib/types";

interface ForceParams {
  linkStrength: number;
  linkDistance: number;
  chargeStrength: number;
  centerXStrength: number;
  centerYStrength: number;
  collisionPadX: number;
  collisionPadY: number;
  alphaDecay: number;
  velocityDecay: number;
}

const DEFAULT_FORCE_PARAMS: ForceParams = {
  "linkStrength": 0.1,
  "linkDistance": 20,
  "chargeStrength": 0,
  "centerXStrength": 0.005,
  "centerYStrength": 0.02,
  "collisionPadX": 8,
  "collisionPadY": 27,
  "alphaDecay": 0.02,
  "velocityDecay": 0.2
};

interface GraphNode extends SimulationNodeDatum {
  id: string;
  title: string;
  connected: boolean;
  maturity: Maturity;
  textWidth: number;
}

interface GraphLink extends SimulationLinkDatum<GraphNode> {
  source: GraphNode;
  target: GraphNode;
}

interface ThoughtGraphProps {
  thoughts: PublicThought[];
  edges: ThoughtEdge[];
  fillViewport?: boolean;
}

function measureTextWidths(
  titles: { id: string; title: string }[],
  font: string
): Map<string, number> {
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d")!;
  ctx.font = font;
  const widths = new Map<string, number>();
  for (const { id, title } of titles) {
    widths.set(id, ctx.measureText(title).width);
  }
  return widths;
}

/** Custom rectangular collision force — respects text width vs height independently */
function forceRectCollide(nodes: GraphNode[], padX: number, padY: number) {
  const textHeight = 14;
  return () => {
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const a = nodes[i];
        const b = nodes[j];
        const dx = (b.x ?? 0) - (a.x ?? 0);
        const dy = (b.y ?? 0) - (a.y ?? 0);
        const halfWa = a.textWidth / 2 + padX;
        const halfWb = b.textWidth / 2 + padX;
        const halfHa = textHeight / 2 + padY;
        const halfHb = textHeight / 2 + padY;
        const overlapX = (halfWa + halfWb) - Math.abs(dx);
        const overlapY = (halfHa + halfHb) - Math.abs(dy);
        if (overlapX > 0 && overlapY > 0) {
          // Push apart along the axis with less overlap
          if (overlapX < overlapY) {
            const shift = overlapX / 2 * Math.sign(dx || 1);
            a.x! -= shift;
            b.x! += shift;
          } else {
            const shift = overlapY / 2 * Math.sign(dy || 1);
            a.y! -= shift;
            b.y! += shift;
          }
        }
      }
    }
  };
}

function useTweakpane(
  paramsRef: React.MutableRefObject<ForceParams>,
  onParamsChange: () => void
) {
  const paneRef = useRef<any>(null);

  useEffect(() => {
    if (!import.meta.env.DEV) return;

    let disposed = false;

    import("tweakpane").then(({ Pane }) => {
      if (disposed) return;

      const pane = new Pane({ title: "Force Graph", expanded: false });
      paneRef.current = pane;
      pane.element.style.position = "fixed";
      pane.element.style.top = "8px";
      pane.element.style.right = "8px";
      pane.element.style.zIndex = "9999";

      const link = pane.addFolder({ title: "Link Force" });
      link.addBinding(paramsRef.current, "linkStrength", { min: 0, max: 1, step: 0.01 });
      link.addBinding(paramsRef.current, "linkDistance", { min: 1, max: 200, step: 1 });

      const charge = pane.addFolder({ title: "Charge" });
      charge.addBinding(paramsRef.current, "chargeStrength", { min: -300, max: 100, step: 1 });

      const center = pane.addFolder({ title: "Centering" });
      center.addBinding(paramsRef.current, "centerXStrength", { min: 0, max: 0.5, step: 0.005 });
      center.addBinding(paramsRef.current, "centerYStrength", { min: 0, max: 0.5, step: 0.005 });

      const collision = pane.addFolder({ title: "Collision Padding" });
      collision.addBinding(paramsRef.current, "collisionPadX", { min: 0, max: 60, step: 1 });
      collision.addBinding(paramsRef.current, "collisionPadY", { min: 0, max: 60, step: 1 });

      const sim = pane.addFolder({ title: "Simulation" });
      sim.addBinding(paramsRef.current, "alphaDecay", { min: 0, max: 0.1, step: 0.001 });
      sim.addBinding(paramsRef.current, "velocityDecay", { min: 0, max: 1, step: 0.01 });

      pane.addBlade({ view: "separator" });
      pane.addButton({ title: "Copy as defaults" }).on("click", () => {
        const p = paramsRef.current;
        const code = `const DEFAULT_FORCE_PARAMS: ForceParams = ${JSON.stringify(p, null, 2)};`;
        navigator.clipboard.writeText(code).then(() => {
          // Brief flash on the button to confirm
          const btn = pane.element.querySelector<HTMLElement>(".tp-btnv_b:last-of-type");
          if (btn) {
            const orig = btn.textContent;
            btn.textContent = "Copied!";
            setTimeout(() => { btn.textContent = orig; }, 1000);
          }
        });
      });

      pane.on("change", onParamsChange);
    });

    return () => {
      disposed = true;
      paneRef.current?.dispose();
      paneRef.current = null;
    };
  }, []);
}

const MATURITY_FILL: Record<Maturity, string> = {
  evergreen: "var(--ink-dark)",
  budding: "var(--ink-medium)",
  seed: "var(--ink-faint)",
};

export default function ThoughtGraph({ thoughts, edges, fillViewport }: ThoughtGraphProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const simulationRef = useRef<ReturnType<typeof forceSimulation<GraphNode>> | null>(null);
  const forceParamsRef = useRef<ForceParams>({ ...DEFAULT_FORCE_PARAMS });

  const fallbackHeight = Math.max(400, Math.min(thoughts.length * 60, 600));

  const getHeight = useCallback(() => {
    if (!fillViewport || typeof window === "undefined") return fallbackHeight;
    const container = containerRef.current;
    if (container) {
      const top = container.getBoundingClientRect().top;
      return Math.max(400, window.innerHeight - top);
    }
    const headerOffset = 50;
    return Math.max(400, window.innerHeight - headerOffset);
  }, [fillViewport, fallbackHeight]);

  const [height, setHeight] = useState(fallbackHeight);

  // Set real height on mount (needs window)
  useEffect(() => {
    setHeight(getHeight());
  }, [getHeight]);

  const buildGraph = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;

    const width = container.clientWidth;

    // Measure text widths with the actual font
    const font = `0.85rem Crimson Pro, Georgia, serif`;
    const textWidths = measureTextWidths(
      thoughts.map((t) => ({ id: t.slug, title: t.title })),
      font
    );

    // Build connected set for styling
    const connectedSlugs = new Set<string>();
    for (const e of edges) {
      connectedSlugs.add(e.source);
      connectedSlugs.add(e.target);
    }

    const nodes: GraphNode[] = thoughts.map((t) => ({
      id: t.slug,
      title: t.title,
      connected: connectedSlugs.has(t.slug),
      maturity: t.maturity ?? "seed",
      textWidth: textWidths.get(t.slug) ?? 60,
      x: Math.random() * width,
      y: height * 0.3 + Math.random() * height * 0.4,
    }));

    const nodeMap = new Map(nodes.map((n) => [n.id, n]));

    const links: GraphLink[] = edges
      .filter((e) => nodeMap.has(e.source) && nodeMap.has(e.target))
      .map((e) => ({
        source: nodeMap.get(e.source)!,
        target: nodeMap.get(e.target)!,
      }));

    // Build adjacency for hover highlighting
    const adjacency = new Map<string, Set<string>>();
    for (const link of links) {
      const sId = link.source.id;
      const tId = link.target.id;
      if (!adjacency.has(sId)) adjacency.set(sId, new Set());
      if (!adjacency.has(tId)) adjacency.set(tId, new Set());
      adjacency.get(sId)!.add(tId);
      adjacency.get(tId)!.add(sId);
    }

    // Clear previous
    select(container).select("svg").remove();
    if (simulationRef.current) simulationRef.current.stop();

    const svg = select(container)
      .append("svg")
      .attr("width", width)
      .attr("height", height)
      .attr("viewBox", `0 0 ${width} ${height}`);

    // Arrow marker for directed edges
    const defs = svg.append("defs");
    defs
      .append("marker")
      .attr("id", "arrowhead")
      .attr("viewBox", "0 0 10 8")
      .attr("refX", 10)
      .attr("refY", 4)
      .attr("markerWidth", 7)
      .attr("markerHeight", 6)
      .attr("orient", "auto")
      .append("path")
      .attr("d", "M1,1 L9,4 L1,7")
      .attr("fill", "none")
      .attr("stroke", "var(--ink-light)")
      .attr("stroke-width", 1.2)
      .attr("stroke-linecap", "round")
      .attr("stroke-linejoin", "round");

    defs
      .append("marker")
      .attr("id", "arrowhead-hover")
      .attr("viewBox", "0 0 10 8")
      .attr("refX", 10)
      .attr("refY", 4)
      .attr("markerWidth", 7)
      .attr("markerHeight", 6)
      .attr("orient", "auto")
      .append("path")
      .attr("d", "M1,1 L9,4 L1,7")
      .attr("fill", "none")
      .attr("stroke", "var(--ink-dark)")
      .attr("stroke-width", 1.2)
      .attr("stroke-linecap", "round")
      .attr("stroke-linejoin", "round");

    const linkGroup = svg.append("g").attr("class", "links");
    const nodeGroup = svg.append("g").attr("class", "nodes");

    // Render edges
    const linkElements = linkGroup
      .selectAll("line")
      .data(links)
      .enter()
      .append("line")
      .attr("stroke", "var(--ink-light)")
      .attr("stroke-width", 1)
      .attr("stroke-opacity", 0.5)
      .attr("marker-end", "url(#arrowhead)");

    // Render nodes as <a> wrapping <text>
    const nodeElements = nodeGroup
      .selectAll<SVGAElement, GraphNode>("a")
      .data(nodes, (d) => d.id)
      .enter()
      .append("a")
      .attr("href", (d) => `/thoughts/${d.id}`)
      .attr("class", "thought-graph-node")
      .attr("draggable", "false")
      .style("text-decoration", "none")
      .on("dragstart", (event) => event.preventDefault());

    nodeElements
      .append("text")
      .text((d) => d.title)
      .attr("text-anchor", "middle")
      .attr("dominant-baseline", "central")
      .style("font-family", "var(--font-serif)")
      .style("font-size", "0.85rem")
      .style("fill", (d) => MATURITY_FILL[d.maturity])
      .style("cursor", "pointer")
      .style("user-select", "none");

    // Hidden underline for click loading indicator
    nodeElements
      .append("line")
      .attr("class", "click-underline")
      .attr("x1", 0)
      .attr("y1", 10)
      .attr("x2", 0)
      .attr("y2", 10)
      .attr("stroke", "var(--ink-light)")
      .attr("stroke-width", 1)
      .attr("stroke-opacity", 0);

    // Hover highlight
    nodeElements
      .on("mouseenter", (_event, d) => {
        const neighbors = adjacency.get(d.id) ?? new Set<string>();
        const isRelevant = (n: GraphNode) => n.id === d.id || neighbors.has(n.id);

        nodeElements
          .select("text")
          .style("fill", (n) =>
            isRelevant(n as GraphNode) ? "var(--ink-black)" : "var(--ink-faint)"
          )
          .style("font-weight", (n) => ((n as GraphNode).id === d.id ? "600" : ""));

        linkElements
          .attr("stroke", (l) =>
            l.source.id === d.id || l.target.id === d.id
              ? "var(--ink-dark)"
              : "var(--ink-light)"
          )
          .attr("stroke-width", (l) =>
            l.source.id === d.id || l.target.id === d.id ? 1.5 : 1
          )
          .attr("stroke-opacity", (l) =>
            l.source.id === d.id || l.target.id === d.id ? 1 : 0.2
          )
          .attr("marker-end", (l) =>
            l.source.id === d.id || l.target.id === d.id
              ? "url(#arrowhead-hover)"
              : "url(#arrowhead)"
          );
      })
      .on("mouseleave", () => {
        nodeElements
          .select("text")
          .style("fill", (n) => MATURITY_FILL[(n as GraphNode).maturity])
          .style("font-weight", "");

        linkElements
          .attr("stroke", "var(--ink-light)")
          .attr("stroke-width", 1)
          .attr("stroke-opacity", 0.5)
          .attr("marker-end", "url(#arrowhead)");
      });

    // Drag behavior with click protection
    let dragged = false;

    const dragBehavior = d3Drag<SVGAElement, GraphNode>()
      .on("start", (event, d) => {
        dragged = false;
        if (!event.active) simulation.alphaTarget(0.01).restart();
        d.fx = d.x;
        d.fy = d.y;
      })
      .on("drag", (event, d) => {
        const dx = event.x - (d.fx ?? 0);
        const dy = event.y - (d.fy ?? 0);
        if (Math.abs(dx) > 5 || Math.abs(dy) > 5) dragged = true;
        d.fx = event.x;
        d.fy = event.y;
      })
      .on("end", (event, d) => {
        if (!event.active) simulation.alphaTarget(0);
        d.fx = null;
        d.fy = null;
      });

    nodeElements.call(dragBehavior);

    // Click: prevent nav when dragging, animate underline on real clicks
    nodeElements.on("click", function (event, d) {
      if (dragged) {
        event.preventDefault();
        return;
      }
      // Animate underline growing outward from center
      const halfW = d.textWidth / 2;
      select(this)
        .select(".click-underline")
        .attr("stroke-opacity", 1)
        .attr("x1", 0)
        .attr("x2", 0)
        .transition()
        .duration(600)
        .attr("x1", -halfW)
        .attr("x2", halfW);
    });

    // Force simulation
    const p = forceParamsRef.current;
    const simulation = forceSimulation<GraphNode>(nodes)
      .force(
        "link",
        forceLink<GraphNode, GraphLink>(links)
          .id((d) => d.id)
          .strength(p.linkStrength)
          .distance(p.linkDistance)
      )
      .force("charge", forceManyBody<GraphNode>().strength(p.chargeStrength))
      .force("x", forceX<GraphNode>(width / 2).strength(p.centerXStrength))
      .force("y", forceY<GraphNode>(height / 2).strength(p.centerYStrength))
      .force("rectCollide", forceRectCollide(nodes, forceParamsRef.current.collisionPadX, forceParamsRef.current.collisionPadY))
      .alphaDecay(forceParamsRef.current.alphaDecay)
      .velocityDecay(forceParamsRef.current.velocityDecay)
      .stop(); // don't auto-start — we pre-tick first

    // Pre-tick to settle layout before first paint
    for (let i = 0; i < 150; i++) simulation.tick();

    simulation.on("tick", () => {
        // Offset edge endpoints to stop at text bounding box
        // Uses ray-rectangle intersection: half-width × half-height box around each node
        const textHeight = 14; // approximate line height for 0.85rem
        const pad = 4;

        function clipToBox(
          cx: number, cy: number, halfW: number, halfH: number,
          tx: number, ty: number
        ): [number, number] {
          const dx = tx - cx;
          const dy = ty - cy;
          if (dx === 0 && dy === 0) return [cx, cy];
          // Scale factor to reach the box edge along the ray direction
          const sx = halfW / Math.abs(dx || 1e-6);
          const sy = halfH / Math.abs(dy || 1e-6);
          const s = Math.min(sx, sy);
          return [cx + dx * s, cy + dy * s];
        }

        // Clamp nodes within SVG bounds (account for text width)
        const edgePadY = 40; // vertical "wall" to keep nodes from hugging top/bottom
        for (const d of nodes) {
          const hw = d.textWidth / 2 + pad;
          d.x = Math.max(hw, Math.min(width - hw, d.x!));
          d.y = Math.max(edgePadY, Math.min(height - edgePadY, d.y!));
        }

        linkElements
          .attr("x1", (d) => clipToBox(d.source.x!, d.source.y!, d.source.textWidth / 2 + pad, textHeight / 2 + pad, d.target.x!, d.target.y!)[0])
          .attr("y1", (d) => clipToBox(d.source.x!, d.source.y!, d.source.textWidth / 2 + pad, textHeight / 2 + pad, d.target.x!, d.target.y!)[1])
          .attr("x2", (d) => clipToBox(d.target.x!, d.target.y!, d.target.textWidth / 2 + pad, textHeight / 2 + pad, d.source.x!, d.source.y!)[0])
          .attr("y2", (d) => clipToBox(d.target.x!, d.target.y!, d.target.textWidth / 2 + pad, textHeight / 2 + pad, d.source.x!, d.source.y!)[1]);

        nodeElements.attr("transform", (d) => `translate(${d.x},${d.y})`);
      });

    // Restart gently — first tick paints the pre-settled positions
    simulation.alpha(0.1).restart();

    simulationRef.current = simulation;
  }, [thoughts, edges, height]);

  const applyForceParams = useCallback(() => {
    const sim = simulationRef.current;
    if (!sim) return;
    const p = forceParamsRef.current;

    const linkForce = sim.force("link") as ReturnType<typeof forceLink<GraphNode, GraphLink>> | undefined;
    if (linkForce) {
      linkForce.strength(p.linkStrength).distance(p.linkDistance);
    }

    const chargeForce = sim.force("charge") as ReturnType<typeof forceManyBody<GraphNode>> | undefined;
    if (chargeForce) {
      chargeForce.strength(p.chargeStrength);
    }

    const xForce = sim.force("x") as ReturnType<typeof forceX<GraphNode>> | undefined;
    if (xForce) xForce.strength(p.centerXStrength);

    const yForce = sim.force("y") as ReturnType<typeof forceY<GraphNode>> | undefined;
    if (yForce) yForce.strength(p.centerYStrength);

    // Collision padding requires rebuilding the force (it's a closure)
    const nodes = sim.nodes();
    sim.force("rectCollide", forceRectCollide(nodes, p.collisionPadX, p.collisionPadY));

    sim.alphaDecay(p.alphaDecay).velocityDecay(p.velocityDecay);
    sim.alpha(0.3).restart();
  }, []);

  useTweakpane(forceParamsRef, applyForceParams);

  useEffect(() => {
    // Wait for fonts before measuring text
    document.fonts.ready.then(buildGraph);

    return () => {
      simulationRef.current?.stop();
    };
  }, [buildGraph]);

  // Resize handler
  useEffect(() => {
    const onResize = () => {
      simulationRef.current?.stop();
      setHeight(getHeight());
      buildGraph();
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [buildGraph, getHeight]);

  // Reset click underlines when returning via bfcache (back/forward navigation)
  useEffect(() => {
    const onPageShow = (e: PageTransitionEvent) => {
      if (e.persisted && containerRef.current) {
        select(containerRef.current)
          .selectAll(".click-underline")
          .attr("stroke-opacity", 0)
          .attr("x1", 0)
          .attr("x2", 0);
      }
    };
    window.addEventListener("pageshow", onPageShow);
    return () => window.removeEventListener("pageshow", onPageShow);
  }, []);

  return <div ref={containerRef} className="thought-graph-container" style={{ width: "100%", height }} />;
}
