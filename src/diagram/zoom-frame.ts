import { createFrameUpdate } from './team-info-events.js';
import { clampDiagramScale, type ZoomPoint } from './zoom.js';

/** Объединяет преобразования всех событий до следующего кадра без потери якоря. */
export function createZoomFrameUpdate(
  getScale: () => number,
  apply: (scale: number, anchor: ZoomPoint, destination: ZoomPoint) => void,
  request: (callback: FrameRequestCallback) => number,
  cancel: (id: number) => void,
): {
  getScale: () => number;
  schedule: (scale: number, anchor: ZoomPoint, destination: ZoomPoint) => void;
  cancel: () => void;
} {
  let pending: { scale: number; anchor: ZoomPoint; destination: ZoomPoint } | null = null;
  const samePoint = (a: ZoomPoint, b: ZoomPoint): boolean => Math.abs(a.x - b.x) < 1e-8 && Math.abs(a.y - b.y) < 1e-8;
  const frame = createFrameUpdate(() => {
    const next = pending;
    pending = null;
    if (!next) return;
    if (Math.abs(next.scale - getScale()) < 1e-12 && samePoint(next.anchor, next.destination)) return;
    apply(next.scale, next.anchor, next.destination);
  }, request, cancel);

  return {
    getScale: () => pending?.scale ?? getScale(),
    schedule(scale, anchor, destination) {
      const next = clampDiagramScale(scale);
      const previous = pending?.scale ?? getScale();
      if (next === previous && samePoint(anchor, destination)) return;
      if (pending) {
        const ratio = next / previous;
        // (scroll + anchor) * ratio - destination: композиция сохраняет первый
        // якорь, а новую точку назначения выражает через все события до кадра.
        pending.destination = {
          x: (pending.destination.x - anchor.x) * ratio + destination.x,
          y: (pending.destination.y - anchor.y) * ratio + destination.y,
        };
        pending.scale = next;
      } else {
        pending = { scale: next, anchor, destination };
      }
      frame.schedule();
    },
    cancel() {
      pending = null;
      frame.cancel();
    },
  };
}
