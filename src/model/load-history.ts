import type { TournamentHistory } from './types';

/** Читает готовый JSON. Проверки схемы и исходных фактов не выполняются. */
export async function loadHistory(url: string): Promise<TournamentHistory> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Не удалось загрузить JSON: HTTP ${response.status}`);
  }
  return response.json() as Promise<TournamentHistory>;
}
