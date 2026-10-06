import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import type { Plugin } from 'vite';
import { getTournament, readTournamentRegistry } from './tournaments.js';

const escapeHtml = (value: string): string => value.replace(/[&<>"']/g, char => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
})[char]!);

/** Один дополнительный шаг после обычной сборки Vite. */
export function sitePages(root: string): Plugin {
  let outDir = resolve(root, 'dist');
  return {
    name: 'tournament-static-pages',
    apply: 'build',
    configResolved(config) { outDir = resolve(config.root, config.build.outDir); },
    async closeBundle() { await writeSitePages(root, outDir); },
  };
}

/** Раскладывает уже собранный HTML. Vite имеет только одну точку входа. */
export async function writeSitePages(root: string, outDir: string): Promise<void> {
  const registry = await readTournamentRegistry(root);
  const template = await readFile(resolve(outDir, 'index.html'), 'utf8');
  for (const tournament of registry.tournaments) {
    const dir = resolve(outDir, tournament.slug);
    const html = template
      .replace(/<title>[\s\S]*?<\/title>/, () => `<title>Инфографика ${escapeHtml(tournament.name)}</title>`)
      .replace(/\b(src|href)="\.\/([^"]*)"/g, '$1="../$2"');
    await mkdir(dir, { recursive: true });
    await writeFile(resolve(dir, 'index.html'), html, 'utf8');
  }
  const redirectUrl = `./${getTournament(registry, registry.defaultTournament).slug}/`;
  const redirect = `<!doctype html><html lang="ru"><head><meta charset="UTF-8"><meta name="robots" content="noindex, nofollow"><meta name="viewport" content="width=device-width, initial-scale=1.0"><meta http-equiv="refresh" content="0;url=${escapeHtml(redirectUrl)}"><title>Инфографика</title></head><body><p>Переходим к истории турнира…</p><script>location.replace(${JSON.stringify(redirectUrl).replaceAll('<', '\\u003c')} + location.search + location.hash);</script></body></html>\n`;
  await writeFile(resolve(outDir, 'index.html'), redirect, 'utf8');
}
