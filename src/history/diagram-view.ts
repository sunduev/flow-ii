import type { DiagramData, HistoryIndex } from './index.js';
import { getSelectionHistories, type Selection } from './selection.js';

/** Уплотняется только представление. Годы и исходные связи уже отобраны диапазоном. */
export function getHistoryDiagramData(index: HistoryIndex, data: DiagramData, selection: Selection): DiagramData {
  const histories = getSelectionHistories(index, selection);
  const active = histories.filter(history => !selection.playerId || history.player.id === selection.playerId);
  const playerIds = new Set(active.map(history => history.player.id));
  const participationIds = new Set(active.flatMap(history => history.entries.map(entry => entry.participation.id)));
  return {
    editions: data.editions,
    participationsByEdition: new Map([...data.participationsByEdition].map(([id, entries]) => [id, entries.filter(entry => participationIds.has(entry.id))])),
    playerLinks: data.playerLinks.filter(link => playerIds.has(link.playerId)),
    backgroundLinks: [],
  };
}
