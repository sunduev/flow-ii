export interface ViewportSize { width: number; height: number }

/** Несколько событий до отрисовки используют одно обновление с актуальным состоянием. */
export function createFrameUpdate(
  update: () => void,
  request: (callback: FrameRequestCallback) => number,
  cancel: (id: number) => void,
): { schedule: () => void; cancel: () => void } {
  let frame: number | null = null;
  return {
    schedule() {
      if (frame !== null) return;
      frame = request(() => { frame = null; update(); });
    },
    cancel() {
      if (frame !== null) cancel(frame);
      frame = null;
    },
  };
}

export function shouldCloseOnResize(previous: ViewportSize, next: ViewportSize, mobile: boolean): boolean {
  return previous.width !== next.width || (!mobile && previous.height !== next.height);
}

export function shouldCloseOnScroll(origin: 'card' | 'diagram' | 'page', mobile: boolean): boolean {
  return origin !== 'card' && !mobile;
}

/** Путь click сохраняет карточку даже после замены её списка в обработчике игрока. */
export function shouldCloseOnOutsideClick(path: readonly EventTarget[], card: EventTarget, infoButton: boolean): boolean {
  return !path.includes(card) && !infoButton;
}
