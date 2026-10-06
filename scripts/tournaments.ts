import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

export interface TournamentConfig {
  /** Ключ серии и каталог страницы; не ID ежегодного проведения на rating.chgk.info. */
  slug: string;
  name: string;
  /** Путь относительно корня проекта. */
  sources: string;
  /** Путь относительно public/. */
  history: string;
}

export interface TournamentRegistry {
  defaultTournament: string;
  tournaments: TournamentConfig[];
}

/** Полный реестр для сборки и CLI; браузеру передаются только публичные настройки маршрутов. */
export async function readTournamentRegistry(root: string): Promise<TournamentRegistry> {
  return JSON.parse(await readFile(resolve(root, 'data/tournaments.json'), 'utf8')) as TournamentRegistry;
}

export function getTournament(registry: TournamentRegistry, slug: string): TournamentConfig {
  const tournament = registry.tournaments.find(item => item.slug === slug);
  if (!tournament) throw new Error(`Неизвестный турнир: ${slug}`);
  return tournament;
}
