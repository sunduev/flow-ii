/** Прокрутка диаграммы перетаскиванием левой кнопкой мыши. */
export function enableDiagramPan(host: HTMLElement): void {
  let gesture: { pointerId: number; x: number; y: number; left: number; top: number; dragging: boolean } | null = null;
  let suppressClick = false;

  function finish(): void {
    const pointerId = gesture?.pointerId;
    gesture = null;
    host.classList.remove('is-pan-ready');
    host.classList.remove('is-panning');
    if (pointerId !== undefined && host.hasPointerCapture(pointerId)) host.releasePointerCapture(pointerId);
  }

  host.addEventListener('pointerdown', event => {
    if (gesture) return;
    suppressClick = false;
    if (event.pointerType !== 'mouse' || event.button !== 0) return;
    // Полосы прокрутки сохраняют собственное поведение.
    const bounds = host.getBoundingClientRect();
    const x = event.clientX - bounds.left - host.clientLeft;
    const y = event.clientY - bounds.top - host.clientTop;
    if (x < 0 || y < 0 || x >= host.clientWidth || y >= host.clientHeight) return;
    gesture = { pointerId: event.pointerId, x: event.clientX, y: event.clientY, left: host.scrollLeft, top: host.scrollTop, dragging: false };
    host.classList.add('is-pan-ready');
  });
  host.addEventListener('dragstart', event => {
    if (gesture) event.preventDefault();
  });

  host.ownerDocument.addEventListener('pointermove', event => {
    if (!gesture || gesture.pointerId !== event.pointerId) return;
    if (!(event.buttons & 1)) { finish(); return; }
    const dx = event.clientX - gesture.x;
    const dy = event.clientY - gesture.y;
    if (!gesture.dragging) {
      if (Math.hypot(dx, dy) < 5) return;
      gesture.dragging = true;
      suppressClick = true;
      // Захват после порога сохраняет исходную цель обычного клика.
      host.setPointerCapture(event.pointerId);
      host.classList.add('is-panning');
    }
    event.preventDefault();
    host.scrollLeft = gesture.left - dx;
    host.scrollTop = gesture.top - dy;
  });
  for (const type of ['pointerup', 'pointercancel'] as const) {
    host.ownerDocument.addEventListener(type, event => {
      if (gesture?.pointerId === event.pointerId) finish();
    });
  }
  host.addEventListener('lostpointercapture', event => {
    if (gesture?.pointerId === event.pointerId) finish();
  });
  host.addEventListener('click', event => {
    if (!suppressClick || event.detail === 0) return;
    suppressClick = false;
    event.preventDefault();
    event.stopImmediatePropagation();
  }, true);
}
