"use client";
import { useEffect, useRef, useState } from "react";
import { BrandMark } from "./brand";

type Position = { x: number; y: number; width: number; height: number; animate: boolean };
/** Decorative only: aria-current and the original controls remain authoritative. */
export default function AnimatedNavIndicator({ hanging = false }: { hanging?: boolean }) {
  const charm = useRef<HTMLSpanElement>(null);
  const marker = useRef<HTMLSpanElement>(null);
  const [position, setPosition] = useState<Position | null>(null);
  useEffect(() => {
    const host = marker.current?.parentElement;
    if (!host) return;
    let frame = 0;
    const measure = () => {
      frame = 0;
      const selected = host.querySelector<HTMLElement>(":scope > [aria-current='page']");
      if (!selected || !selected.offsetWidth || !selected.offsetHeight) { setPosition(null); return; }
      const next = { x: selected.offsetLeft, y: selected.offsetTop, width: selected.offsetWidth, height: selected.offsetHeight };
      setPosition(previous => previous && previous.x === next.x && previous.y === next.y && previous.width === next.width && previous.height === next.height ? previous : { ...next, animate: Boolean(previous) });
    };
    const schedule = () => { if (!frame) frame = requestAnimationFrame(measure); };
    const mutations = new MutationObserver(schedule);
    mutations.observe(host, { subtree: true, childList: true, attributes: true, attributeFilter: ["aria-current"] });
    const resize = new ResizeObserver(schedule);
    resize.observe(host);
    window.addEventListener("resize", schedule);
    schedule();
    return () => { cancelAnimationFrame(frame); mutations.disconnect(); resize.disconnect(); window.removeEventListener("resize", schedule); };
  }, []);
  useEffect(() => {
    if (!hanging || !position?.animate || !charm.current || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const swing = charm.current.animate([
      { transform: "rotate(-22deg)" }, { transform: "rotate(15deg)", offset: .3 },
      { transform: "rotate(-8deg)", offset: .55 }, { transform: "rotate(4deg)", offset: .78 },
      { transform: "rotate(0deg)" }
    ], { duration: 680, easing: "ease-out" });
    return () => swing.cancel();
  }, [hanging, position]);
  return <span ref={marker} className={`pc-selection-light${hanging ? " pc-hanging-light" : ""}`} aria-hidden="true" data-ready={Boolean(position)} data-motion={position?.animate ?? false} style={position ? { transform: `translate3d(${position.x}px, ${position.y}px, 0)`, width: position.width, height: position.height } : undefined}><span ref={charm} className="pc-hanging-charm">{hanging ? <BrandMark /> : null}</span></span>;
}
