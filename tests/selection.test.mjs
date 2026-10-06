import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHistoryIndex } from '../.test-build/history/index.js';
import { initialSelection, selectParticipation, selectPlayer, togglePlayer, playerLabel, createPlayerColors } from '../.test-build/history/selection.js';
const data = { schemaVersion: 1, editions: [{id:'old',year:2020,name:'Старый'},{id:'new',year:2026,name:'Новый'}], teams: [{id:'b',name:'Б'},{id:'a',name:'А'}], players: [{id:'1',name:'Тестов И.'},{id:'2',name:'Тестов И.'}], participations: [{id:'old:b',editionId:'old',teamId:'b',displayName:'Б',place:1,playerIds:['1']},{id:'new:b',editionId:'new',teamId:'b',displayName:'Б',place:6.5,playerIds:['1']},{id:'new:a',editionId:'new',teamId:'a',displayName:'А',place:6.5,playerIds:['2']}] };
test('начальное участие: последний год, минимум места, стабильный ID; пустые данные', () => {
 assert.deepEqual(initialSelection(createHistoryIndex(data)), {participationId:'new:a',playerId:null, allRosters: false});
 assert.deepEqual(initialSelection(createHistoryIndex({...data,editions:[],participations:[]})), {participationId:null,playerId:null, allRosters: false});
});
test('выбор другой команды сбрасывает игрока; весь состав сохраняет участие', () => {
 const state = selectPlayer(initialSelection(createHistoryIndex(data)), '2');
 assert.deepEqual(selectParticipation(state, 'old:b'), {participationId:'old:b',playerId:null, allRosters: false});
 assert.deepEqual(selectPlayer(state,null), {participationId:'new:a',playerId:null, allRosters: false});
 assert.equal(state.playerId,'2');
});
test('совпадающие сокращённые имена и цвета игроков состава различаются по ID', () => {
 const index = createHistoryIndex(data);
 assert.equal(playerLabel(index,'1'),'Тестов И. · ID 1');
 assert.equal(playerLabel(index,'2'),'Тестов И. · ID 2');
 const colors = createPlayerColors(['1', '2']);
 assert.notEqual(colors.get('1'), colors.get('2'));
});

test('переключение игрока сохраняет участие; повторное переключение возвращает состав', () => {
 const state = {participationId:'new:b',playerId:null, allRosters: false};
 const opened = togglePlayer(state, '1');
 assert.deepEqual(opened, {participationId:'new:b',playerId:'1', allRosters: false});
 assert.deepEqual(togglePlayer(opened, '1'), state);
 assert.deepEqual(togglePlayer(opened, '2'), {participationId:'new:b',playerId:'2', allRosters: false});
 assert.equal(state.playerId, null);
});

test('цвета полного состава различаются и не зависят от порядка ID', () => {
 const ids = ['27403', '28751', '30270', '33620', '37761', '4270'];
 const colors = createPlayerColors(ids);
 assert.equal(new Set(colors.values()).size, ids.length);
 assert.deepEqual(colors, createPlayerColors([...ids].reverse()));
 assert.deepEqual(createPlayerColors([]), new Map());
 const large = Array.from({length: 40}, (_, i) => String(i));
 assert.equal(new Set(createPlayerColors(large).values()).size, 40);
});
