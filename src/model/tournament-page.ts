export interface TournamentPage {
  slug: string;
  name: string;
  /** URL относительно каталога сайта. */
  history: string;
}

export interface TournamentRoutes {
  defaultTournament: string;
  tournaments: readonly TournamentPage[];
}

/** Выбирает одну серию по адресу страницы; не читает её или чужие данные. */
export function resolveTournamentPage(pathname: string, sitePath: string, routes: TournamentRoutes):
  { redirect: string } | { tournament: TournamentPage } {
  if (pathname === sitePath || pathname === `${sitePath}index.html`) {
    return { redirect: `${sitePath}${routes.defaultTournament}/` };
  }
  if (pathname.startsWith(sitePath)) {
    const path = pathname.slice(sitePath.length);
    const tournament = routes.tournaments.find(item => path === item.slug || path === `${item.slug}/` || path === `${item.slug}/index.html`);
    if (tournament) return path === tournament.slug
      ? { redirect: `${sitePath}${tournament.slug}/` }
      : { tournament };
  }
  throw new Error('Турнир не найден.');
}
