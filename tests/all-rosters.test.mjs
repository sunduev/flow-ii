import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createHistoryIndex, buildHistoryGraph, getDiagramData } from '../.test-build/history/index.js';
import { getSelectionPlayerIds, getSelectionRelations, getSharedRosterPlayerIds, getTeamInfoPlayerIds, isRosterParticipation, setAllRosters, selectParticipation, createPlayerColors } from '../.test-build/history/selection.js';
import { getHistoryDiagramData } from '../.test-build/history/diagram-view.js';

const data = {
  schemaVersion: 1,
  editions: [2020, 2021, 2022, 2023].map(year => ({ id: String(year), year, name: String(year) })),
  teams: ['a', 'b', 'c', 'd'].map(id => ({ id, name: id })),
  players: [{ id: 'p', name: 'Одно имя' }, { id: 'q', name: 'Одно имя' }, { id: 'r', name: 'Другой' }],
  participations: [
    { id: '2020:b', editionId: '2020', teamId: 'b', displayName: 'Б', place: 1, playerIds: ['q'] },
    { id: '2021:a', editionId: '2021', teamId: 'a', displayName: 'Старое имя', place: 2, playerIds: ['q'] },
    { id: '2021:d', editionId: '2021', teamId: 'd', displayName: 'Новое имя', place: 3, playerIds: ['r'] },
    { id: '2022:a', editionId: '2022', teamId: 'a', displayName: 'Новое имя', place: 1, playerIds: ['p', 'q'] },
    { id: '2023:a', editionId: '2023', teamId: 'a', displayName: 'Новое имя', place: 1, playerIds: ['p'] },
    { id: '2023:c', editionId: '2023', teamId: 'c', displayName: 'В', place: 2, playerIds: ['q', 'r'] },
  ],
};
const index = createHistoryIndex(data);
const selection = { participationId: '2023:a', playerId: null, allRosters: true };

test('Все составы: объединение по teamId и playerId, полная история до и после команды', () => {
  assert.deepEqual(getSelectionPlayerIds(index, selection), ['p', 'q']);
  assert.deepEqual(getSelectionPlayerIds(index, { ...selection, allRosters: false }), ['p']);
  const view = getHistoryDiagramData(index, getDiagramData(index, buildHistoryGraph(index)), selection);
  assert.deepEqual([...view.participationsByEdition.values()].map(items => items.map(p => p.id)), [['2023:a', '2023:c'], ['2022:a'], ['2021:a'], ['2020:b']]);
  assert.deepEqual(view.playerLinks.map(l => [l.playerId, l.sourceId, l.targetId]), [
    ['p', '2022:a', '2023:a'], ['q', '2020:b', '2021:a'], ['q', '2021:a', '2022:a'], ['q', '2022:a', '2023:c'],
  ]);
  assert.deepEqual(getSelectionPlayerIds(index, { ...selection, participationId: '2021:a' }), ['p', 'q']);
  assert.deepEqual(getSelectionPlayerIds(index, { ...selection, participationId: null }), []);
});

test('Карточка внешней связи ограничена историческим набором и фильтром; тот же ID открывает состав года', () => {
  assert.deepEqual(getSharedRosterPlayerIds(index, selection, '2023:c'), ['q']);
  assert.deepEqual(getTeamInfoPlayerIds(index, selection, '2023:c'), ['q']);
  const filtered = { ...selection, playerId: 'p' };
  assert.deepEqual(getTeamInfoPlayerIds(index, filtered, '2023:c'), []);
  assert.deepEqual(getTeamInfoPlayerIds(index, filtered, '2022:a'), ['p', 'q']);
  assert.equal(isRosterParticipation(index, selection, '2021:a'), true);
  assert.equal(isRosterParticipation(index, selection, '2021:d'), false);
  assert.equal(isRosterParticipation(index, { ...selection, allRosters: false }, '2021:a'), false);
  assert.equal(isRosterParticipation(index, { ...selection, participationId: null }, '2021:a'), false);
});

test('Дополнительная рамка: только новые участия; общее участие сплошное, цвета команды независимы', () => {
  const relations = getSelectionRelations(index, selection);
  assert.deepEqual(relations.get('2021:a'), { sameTeam: true, additional: true });
  assert.deepEqual(relations.get('2020:b'), { sameTeam: false, additional: true });
  assert.deepEqual(relations.get('2023:c'), { sameTeam: false, additional: true });
  assert.deepEqual(relations.get('2022:a'), { sameTeam: true, additional: false });
  assert.deepEqual(relations.get('2023:a'), { sameTeam: true, additional: false });
  assert.equal(relations.has('2021:d'), false);
  assert.deepEqual([...getSelectionRelations(index, { ...selection, allRosters: false }).keys()].sort(), ['2022:a', '2023:a']);
  assert.deepEqual([...getSelectionRelations(index, { ...selection, playerId: 'q' }).keys()].sort(), ['2020:b', '2021:a', '2022:a', '2023:c']);
  assert.deepEqual(createPlayerColors(getSelectionPlayerIds(index, selection)), createPlayerColors(getSelectionPlayerIds(index, { ...selection, participationId: '2021:a', playerId: 'q' })));
});

test('Период не сужает набор, не создаёт связей; фильтр исторического игрока действует в компактном режиме', () => {
  const filtered = { ...selection, playerId: 'q' };
  const view = getHistoryDiagramData(index, getDiagramData(index, buildHistoryGraph(index), { fromYear: 2020, toYear: 2021 }), filtered);
  assert.deepEqual([...view.participationsByEdition.values()].map(items => items.map(p => p.id)), [['2021:a'], ['2020:b']]);
  assert.deepEqual(view.playerLinks.map(l => [l.sourceId, l.targetId]), [['2020:b', '2021:a']]);
  assert.deepEqual(filtered, { participationId: '2023:a', playerId: 'q', allRosters: true });
});

test('Выключение режима сохраняет допустимый фильтр и снимает исторический; другой выбор сохраняет режим', () => {
  assert.deepEqual(setAllRosters(index, { ...selection, playerId: 'q' }, false), { ...selection, playerId: null, allRosters: false });
  assert.deepEqual(setAllRosters(index, { ...selection, playerId: 'p' }, false), { ...selection, playerId: 'p', allRosters: false });
  assert.deepEqual(setAllRosters(index, { ...selection, allRosters: false, playerId: 'p' }, true), { ...selection, playerId: 'p' });
  assert.deepEqual(selectParticipation({ ...selection, playerId: 'q' }, '2021:a'), { ...selection, participationId: '2021:a' });
  assert.deepEqual(selectParticipation(selection, '2021:d'), { ...selection, participationId: '2021:d' });
});


test('Внешнее участие обеих групп остаётся сплошным и показывает только игроков исторического набора', () => {
  const mixedIndex = createHistoryIndex({ ...data,
    editions: [...data.editions, { id: '2024', year: 2024, name: '2024' }],
    participations: [...data.participations, { id: '2024:b', editionId: '2024', teamId: 'b', displayName: 'Б', place: 1, playerIds: ['p', 'q', 'r'] }],
  });
  assert.deepEqual(getSelectionRelations(mixedIndex, selection).get('2024:b'), { sameTeam: false, additional: false });
  assert.deepEqual(getTeamInfoPlayerIds(mixedIndex, selection, '2024:b'), ['p', 'q']);
  assert.deepEqual(getSelectionRelations(mixedIndex, { ...selection, playerId: 'q' }).get('2024:b'), { sameTeam: false, additional: false });
  assert.deepEqual(getTeamInfoPlayerIds(mixedIndex, { ...selection, playerId: 'q' }, '2024:b'), ['q']);
});
