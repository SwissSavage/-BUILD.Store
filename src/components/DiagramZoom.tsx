"use client";

import { Minus, Plus, RotateCcw } from "lucide-react";
import { useRef, useState, type KeyboardEvent, type PointerEvent, type ReactNode } from "react";

type Point = { x: number; y: number };
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

export function DiagramZoom({ children }: { children: ReactNode }) {
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState<Point>({ x: 0, y: 0 });
  const viewport = useRef<HTMLDivElement>(null);
  const pointers = useRef(new Map<number, Point>());
  const pinch = useRef<{ distance: number; zoom: number } | null>(null);
  const zoomRef = useRef(1);

  function updateZoom(value: number) {
    const next = clamp(value, 1, 4);
    zoomRef.current = next;
    setZoom(next);
    if (next === 1) setOffset({ x: 0, y: 0 });
    else setOffset((current) => bound(current, next));
  }

  function bound(point: Point, scale: number): Point {
    const box = viewport.current?.getBoundingClientRect();
    if (!box) return point;
    const x = (box.width * (scale - 1)) / 2;
    const y = (box.height * (scale - 1)) / 2;
    return { x: clamp(point.x, -x, x), y: clamp(point.y, -y, y) };
  }

  function distance() {
    const [a, b] = Array.from(pointers.current.values());
    return a && b ? Math.hypot(a.x - b.x, a.y - b.y) : 0;
  }

  function pointerDown(event: PointerEvent<HTMLDivElement>) {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (pointers.current.size === 2) pinch.current = { distance: distance(), zoom: zoomRef.current };
  }

  function pointerMove(event: PointerEvent<HTMLDivElement>) {
    const previous = pointers.current.get(event.pointerId);
    if (!previous) return;
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (pointers.current.size === 2 && pinch.current?.distance) {
      updateZoom(pinch.current.zoom * distance() / pinch.current.distance);
    } else if (pointers.current.size === 1 && zoomRef.current > 1) {
      setOffset((current) => bound({ x: current.x + event.clientX - previous.x, y: current.y + event.clientY - previous.y }, zoomRef.current));
    }
  }

  function pointerEnd(event: PointerEvent<HTMLDivElement>) {
    pointers.current.delete(event.pointerId);
    pinch.current = null;
  }

  function keyDown(event: KeyboardEvent<HTMLDivElement>) {
    const directions: Record<string, Point> = {
      ArrowLeft: { x: 40, y: 0 }, ArrowRight: { x: -40, y: 0 },
      ArrowUp: { x: 0, y: 40 }, ArrowDown: { x: 0, y: -40 },
    };
    const move = directions[event.key];
    if (!move || zoomRef.current === 1) return;
    event.preventDefault();
    setOffset((current) => bound({ x: current.x + move.x, y: current.y + move.y }, zoomRef.current));
  }

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm leading-relaxed text-ink-muted">Pinch or use the controls to zoom; drag or use arrow keys to move around.</p>
        <div className="flex items-center gap-2" aria-label="Diagram zoom controls">
          <button type="button" onClick={() => updateZoom(zoomRef.current - 0.5)} disabled={zoom <= 1} aria-label="Zoom out" className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-[var(--surface-border)] text-ink hover:bg-[var(--surface-elevated)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-blue disabled:opacity-40"><Minus size={17} aria-hidden="true" /></button>
          <span className="w-12 text-center text-sm tabular-nums text-ink-muted" aria-live="polite">{Math.round(zoom * 100)}%</span>
          <button type="button" onClick={() => updateZoom(zoomRef.current + 0.5)} disabled={zoom >= 4} aria-label="Zoom in" className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-[var(--surface-border)] text-ink hover:bg-[var(--surface-elevated)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-blue disabled:opacity-40"><Plus size={17} aria-hidden="true" /></button>
          <button type="button" onClick={() => updateZoom(1)} disabled={zoom === 1} aria-label="Reset zoom" className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-[var(--surface-border)] text-ink hover:bg-[var(--surface-elevated)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-blue disabled:opacity-40"><RotateCcw size={16} aria-hidden="true" /></button>
        </div>
      </div>
      <div ref={viewport} role="region" tabIndex={0} onKeyDown={keyDown} onPointerDown={pointerDown} onPointerMove={pointerMove} onPointerUp={pointerEnd} onPointerCancel={pointerEnd} onLostPointerCapture={pointerEnd} style={{ touchAction: "none", cursor: zoom > 1 ? "grab" : "default" }} className="relative overflow-hidden rounded-2xl select-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-blue" aria-label="Venture Labor diagram">
        <div style={{ transform: `translate(${offset.x}px, ${offset.y}px) scale(${zoom})`, transformOrigin: "center" }} className="will-change-transform">{children}</div>
      </div>
    </div>
  );
}
