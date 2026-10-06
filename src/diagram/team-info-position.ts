export interface TeamInfoViewport {
  left: number;
  top: number;
  width: number;
  height: number;
  scale: number;
}

/** Размер в CSS px до компенсации нативного pinch zoom. */
export function teamInfoSize(viewport: TeamInfoViewport, mobile = false, bottomInset = 12): { width: number; maxHeight: number; scale: number } {
  const width = viewport.width * viewport.scale - 24;
  const height = viewport.height * viewport.scale;
  return {
    width: mobile ? width : Math.min(360, width),
    maxHeight: mobile ? Math.min(height - 12 - bottomInset, height * 0.65) : height - 24,
    scale: 1 / viewport.scale,
  };
}

/** Якорь и результат — координаты layout viewport; границы — visual viewport. */
export function teamInfoPosition(
  anchor: { left: number; right: number; top: number; bottom: number },
  card: { width: number; height: number },
  viewport: TeamInfoViewport,
  mobile = false,
  bottomInset = 12,
): { left: number; top: number } {
  const margin = 12 / viewport.scale;
  const gap = 10 / viewport.scale;
  const width = card.width / viewport.scale;
  const height = card.height / viewport.scale;
  const minLeft = viewport.left + margin;
  const minTop = viewport.top + margin;
  const maxRight = viewport.left + viewport.width - margin;
  const maxBottom = viewport.top + viewport.height - margin;
  if (mobile) {
    return {
      left: viewport.left + (viewport.width - width) / 2,
      top: Math.max(minTop, viewport.top + viewport.height - bottomInset / viewport.scale - height),
    };
  }
  let left = anchor.right + gap;
  let top = anchor.top;
  if (left + width > maxRight) {
    left = anchor.left - width - gap;
    if (left < minLeft) {
      left = anchor.right - width;
      top = anchor.bottom + gap;
      if (top + height > maxBottom) top = anchor.top - height - gap;
    }
  }
  return {
    left: Math.max(minLeft, Math.min(left, maxRight - width)),
    top: Math.max(minTop, Math.min(top, maxBottom - height)),
  };
}
