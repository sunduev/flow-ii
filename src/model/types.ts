/** Схема версии 1: docs/data-contract.md. ID не зависят от имён. */
export interface Edition {
  id: string;
  year: number;
  name: string;
  /** ID турнира на rating.chgk.info; отсутствует у старых демонстрационных данных. */
  tournamentId?: string;
}

export interface Team {
  id: string;
  name: string;
}

export interface Player {
  id: string;
  /** Отображаемая подпись «Фамилия И.» без отчества и полного имени. */
  name: string;
}

export interface Participation {
  id: string;
  editionId: string;
  teamId: string;
  /** Название команды именно на этом проведении. */
  displayName: string;
  /** Дробные и равные места сохраняются без округления. */
  place: number;
  /** Весь исторический состав без ограничения размера. */
  playerIds: string[];
}

export interface TournamentHistory {
  schemaVersion: 1;
  editions: Edition[];
  teams: Team[];
  players: Player[];
  participations: Participation[];
}
