import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createHistoryIndex } from '../.test-build/history/index.js';
import { getSharedRosterPlayerIds, getTeamInfoPlayerIds } from '../.test-build/history/selection.js';

const index = createHistoryIndex({
  schemaVersion: 1,
  editions: [2020, 2025].map(year => ({ id: String(year), year, name: `Турнир ${year}` })),
  teams: ['a', 'b', 'c'].map(id => ({ id, name: id })),
  players: [{ id: 'p', name: 'Одинаковое имя' }, { id: 'q', name: 'Одинаковое имя' }, { id: 'r', name: 'Другой игрок' }],
  participations: [
    { id: 'active', editionId: '2025', teamId: 'a', displayName: 'Активная', place: 1, playerIds: ['r', 'p'] },
    { id: 'related', editionId: '2020', teamId: 'b', displayName: 'Связанная', place: 2, playerIds: ['p', 'q', 'r'] },
    { id: 'unrelated', editionId: '2020', teamId: 'c', displayName: 'Другая', place: 3, playerIds: ['q'] },
  ],
});

test('Подсказка показывает всех общих игроков в порядке выбранного состава, по ID', () => {
  assert.deepEqual(getSharedRosterPlayerIds(index, { participationId: 'active', playerId: null, allRosters: false }, 'related'), ['r', 'p']);
  assert.deepEqual(getSharedRosterPlayerIds(index, { participationId: 'active', playerId: null, allRosters: false }, 'unrelated'), []);
});

test('В режиме одного игрока подсказка соответствует только его видимой цепочке', () => {
  assert.deepEqual(getSharedRosterPlayerIds(index, { participationId: 'active', playerId: 'p', allRosters: false }, 'related'), ['p']);
  assert.deepEqual(getSharedRosterPlayerIds(index, { participationId: 'active', playerId: 'p', allRosters: false }, 'unrelated'), []);
});

test('Активная команда показывает выбранный состав или одного выделенного игрока', () => {
  assert.deepEqual(getSharedRosterPlayerIds(index, { participationId: 'active', playerId: null, allRosters: false }, 'active'), ['r', 'p']);
  assert.deepEqual(getSharedRosterPlayerIds(index, { participationId: 'active', playerId: 'p', allRosters: false }, 'active'), ['p']);
});

test('При отсутствии выбора карточка не нужна', () => {
  assert.deepEqual(getSharedRosterPlayerIds(index, { participationId: null, playerId: null, allRosters: false }, 'related'), []);
});

test('Карточка выбора сохраняет весь состав при выделении игрока, связанные карточки — только цепочку', () => {
  const selection = { participationId: 'active', playerId: 'p', allRosters: false };
  assert.deepEqual(getTeamInfoPlayerIds(index, selection, 'active'), ['r', 'p']);
  assert.deepEqual(getTeamInfoPlayerIds(index, selection, 'related'), ['p']);
  assert.deepEqual(getTeamInfoPlayerIds(index, selection, 'unrelated'), []);
  assert.deepEqual(getTeamInfoPlayerIds(index, { participationId: null, playerId: null, allRosters: false }, 'active'), []);
});
