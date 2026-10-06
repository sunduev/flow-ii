import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { createHistoryIndex, getPlayerHistory, getRosterHistories, buildHistoryGraph, getDiagramData } from '../.test-build/history/index.js';

const data = JSON.parse(readFileSync(new URL('../data/fixtures/demo-history.json', import.meta.url)));
const scenarios = JSON.parse(readFileSync(new URL('../data/fixtures/history-scenarios.json', import.meta.url)));
const empty = { schemaVersion: 1, editions: [], teams: [], players: [], participations: [] };

const small = {
  schemaVersion: 1,
  editions: [{ id: 'later', year: 2024, name: 'Позднее проведение' }, { id: 'earlier', year: 2020, name: 'Раннее проведение' }],
  teams: [{ id: '2', name: 'Два' }, { id: '10', name: 'Десять' }, { id: 'a', name: 'А' }],
  players: [{ id: 'p', name: 'Игрок' }],
  participations: [
    { id: 'later:2', editionId: 'later', teamId: '2', displayName: 'Два', place: 6.5, playerIds: [] },
    { id: 'earlier:a', editionId: 'earlier', teamId: 'a', displayName: 'Старое А', place: 1, playerIds: ['p'] },
    { id: 'later:10', editionId: 'later', teamId: '10', displayName: 'Десять', place: 6.5, playerIds: [] },
    { id: 'later:a', editionId: 'later', teamId: 'a', displayName: 'Новое А', place: 1, playerIds: ['p'] },
  ],
};

test('Индексы используют ID и year, равные места сортируются лексикографически без мутации входа', () => {
  const before = structuredClone(small);
  const index = createHistoryIndex(small);
  assert.deepEqual(index.editions.map(e => e.year), [2020, 2024]);
  assert.equal(index.editionById.get('later').name, 'Позднее проведение');
  assert.equal(index.teamById.get('10').name, 'Десять');
  assert.equal(index.playerById.get('p').name, 'Игрок');
  assert.deepEqual(index.participationsByEdition.get('later').map(p => p.teamId), ['a', '10', '2']);
  assert.equal(index.participationById.get('later:10').place, 6.5);
  assert.deepEqual(index.participationsByTeam.get('a').map(p => p.id), ['earlier:a', 'later:a']);
  assert.deepEqual(index.participationsByPlayer.get('p').map(p => p.id), ['earlier:a', 'later:a']);
  assert.deepEqual(small, before);
});

test('Пустой корректный набор даёт пустые индексы', () => {
  const index = createHistoryIndex(empty);
  assert.deepEqual(index.editions, []);
  assert.equal(index.participationById.size, 0);
  assert.equal(index.participationsByPlayer.size, 0);
});

for (const expected of scenarios.playerHistories) {
  test(`Полная цепочка и пунктирные связи: ${expected.name}`, () => {
    const index = createHistoryIndex(data);
    const history = getPlayerHistory(index, expected.playerId);
    assert.equal(history.player.name, expected.name);
    assert.deepEqual(history.entries.map(e => e.participation.id), expected.participationIds);
    assert.deepEqual(history.links.map(l => [l.sourceId, l.targetId]), expected.participationIds.slice(1).map((id, i) => [expected.participationIds[i], id]));
    assert.deepEqual(history.links.filter(l => l.isGap).map(l => [l.sourceId, l.targetId]), expected.dashedLinks);
    assert.ok(history.links.every(l => l.playerId === expected.playerId));
  });
}

test('Состав выбранного участия получает историю до и после года, включая возвращение и старое название', () => {
  const index = createHistoryIndex(data);
  const histories = getRosterHistories(index, scenarios.selectedParticipationId);
  assert.deepEqual(histories.map(h => h.player.id), index.participationById.get(scenarios.selectedParticipationId).playerIds);
  const bruter = histories.find(h => h.player.id === '4270');
  assert.deepEqual(bruter.entries.map(e => e.edition.year), scenarios.yearsChronological);
  assert.deepEqual(bruter.entries.map(e => e.participation.teamId), ['49804', '27177', '75592', '27177', '49804', '49804']);
  assert.equal(bruter.entries[0].participation.displayName, scenarios.teamRename.olderName);
  assert.equal(bruter.entries.at(-1).participation.displayName, scenarios.teamRename.laterName);
  assert.equal(bruter.entries[3].edition.name, 'Тестовый турнир — 2024 (условный год)');
});

