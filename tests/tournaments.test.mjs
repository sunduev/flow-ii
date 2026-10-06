import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtemp, mkdir, writeFile, readFile, rm, access } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import ExcelJS from 'exceljs';
import { writeSitePages } from '../.script-build/scripts/site-pages.js';
import { writeTournament } from '../.script-build/scripts/convert-xlsx.js';

const robots = '<meta name="robots" content="noindex, nofollow">';

const registry = {
  defaultTournament: 'chr',
  tournaments: [
    { slug: 'chr', name: 'ЧР', sources: 'data/tournaments/chr/sources.json', history: 'data/chr/history.json' },
    { slug: 'second', name: 'Второй & "турнир"', sources: 'data/tournaments/second/sources.json', history: 'data/second/history.json' },
    { slug: 'third', name: 'Третий', sources: 'data/tournaments/third/sources.json', history: 'data/third/history.json' },
  ],
};

async function setup(root) {
  await mkdir(join(root, 'data'), { recursive: true });
  await writeFile(join(root, 'data/tournaments.json'), JSON.stringify(registry));
}

test('Три страницы копируются из готового HTML; ресурсы работают с абсолютным и относительным base', async () => {
  const root = await mkdtemp(join(tmpdir(), 'chr-flow-pages-'));
  try {
    await setup(root);
    for (const base of ['./', '/flow-ii/']) {
      const out = join(root, 'dist');
      await rm(out, { recursive: true, force: true });
      await mkdir(join(out, 'assets'), { recursive: true });
      const script = '<script type="module" crossorigin src="' + base + 'assets/index-test.js"></script>';
      const css = '<link rel="stylesheet" crossorigin href="' + base + 'assets/index-test.css">';
      const preload = '<link rel="modulepreload" crossorigin href="' + base + 'assets/shared-test.js">';
      await writeFile(join(out, 'index.html'), '<!doctype html><html><head>' + robots + '<title>Инфографика</title>' + script + css + preload + '</head><body><main>Общее приложение</main></body></html>');
      await writeFile(join(out, 'assets/index-test.js'), 'общий JS');
      await writeSitePages(root, out);
      for (const { slug, name } of registry.tournaments) {
        const html = await readFile(join(out, slug, 'index.html'), 'utf8');
        const escapedName = name.replaceAll('&', '&amp;').replaceAll('"', '&quot;');
        assert.ok(html.includes(`<title>Инфографика ${escapedName}</title>`));
        const assetBase = base === './' ? '../' : base;
        assert.ok(html.includes(`src="${assetBase}assets/index-test.js"`));
        assert.ok(html.includes(`href="${assetBase}assets/index-test.css"`));
        assert.ok(html.includes(`href="${assetBase}assets/shared-test.js"`));
        assert.ok(html.includes('Общее приложение'));
        assert.equal(html.match(/<meta name="robots"[^>]*>/g)?.length, 1);
        assert.ok(html.slice(0, html.indexOf('</head>')).includes(robots));
        for (const other of registry.tournaments.filter(t => t.slug !== slug)) {
          assert.ok(!html.includes(`data/${other.slug}/history.json`));
        }
        assert.ok(!html.includes('sources.json'));
      }
      const redirect = await readFile(join(out, 'index.html'), 'utf8');
      assert.equal(redirect.match(/<meta name="robots"[^>]*>/g)?.length, 1);
      assert.ok(redirect.slice(0, redirect.indexOf('</head>')).includes(robots));
      assert.ok(redirect.includes('location.replace'));
      assert.ok(redirect.includes('./chr/'));
      assert.ok(redirect.includes('location.search + location.hash'));
      assert.ok(!redirect.includes('assets/index-test.js'));
      assert.ok(!redirect.includes('history.json'));
      assert.equal(await readFile(join(out, 'assets/index-test.js'), 'utf8'), 'общий JS');
    }
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('Преобразование выбранного турнира не читает чужие XLSX и не перезаписывает чужой JSON', async () => {
  const root = await mkdtemp(join(tmpdir(), 'chr-flow-tournaments-'));
  try {
    await setup(root);
    for (const [slug, team, player] of [['chr', 'Команда ЧР', 'Иванов'], ['second', 'Другая команда', 'Петров']]) {
      const dir = join(root, 'data/tournaments', slug);
      await mkdir(join(dir, 'source'), { recursive: true });
      const workbook = new ExcelJS.Workbook();
      workbook.addWorksheet('Worksheet').addRows([
        ['Team ID', 'Название', 'Место', 'IDplayer', 'Фамилия', 'Имя', 'Отчество'],
        ['10', team, 1, '20', player, 'Иван', 'Иванович'],
      ]);
      await workbook.xlsx.writeFile(join(dir, 'source/tournament-with-players-100-2026.xlsx'));
      await writeFile(join(dir, 'sources.json'), JSON.stringify({ editions: [{ file: 'source/tournament-with-players-100-2026.xlsx', name: `${slug} — 2026` }] }));
    }
    await writeTournament('chr', root);
    const chrFile = join(root, 'public/data/chr/history.json');
    const before = await readFile(chrFile, 'utf8');
    await rm(join(root, 'data/tournaments/chr/source'), { recursive: true });
    const second = await writeTournament('second', root);
    assert.equal(await readFile(chrFile, 'utf8'), before);
    assert.deepEqual(second.teams, [{ id: '10', name: 'Другая команда' }]);
    assert.deepEqual(second.players, [{ id: '20', name: 'Петров И.' }]);
    assert.equal(second.editions.length, 1);
    assert.deepEqual(JSON.parse(await readFile(join(root, 'public/data/second/history.json'), 'utf8')), second);
    assert.deepEqual(JSON.parse(before).teams, [{ id: '10', name: 'Команда ЧР' }]);
    await assert.rejects(access(join(root, 'public/data/third/history.json')), { code: 'ENOENT' });
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
