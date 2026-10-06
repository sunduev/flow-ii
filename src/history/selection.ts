import { getPlayerHistory, type HistoryIndex, type PlayerHistory } from './index.js';
export interface Selection { participationId: string | null; playerId: string | null; allRosters: boolean }
export function initialSelection(index: HistoryIndex): Selection {
  const latest = index.editions.at(-1);
  return { participationId: latest ? index.participationsByEdition.get(latest.id)![0]?.id ?? null : null, playerId: null, allRosters: false };
}
export function selectParticipation(state: Selection, participationId: string): Selection {
  return { ...state, participationId, playerId: null };
}
export function selectPlayer(state: Selection, playerId: string | null): Selection { return { ...state, playerId }; }
export function togglePlayer(state: Selection, playerId: string): Selection {
  return selectPlayer(state, state.playerId === playerId ? null : playerId);
}
/** Общий режим объединяет составы по ID команды, независимо от года и фильтра. */
export function getSelectionPlayerIds(index: HistoryIndex, selection: Selection): readonly string[] {
  if (!selection.participationId) return [];
  const active = index.participationById.get(selection.participationId)!;
  if (!selection.allRosters) return active.playerIds;
  return [...new Set(index.participationsByTeam.get(active.teamId)!.flatMap(item => item.playerIds))].sort();
}
export function getSelectionHistories(index: HistoryIndex, selection: Selection): PlayerHistory[] {
  return getSelectionPlayerIds(index, selection).map(id => getPlayerHistory(index, id));
}
export function setAllRosters(index: HistoryIndex, state: Selection, allRosters: boolean): Selection {
  const next = { ...state, allRosters };
  if (next.playerId && !getSelectionPlayerIds(index, next).includes(next.playerId)) next.playerId = null;
  return next;
}
export interface ParticipationRelation { sameTeam: boolean; additional: boolean }
/** Пунктир рамки определяется исходным составом, даже при фильтре одного игрока. */
export function getSelectionRelations(index: HistoryIndex, selection: Selection): ReadonlyMap<string, ParticipationRelation> {
  const relations = new Map<string, ParticipationRelation>();
  if (!selection.participationId) return relations;
  const active = index.participationById.get(selection.participationId)!;
  const originalIds = new Set(active.playerIds);
  for (const id of getSelectionPlayerIds(index, selection)) {
    if (selection.playerId && id !== selection.playerId) continue;
    for (const participation of index.participationsByPlayer.get(id)!) {
      if (relations.has(participation.id)) continue;
      relations.set(participation.id, {
        sameTeam: participation.teamId === active.teamId,
        additional: selection.allRosters && !participation.playerIds.some(playerId => originalIds.has(playerId)),
      });
    }
  }
  return relations;
}
/** Общие игроки конкретного участия, только из показанного набора цепочек. */
export function getSharedRosterPlayerIds(index: HistoryIndex, selection: Selection, participationId: string): string[] {
  const targetIds = new Set(index.participationById.get(participationId)!.playerIds);
  return getSelectionPlayerIds(index, selection).filter(id => (!selection.playerId || id === selection.playerId) && targetIds.has(id));
}
/** В общем режиме любое участие выбранной команды открывает состав конкретного года. */
export function isRosterParticipation(index: HistoryIndex, selection: Selection, participationId: string): boolean {
  if (!selection.participationId) return false;
  return participationId === selection.participationId || (selection.allRosters &&
    index.participationById.get(participationId)!.teamId === index.participationById.get(selection.participationId)!.teamId);
}
export function getTeamInfoPlayerIds(index: HistoryIndex, selection: Selection, participationId: string): readonly string[] {
  if (isRosterParticipation(index, selection, participationId)) return index.participationById.get(participationId)!.playerIds;
  return getSharedRosterPlayerIds(index, selection, participationId);
}
export function playerLabel(index: HistoryIndex, id: string): string {
  const name = index.playerById.get(id)!.name;
  return [...index.playerById.values()].filter(player => player.name === name).length > 1 ? `${name} · ID ${id}` : name;
}
const playerPalette = ['#2455b8', '#d45100', '#863ab5', '#008577', '#c52f53', '#927000', '#453d80', '#26752b', '#a34b33', '#176f91'];
export function createPlayerColors(playerIds: readonly string[]): Map<string, string> {
  // Полный выбранный набор задаёт цвета и в карточке, и в SVG независимо от фильтра/выделения.
  return new Map([...playerIds].sort().map((id, position) => [
    id,
    playerPalette[position] ?? `hsl(${((position - playerPalette.length) * 137.508) % 360} 70% 32%)`,
  ]));
}
