import assert from 'node:assert/strict';
import { test } from 'node:test';
import { loadHistory } from '../.test-build/model/load-history.js';

test('Страница запрашивает только указанный JSON, без реестра и историй других турниров', async t => {
  const requests = [];
  const expected = { schemaVersion: 1, editions: [], teams: [], players: [], participations: [] };
  t.mock.method(globalThis, 'fetch', async url => {
    requests.push(url);
    return { ok: true, json: async () => expected };
  });
  assert.deepEqual(await loadHistory('../data/second/history.json'), expected);
  assert.deepEqual(requests, ['../data/second/history.json']);
});

test('Ошибка загрузки выбранного JSON сохраняет код HTTP', async t => {
  t.mock.method(globalThis, 'fetch', async () => ({ ok: false, status: 503 }));
  await assert.rejects(loadHistory('../data/chr/history.json'), /HTTP 503/);
});
