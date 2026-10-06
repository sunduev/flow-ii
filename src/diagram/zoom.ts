export interface ZoomPoint { x: number; y: number }

export interface ZoomViewport {
  left: number; top: number; width: number; height: number;
  diagramWidth: number; diagramHeight: number;
}

/** Сохраняет центр либо помещает точку клика в центр, с ограничением на краях. */
export function zoomScroll(view: ZoomViewport, previousScale: number, scale: number, point?: ZoomPoint): { left: number; top: number } {
  function axis(offset: number, viewport: number, diagram: number, anchor: number): number {
    const next = (offset + anchor) / previousScale * scale - viewport / 2;
    return Math.max(0, Math.min(next, diagram * scale - viewport));
  }
  return { left: axis(view.left, view.width, view.diagramWidth, point?.x ?? view.width / 2), top: axis(view.top, view.height, view.diagramHeight, point?.y ?? view.height / 2) };
}

export function sizeDiagramStage(stage: HTMLElement, svg: SVGSVGElement, scale: number): void {
  stage.style.width = `${Number(svg.getAttribute('width')) * scale}px`;
  stage.style.height = `${Number(svg.getAttribute('height')) * scale}px`;
  svg.style.transform = `scale(${scale})`;
  const header = stage.previousElementSibling as HTMLElement | null;
  const years = header?.querySelector('svg');
  if (header && years) {
    header.style.width = stage.style.width;
    header.style.setProperty('--year-height', `${Number(years.getAttribute('height')) * scale}px`);
    years.style.transform = svg.style.transform;
  }
}

/** Меняет только размеры обёртки, transform SVG и прокрутку. */
export function zoomDiagram(host: HTMLElement, previousScale: number, scale: number, point?: ZoomPoint): void {
  const stage = host.querySelector<HTMLElement>('.diagram-stage');
  const svg = stage?.querySelector('svg');
  if (!stage || !svg) return;
  const scroll = zoomScroll({
    left: host.scrollLeft, top: host.scrollTop, width: host.clientWidth, height: host.clientHeight,
    diagramWidth: Number(svg.getAttribute('width')), diagramHeight: Number(svg.getAttribute('height')),
  }, previousScale, scale, point);
  sizeDiagramStage(stage, svg, scale);
  host.scrollLeft = scroll.left;
  host.scrollTop = scroll.top;
}

/** Первый клик выбирает команду; второй приближает без повторной отрисовки. */
export function enableDiagramDoubleClickZoom(host: HTMLElement, getScale: () => number, onZoom: (point: ZoomPoint) => void): void {
  function zoom(event: MouseEvent): void {
    if (getScale() >= 1 || event.button !== 0 || event.detail !== 2) return;
    const target = event.target as Element | null;
    if (!target?.closest || target.closest('a, button') || !host.querySelector('.diagram-stage')) return;
    const bounds = host.getBoundingClientRect();
    const point = { x: event.clientX - bounds.left - host.clientLeft, y: event.clientY - bounds.top - host.clientTop };
    if (point.x < 0 || point.y < 0 || point.x >= host.clientWidth || point.y >= host.clientHeight) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    onZoom(point);
  }
  // После первого выбора SVG заменяется: ловим второй click до обработчика узла.
  host.addEventListener('click', zoom, true);
  host.addEventListener('dblclick', zoom, true);
}
