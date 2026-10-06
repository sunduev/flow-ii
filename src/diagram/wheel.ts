import { clampDiagramScale, type ZoomPoint } from './zoom.js';

/** Alt/Option + вертикальное колесо плавно масштабирует вокруг курсора. */
export function enableDiagramWheelZoom(
  host: HTMLElement,
  getScale: () => number,
  onZoom: (scale: number, point: ZoomPoint) => void,
): void {
  host.addEventListener('wheel', event => {
    if (!event.altKey || event.ctrlKey || event.metaKey || event.shiftKey || !event.cancelable) return;
    if (event.deltaY === 0 || Math.abs(event.deltaX) > Math.abs(event.deltaY) || !host.querySelector('.diagram-stage')) return;
    const bounds = host.getBoundingClientRect();
    const point = { x: event.clientX - bounds.left - host.clientLeft, y: event.clientY - bounds.top - host.clientTop };
    if (point.x < 0 || point.y < 0 || point.x >= host.clientWidth || point.y >= host.clientHeight) return;
    event.preventDefault();
    const pixels = event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? host.clientHeight : 1);
    const previous = getScale();
    const scale = clampDiagramScale(previous * Math.exp(-pixels * .002));
    if (scale !== previous) onZoom(scale, point);
  }, { passive: false });
}
