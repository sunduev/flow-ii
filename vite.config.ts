import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';
import { sitePages } from './scripts/site-pages.js';
import { readTournamentRegistry } from './scripts/tournaments.js';

export default defineConfig(async () => {
  const root = fileURLToPath(new URL('.', import.meta.url));
  const registry = await readTournamentRegistry(root);
  return {
    base: '/flow-ii/',
    plugins: [sitePages(root)],
    define: { __TOURNAMENT_ROUTES__: JSON.stringify({
      defaultTournament: registry.defaultTournament,
      tournaments: registry.tournaments.map(({ slug, name, history }) => ({ slug, name, history })),
    }) },
  };
});
