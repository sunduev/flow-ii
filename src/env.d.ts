import type { TournamentRoutes } from './model/tournament-page';

declare global {
  /** Только публичные настройки маршрутов; без sources и данных историй. */
  const __TOURNAMENT_ROUTES__: TournamentRoutes;
}
