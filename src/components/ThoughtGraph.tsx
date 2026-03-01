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
import type { PublicThought, ThoughtEdge } from "../lib/types";

interface GraphNode extends SimulationNodeDatum {
  id: string;
  title: string;
  connected: boolean;
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

export default function ThoughtGraph({ thoughts, edges, fillViewport }: ThoughtGraphProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const simulationRef = useRef<ReturnType<typeof forceSimulation<GraphNode>> | null>(null);

  const fallbackHeight = Math.max(400, Math.min(thoughts.length * 60, 600));

  const getHeight = useCallback(() => {
    if (!fillViewport || typeof window === "undefined") return fallbackHeight;
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
      textWidth: textWidths.get(t.slug) ?? 60,
      x: width * 0.2 + Math.random() * width * 0.6,
      y: height * 0.2 + Math.random() * height * 0.6,
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
      .style("fill", (d) => (d.connected ? "var(--ink-dark)" : "var(--ink-medium)"))
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
          .style("fill", (n) =>
            (n as GraphNode).connected ? "var(--ink-dark)" : "var(--ink-medium)"
          )
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
    const simulation = forceSimulation<GraphNode>(nodes)
      .force(
        "link",
        forceLink<GraphNode, GraphLink>(links)
          .id((d) => d.id)
          .strength(0.1)
          .distance(20)
      )
      .force("charge", forceManyBody<GraphNode>().strength(0))
      .force("x", forceX<GraphNode>(width / 2).strength(0.02))
      .force("y", forceY<GraphNode>(height / 2).strength(0.02))
      .force("rectCollide", forceRectCollide(nodes, 24, 18))
      .alphaDecay(0.02)
      .velocityDecay(0.2)
      .on("tick", () => {
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
        for (const d of nodes) {
          const hw = d.textWidth / 2 + pad;
          const hh = textHeight / 2 + pad;
          d.x = Math.max(hw, Math.min(width - hw, d.x!));
          d.y = Math.max(hh, Math.min(height - hh, d.y!));
        }

        linkElements
          .attr("x1", (d) => clipToBox(d.source.x!, d.source.y!, d.source.textWidth / 2 + pad, textHeight / 2 + pad, d.target.x!, d.target.y!)[0])
          .attr("y1", (d) => clipToBox(d.source.x!, d.source.y!, d.source.textWidth / 2 + pad, textHeight / 2 + pad, d.target.x!, d.target.y!)[1])
          .attr("x2", (d) => clipToBox(d.target.x!, d.target.y!, d.target.textWidth / 2 + pad, textHeight / 2 + pad, d.source.x!, d.source.y!)[0])
          .attr("y2", (d) => clipToBox(d.target.x!, d.target.y!, d.target.textWidth / 2 + pad, textHeight / 2 + pad, d.source.x!, d.source.y!)[1]);

        nodeElements.attr("transform", (d) => `translate(${d.x},${d.y})`);
      });

    simulationRef.current = simulation;
  }, [thoughts, edges, height]);

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
