import { clampDiagramScale, type ZoomPoint } from './zoom.js';

/** Два пальца масштабируют SVG; одиночные касания сохраняют нативную прокрутку. */
export function enableDiagramPinchZoom(
  host: HTMLElement,
  getScale: () => number,
  onZoom: (scale: number, anchor: ZoomPoint, destination: ZoomPoint) => void,
  onStart: () => void,
): void {
  let gesture: { ids: number[]; distance: number; scale: number; point: ZoomPoint } | null = null;
  let claimed = false;
  let suppressClick = false;

  function measure(touches: TouchList): { distance: number; point: ZoomPoint } {
    const [a, b] = Array.from(touches);
    const bounds = host.getBoundingClientRect();
    return {
      distance: Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY),
      point: {
        x: (a.clientX + b.clientX) / 2 - bounds.left - host.clientLeft,
        y: (a.clientY + b.clientY) / 2 - bounds.top - host.clientTop,
      },
    };
  }

  host.addEventListener('touchstart', event => {
    if (claimed) {
      if (event.cancelable) event.preventDefault();
      gesture = null;
      return;
    }
    suppressClick = false;
    if (!event.cancelable || event.touches.length !== 2 || !host.querySelector('.diagram-stage')) return;
    if (!Array.from(event.touches).every(touch => host.contains(touch.target as Node))) return;
    const { distance, point } = measure(event.touches);
    if (distance === 0) return;
    event.preventDefault();
    claimed = suppressClick = true;
    gesture = { ids: Array.from(event.touches, touch => touch.identifier), distance, scale: getScale(), point };
    onStart();
  }, { passive: false });

  host.addEventListener('touchmove', event => {
    if (!claimed) return;
    // Если браузер уже забрал жест, не меняем одновременно масштаб диаграммы.
    if (!event.cancelable) { gesture = null; return; }
    event.preventDefault();
    const active = gesture;
    if (!active) return;
    if (event.touches.length !== 2 || !Array.from(event.touches).every(touch => active.ids.includes(touch.identifier))) {
      gesture = null;
      return;
    }
    const { distance, point } = measure(event.touches);
    const scale = clampDiagramScale(active.scale * distance / active.distance);
    onZoom(scale, active.point, point);
    active.point = point;
  }, { passive: false });

  for (const type of ['touchend', 'touchcancel'] as const) {
    host.ownerDocument.addEventListener(type, event => {
      if (!claimed) return;
      // Оставшийся палец не превращается в новый pan или tap до конца жеста.
      gesture = null;
      if (event.touches.length === 0) claimed = false;
    }, { passive: true });
  }
  host.addEventListener('click', event => {
    if (!suppressClick || event.detail === 0) return;
    suppressClick = false;
    event.preventDefault();
    event.stopImmediatePropagation();
  }, true);
}