test('Все девять игроков состава и дробное место доступны без ограничения', () => {
  const expanded = data.participations.find(p => p.playerIds.length === 9);
  const index = createHistoryIndex(data);
  const histories = getRosterHistories(index, expanded.id);
  assert.equal(histories.length, 9);
  assert.deepEqual(histories.map(h => h.player.id), expanded.playerIds);
  const fractional = index.participationById.get(scenarios.fractionalPlace.participationId);
  assert.equal(fractional.place, 6.5);
  assert.ok(getRosterHistories(index, fractional.id).every(h => h.entries.some(e => e.participation.place === 6.5)));
});

test('Однофамильцы остаются раздельными по ID, даже при полном совпадении имени', () => {
  const index = createHistoryIndex(data);
  for (const pair of scenarios.sameFirstAndLastNamesDifferentIds) {
    const [a, b] = pair.playerIds.map(id => getPlayerHistory(index, id));
    assert.notEqual(a.player.id, b.player.id);
    for (const history of [a, b]) {
      assert.equal(history.player.name, pair.namesByPlayerId[history.player.id]);
      assert.ok(history.entries.every(e => e.participation.playerIds.includes(history.player.id)));
    }
    assert.notDeepEqual(a.entries.map(e => e.participation.id), b.entries.map(e => e.participation.id));
  }
  const sameNames = structuredClone(small);
  sameNames.players.push({ id: 'q', name: 'Игрок' });
  sameNames.participations[0].playerIds = ['q'];
  const sameIndex = createHistoryIndex(sameNames);
  assert.deepEqual(getPlayerHistory(sameIndex, 'q').entries.map(e => e.participation.id), ['later:2']);
  assert.deepEqual(getPlayerHistory(sameIndex, 'p').entries.map(e => e.participation.id), ['earlier:a', 'later:a']);
});

test('Фон объединяет общие связи состава, индивидуальные связи сохраняются', () => {
  const fixture = structuredClone(small);
  fixture.players.push({ id: 'q', name: 'Другой игрок' });
  fixture.participations[1].playerIds.push('q');
  fixture.participations[3].playerIds.push('q');
  const graph = buildHistoryGraph(createHistoryIndex(fixture));
  assert.equal(graph.playerLinks.length, 2);
  assert.deepEqual(graph.playerLinks.map(l => l.playerId), ['p', 'q']);
  assert.deepEqual(graph.backgroundLinks, [{ sourceId: 'earlier:a', targetId: 'later:a', isGap: false, playerIds: ['p', 'q'] }]);
});

test('Пустой набор и игрок без участий не создают связей', () => {
  assert.deepEqual(buildHistoryGraph(createHistoryIndex(empty)), { playerLinks: [], backgroundLinks: [] });
  const fixture = { ...empty, players: [{ id: 'alone', name: 'Без участия' }] };
  assert.deepEqual(getPlayerHistory(createHistoryIndex(fixture), 'alone'), { player: fixture.players[0], entries: [], links: [] });
  const single = structuredClone(small);
  single.participations = [small.participations[1]];
  assert.deepEqual(getPlayerHistory(createHistoryIndex(single), 'p').links, []);
});

