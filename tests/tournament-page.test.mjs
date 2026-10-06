import assert from 'node:assert/strict';
import { test } from 'node:test';
import { resolveTournamentPage } from '../.test-build/model/tournament-page.js';
import { loadHistory } from '../.test-build/model/load-history.js';

const routes = { defaultTournament: 'chr', tournaments: [
  { slug: 'chr', name: 'ЧР', history: 'data/chr/history.json' },
  { slug: 'second', name: 'Второй', history: 'data/second/history.json' },
  { slug: 'third', name: 'Третий', history: 'archives/third.json' },
] };

test('Путь выбирает только свою серию, включая index.html и произвольный URL истории', () => {
  assert.deepEqual(resolveTournamentPage('/flow-ii/second/', '/flow-ii/', routes), { tournament: routes.tournaments[1] });
  assert.deepEqual(resolveTournamentPage('/flow-ii/third/index.html', '/flow-ii/', routes), { tournament: routes.tournaments[2] });
  assert.deepEqual(resolveTournamentPage('/full/chr/', '/full/', routes), { tournament: routes.tournaments[0] });
});

test('Корень перенаправляет на ЧР; адрес без слеша нормализуется, неизвестный путь не выбирает чужой турнир', () => {
  assert.deepEqual(resolveTournamentPage('/flow-ii/', '/flow-ii/', routes), { redirect: '/flow-ii/chr/' });
  assert.deepEqual(resolveTournamentPage('/flow-ii/index.html', '/flow-ii/', routes), { redirect: '/flow-ii/chr/' });
  assert.deepEqual(resolveTournamentPage('/flow-ii/second', '/flow-ii/', routes), { redirect: '/flow-ii/second/' });
  for (const pathname of ['/flow-ii/unknown/', '/flow-ii/chr/extra/', '/other/chr/']) {
    assert.throws(() => resolveTournamentPage(pathname, '/flow-ii/', routes), /Турнир не найден/);
  }
});

test('Выбор серии по пути приводит к одному запросу только её JSON', async t => {
  const requests = [];
  const expected = { schemaVersion: 1, editions: [], teams: [], players: [], participations: [] };
  t.mock.method(globalThis, 'fetch', async url => { requests.push(url); return { ok: true, json: async () => expected }; });
  const page = resolveTournamentPage('/flow-ii/second/', '/flow-ii/', routes);
  const url = new URL(page.tournament.history, 'https://example.test/flow-ii/').href;
  assert.deepEqual(await loadHistory(url), expected);
  assert.deepEqual(requests, ['https://example.test/flow-ii/data/second/history.json']);
});


test('Редирект не загружает истории, в том числе при недоступном JSON турнира', async t => {
  const requests = [];
  t.mock.method(globalThis, 'fetch', async url => { requests.push(url); throw new Error('История недоступна'); });
  const page = resolveTournamentPage('/flow-ii/', '/flow-ii/', routes);
  if ('tournament' in page) await loadHistory(page.tournament.history);
  assert.deepEqual(page, { redirect: '/flow-ii/chr/' });
  assert.deepEqual(requests, []);
});
