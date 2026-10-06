import type { Edition, Participation, Player, Team, TournamentHistory } from '../model/types.js';

export interface HistoryIndex {
  /** Всегда от старых лет к новым. */
  editions: readonly Edition[];
  editionById: ReadonlyMap<string, Edition>;
  /** Позиция проведения в полной хронологии, независимо от диапазона диаграммы. */
  editionPositionById: ReadonlyMap<string, number>;
  teamById: ReadonlyMap<string, Team>;
  playerById: ReadonlyMap<string, Player>;
  participationById: ReadonlyMap<string, Participation>;
  participationsByEdition: ReadonlyMap<string, readonly Participation[]>;
  participationsByTeam: ReadonlyMap<string, readonly Participation[]>;
  participationsByPlayer: ReadonlyMap<string, readonly Participation[]>;
}

function append<K, V>(map: Map<K, V[]>, key: K, value: V): void {
  const values = map.get(key);
  if (values) values.push(value);
  else map.set(key, [value]);
}

/** Вход считается корректным. Новые массивы не меняют порядок исходного JSON. */
export function createHistoryIndex(data: TournamentHistory): HistoryIndex {
  const editions = [...data.editions].sort((a, b) => a.year - b.year);
  const editionById = new Map(editions.map(edition => [edition.id, edition]));
  const participationsByEdition = new Map(editions.map(edition => [edition.id, [] as Participation[]]));
  const participationsByTeam = new Map(data.teams.map(team => [team.id, [] as Participation[]]));
  const participationsByPlayer = new Map(data.players.map(player => [player.id, [] as Participation[]]));
  const participations = [...data.participations].sort((a, b) =>
    editionById.get(a.editionId)!.year - editionById.get(b.editionId)!.year ||
    a.place - b.place || (a.teamId < b.teamId ? -1 : a.teamId > b.teamId ? 1 : 0));
  for (const participation of participations) {
    append(participationsByEdition, participation.editionId, participation);
    append(participationsByTeam, participation.teamId, participation);
    for (const playerId of participation.playerIds) append(participationsByPlayer, playerId, participation);
  }
  return {
    editions, editionById,
    editionPositionById: new Map(editions.map((edition, position) => [edition.id, position])),
    teamById: new Map(data.teams.map(team => [team.id, team])),
    playerById: new Map(data.players.map(player => [player.id, player])),
    participationById: new Map(participations.map(participation => [participation.id, participation])),
    participationsByEdition, participationsByTeam, participationsByPlayer,
  };
}

export interface HistoryEntry {
  edition: Edition;
  participation: Participation;
}

export interface PlayerLink {
  playerId: string;
  /** Направление всегда от старого участия к новому. */
  sourceId: string;
  targetId: string;
  isGap: boolean;
}

export interface PlayerHistory {
  player: Player;
  entries: readonly HistoryEntry[];
  links: readonly PlayerLink[];
}

export interface BackgroundLink {
  sourceId: string;
  targetId: string;
  isGap: boolean;
  playerIds: readonly string[];
}

export interface HistoryGraph {
  playerLinks: readonly PlayerLink[];
  backgroundLinks: readonly BackgroundLink[];
}

/** Полная цепочка одного известного игрока, независимо от текущего выбора и диапазона. */
export function getPlayerHistory(index: HistoryIndex, playerId: string): PlayerHistory {
  const entries = index.participationsByPlayer.get(playerId)!.map(participation => ({
    participation, edition: index.editionById.get(participation.editionId)!,
  }));
  const links = entries.slice(1).map((target, i) => ({
    playerId,
    sourceId: entries[i].participation.id,
    targetId: target.participation.id,
    isGap: index.editionPositionById.get(target.edition.id)! - index.editionPositionById.get(entries[i].edition.id)! > 1,
  }));
  return { player: index.playerById.get(playerId)!, entries, links };
}

/** Состав именно этого участия; порядок игроков сохраняется из playerIds. */
export function getRosterHistories(index: HistoryIndex, participationId: string): PlayerHistory[] {
  return index.participationById.get(participationId)!.playerIds.map(id => getPlayerHistory(index, id));
}

/** Фон объединяет одинаковые пары концов, не сворачивая историю отдельных игроков. */
export function buildHistoryGraph(index: HistoryIndex): HistoryGraph {
  const playerLinks: PlayerLink[] = [];
  const grouped = new Map<string, Map<string, BackgroundLink & { playerIds: string[] }>>();
  for (const playerId of index.playerById.keys()) {
    for (const link of getPlayerHistory(index, playerId).links) {
      playerLinks.push(link);
      let targets = grouped.get(link.sourceId);
      if (!targets) {
        targets = new Map();
        grouped.set(link.sourceId, targets);
      }
      const background = targets.get(link.targetId);
      if (background) background.playerIds.push(playerId);
      else targets.set(link.targetId, { sourceId: link.sourceId, targetId: link.targetId, isGap: link.isGap, playerIds: [playerId] });
    }
  }
  return { playerLinks, backgroundLinks: [...grouped.values()].flatMap(targets => [...targets.values()]) };
}

export interface YearRange {
  fromYear: number;
  toYear: number;
}

export interface DiagramData extends HistoryGraph {
  /** Только диаграмма разворачивает годы: самый новый слева. */
  editions: readonly Edition[];
  participationsByEdition: ReadonlyMap<string, readonly Participation[]>;
}

/** Отбор существующих фактов и связей. Выбор UI и полные цепочки сюда не передаются. */
export function getDiagramData(index: HistoryIndex, graph: HistoryGraph, range?: YearRange): DiagramData {
  const editions = index.editions.filter(edition =>
    !range || (edition.year >= range.fromYear && edition.year <= range.toYear)).reverse();
  const participationsByEdition = new Map(editions.map(edition =>
    [edition.id, index.participationsByEdition.get(edition.id)!]));
  const visibleIds = new Set([...participationsByEdition.values()].flatMap(items => items.map(item => item.id)));
  const isVisible = (link: PlayerLink | BackgroundLink) => visibleIds.has(link.sourceId) && visibleIds.has(link.targetId);
  return {
    editions, participationsByEdition,
    playerLinks: graph.playerLinks.filter(isVisible),
    backgroundLinks: graph.backgroundLinks.filter(isVisible),
  };
}