test('Диапазон 2025–2026 сохраняет полную историю скрытого выбора и только исходную видимую связь', () => {
  const index = createHistoryIndex(data);
  const graph = buildHistoryGraph(index);
  const before = structuredClone(data);
  const scenario = scenarios.rangeScenario;
  const full = getRosterHistories(index, scenario.selectedParticipationId);
  const view = getDiagramData(index, graph, { fromYear: 2025, toYear: 2026 });
  assert.deepEqual(view.editions.map(e => e.year), scenario.visibleYearsLeftToRight);
  assert.equal(view.participationsByEdition.has('2024'), false);
  assert.deepEqual(view.playerLinks.filter(l => l.playerId === scenario.selectedPlayerId).map(l => [l.sourceId, l.targetId]), scenario.expectedVisibleLinks);
  assert.equal(view.playerLinks.find(l => l.playerId === '4270').isGap, false);
  assert.deepEqual(getRosterHistories(index, scenario.selectedParticipationId), full);
  assert.equal(index.editionById.get(index.participationById.get(scenario.selectedParticipationId).editionId).year, 2024);
  assert.deepEqual(data, before);
  assert.ok(view.playerLinks.every(l => graph.playerLinks.includes(l)));
  assert.ok(view.backgroundLinks.every(l => graph.backgroundLinks.includes(l)));
});

test('Диаграмма разворачивает только годы, сохраняет сортировку мест и исходный пунктир', () => {
  const index = createHistoryIndex(data);
  const graph = buildHistoryGraph(index);
  const all = getDiagramData(index, graph);
  assert.deepEqual(all.editions.map(e => e.year), scenarios.diagramYearsLeftToRight);
  assert.deepEqual(index.editions.map(e => e.year), scenarios.yearsChronological);
  const view = getDiagramData(index, graph, { fromYear: 2021, toYear: 2024 });
  const bruter = view.playerLinks.filter(l => l.playerId === '4270');
  assert.deepEqual(bruter.map(l => [l.sourceId, l.targetId, l.isGap]), [
    ['2021:27177', '2022:75592', false], ['2022:75592', '2024:27177', false],
  ]);
  const smallIndex = createHistoryIndex(small);
  const smallView = getDiagramData(smallIndex, buildHistoryGraph(smallIndex));
  assert.deepEqual(smallView.participationsByEdition.get('later').map(p => p.teamId), ['a', '10', '2']);
});

test('Один год, диапазон вне истории и пустой набор не создают связей', () => {
  const index = createHistoryIndex(data);
  const graph = buildHistoryGraph(index);
  for (const range of [{ fromYear: 2024, toYear: 2024 }, { fromYear: 2023, toYear: 2023 }]) {
    const view = getDiagramData(index, graph, range);
    assert.deepEqual(view.playerLinks, []);
    assert.deepEqual(view.backgroundLinks, []);
  }
  const view = getDiagramData(index, graph, { fromYear: 2030, toYear: 2040 });
  assert.deepEqual(view.editions, []);
  assert.equal(view.participationsByEdition.size, 0);
  const emptyIndex = createHistoryIndex(empty);
  assert.deepEqual(getDiagramData(emptyIndex, buildHistoryGraph(emptyIndex)), {
    editions: [], participationsByEdition: new Map(), playerLinks: [], backgroundLinks: [],
  });
});


test('пунктир означает пропуск турнира в полном наборе, а не разрыв календарных лет', () => {
  const fixture = {
    schemaVersion: 1,
    editions: [2025, 2011, 2008, 2019, 2010].map(year => ({id: `edition-${year}`, year, name: `Турнир ${year}`})),
    teams: [{id:'team',name:'Команда'}],
    players: [{id:'player',name:'Игрок'}],
    participations: [2008, 2010, 2019, 2025].map(year => ({id:`entry-${year}`,editionId:`edition-${year}`,teamId:'team',displayName:'Команда',place:1,playerIds:['player']})),
  };
  const index = createHistoryIndex(fixture);
  assert.deepEqual(getPlayerHistory(index, 'player').links.map(link => [link.sourceId, link.targetId, link.isGap]), [
    ['entry-2008','entry-2010',false],
    ['entry-2010','entry-2019',true],
    ['entry-2019','entry-2025',false],
  ]);
  const graph = buildHistoryGraph(index);
  const view = getDiagramData(index, graph, {fromYear:2019,toYear:2025});
  assert.deepEqual(view.playerLinks.map(link=>link.isGap), [false]);
  assert.deepEqual(getPlayerHistory(index, 'player').entries.map(entry=>entry.edition.year), [2008,2010,2019,2025]);
});
