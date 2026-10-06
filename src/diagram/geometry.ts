export interface DiagramSize { width: number; height: number }
export function diagramDimensions(rowsPerEdition: readonly number[]): DiagramSize {
  return { width: Math.max(236, rowsPerEdition.length * 236), height: 75 + Math.max(0, ...rowsPerEdition) * 42 };
}
