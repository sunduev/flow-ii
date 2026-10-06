import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHistoryIndex, buildHistoryGraph, getDiagramData } from '../.test-build/history/index.js';
import { getHistoryDiagramData } from '../.test-build/history/diagram-view.js';
import { diagramDimensions } from '../.test-build/diagram/geometry.js';
const data = {
 schemaVersion:1,
 editions:[{id:'old',year:2008,name:'Старый'},{id:'middle',year:2010,name:'Средний'},{id:'new',year:2011,name:'Новый'}],
 teams:[{id:'a',name:'А'},{id:'b',name:'Б'},{id:'c',name:'В'}],
 players:[{id:'p',name:'Игрок'},{id:'q',name:'Другой'},{id:'r',name:'Посторонний'}],
 participations:[
  {id:'old:a',editionId:'old',teamId:'a',displayName:'Старое А',place:6.5,playerIds:['p']},
  {id:'old:b',editionId:'old',teamId:'b',displayName:'Б',place:6.5,playerIds:['q']},
  {id:'old:c',editionId:'old',teamId:'c',displayName:'В',place:1,playerIds:['r']},
  {id:'middle:b',editionId:'middle',teamId:'b',displayName:'Б',place:3,playerIds:['q']},
  {id:'new:a',editionId:'new',teamId:'a',displayName:'А',place:1,playerIds:['p','q']},
 ]
};
test('история состава: объединение по ID, исторические имена/места, порядок, без посторонних узлов', () => {
 const index=createHistoryIndex(data), graph=buildHistoryGraph(index), base=getDiagramData(index,graph);
 const before=structuredClone(data);
 const view=getHistoryDiagramData(index,base,{participationId:'new:a',playerId:null, allRosters: false});
 assert.deepEqual(view.editions.map(e=>e.year),[2011,2010,2008]);
 assert.deepEqual([...view.participationsByEdition.values()].map(ps=>ps.map(p=>p.id)),[['new:a'],['middle:b'],['old:a','old:b']]);
 assert.equal(view.participationsByEdition.get('old')[0].displayName,'Старое А');
 assert.equal(view.participationsByEdition.get('old')[0].place,6.5);
 assert.deepEqual(view.playerLinks.map(l=>[l.playerId,l.sourceId,l.targetId,l.isGap]),[['p','old:a','new:a',true],['q','old:b','middle:b',false],['q','middle:b','new:a',false]]);
 assert.deepEqual(view.backgroundLinks,[]);
 assert.deepEqual(data,before);
 assert.equal(base.participationsByEdition.get('old').length,3);
});
test('история игрока: пустые колонки сохраняются, исходный пунктир и скрытый выбор не меняются', () => {
 const index=createHistoryIndex(data), graph=buildHistoryGraph(index);
 const view=getHistoryDiagramData(index,getDiagramData(index,graph),{participationId:'new:a',playerId:'p', allRosters: false});
 assert.deepEqual([...view.participationsByEdition.values()].map(ps=>ps.map(p=>p.id)),[['new:a'],[],['old:a']]);
 assert.equal(view.playerLinks.length,1); assert.equal(view.playerLinks[0].isGap,true);
 const filtered=getHistoryDiagramData(index,getDiagramData(index,graph,{fromYear:2008,toYear:2010}),{participationId:'new:a',playerId:'p', allRosters: false});
 assert.deepEqual([...filtered.participationsByEdition.values()].map(ps=>ps.map(p=>p.id)),[[],['old:a']]);
 assert.deepEqual(filtered.playerLinks,[]);
 const none=getHistoryDiagramData(index,getDiagramData(index,graph,{fromYear:2010,toYear:2010}),{participationId:'new:a',playerId:'p', allRosters: false});
 assert.deepEqual([...none.participationsByEdition.values()],[[]]);
 assert.deepEqual(none.playerLinks,[]);
 assert.equal(getHistoryDiagramData(index,getDiagramData(index,graph),{participationId:null,playerId:null, allRosters: false}).playerLinks.length,0);
});
test('размеры диаграммы: компактные строки, один год, пустой набор', () => {
 assert.deepEqual(diagramDimensions([1,4,2]),{width:708,height:243});
 assert.deepEqual(diagramDimensions([1]),{width:236,height:117});
 assert.deepEqual(diagramDimensions([]),{width:236,height:75});
});
