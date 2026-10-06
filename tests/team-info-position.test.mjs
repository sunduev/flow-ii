import assert from 'node:assert/strict';
import { test } from 'node:test';
import { teamInfoSize, teamInfoPosition } from '../.test-build/diagram/team-info-position.js';

const desktop = { left: 0, top: 0, width: 1280, height: 900, scale: 1 };
const phone = { left: 0, top: 0, width: 390, height: 844, scale: 1 };
const card = { width: 360, height: 350 };

test('Карточка справа от команды; у правого края — слева', () => {
  assert.deepEqual(teamInfoPosition({left:200,right:232,top:150,bottom:182}, card, desktop), {left:242,top:150});
  assert.deepEqual(teamInfoPosition({left:1200,right:1232,top:150,bottom:182}, card, desktop), {left:830,top:150});
});

test('В узком окне размещение у команды выбирает низ или верх при нехватке места сбоку', () => {
  assert.deepEqual(teamInfoPosition({left:200,right:232,top:150,bottom:182}, card, phone), {left:12,top:192});
  assert.deepEqual(teamInfoPosition({left:200,right:232,top:750,bottom:782}, card, phone), {left:12,top:390});
  assert.deepEqual(teamInfoSize(phone), {width:360,maxHeight:820,scale:1});
});

test('Pinch zoom ×3: карточка обычного экранного размера внутри смещённой видимой области', () => {
  const viewport = {left:150,top:200,width:130,height:250,scale:3};
  assert.deepEqual(teamInfoSize(viewport), {width:360,maxHeight:726,scale:1/3});
  const position = teamInfoPosition({left:210,right:220,top:225,bottom:236}, card, viewport);
  assert.equal(position.left,154);
  assert.equal(position.top,236 + 10/3);
  assert.ok(position.left + card.width / 3 <= viewport.left + viewport.width - 4);
  assert.ok(position.top + card.height / 3 <= viewport.top + viewport.height - 4);
});

test('При уходе команды за экран карточка остаётся у края; низкий экран ограничивает высоту', () => {
  const viewport = {left:150,top:200,width:130,height:100,scale:3};
  const size = teamInfoSize(viewport);
  assert.equal(size.maxHeight,276);
  const position = teamInfoPosition({left:-500,right:-490,top:-100,bottom:-90}, {width:size.width,height:size.maxHeight}, viewport);
  assert.deepEqual(position,{left:154,top:204});
  assert.deepEqual(teamInfoSize({...phone,width:320,height:390}),{width:296,maxHeight:366,scale:1});
});

test('Мобильная панель закреплена снизу видимой области и ограничена 65% её высоты', () => {
  const size = teamInfoSize(phone, true);
  assert.equal(size.width,366);
  assert.equal(size.maxHeight,844 * 0.65);
  assert.deepEqual(teamInfoPosition({left:200,right:232,top:150,bottom:182},card,phone,true),{left:15,top:482});
});

test('Нижняя панель при pinch ×3 сохраняет экранный размер и следует за видимой областью', () => {
  const viewport = {left:150,top:200,width:130,height:250,scale:3};
  const size = teamInfoSize(viewport,true);
  assert.equal(size.width,366);
  assert.equal(size.maxHeight,750 * 0.65);
  assert.equal(size.scale,1/3);
  const position = teamInfoPosition({left:-500,right:-490,top:-100,bottom:-90}, {width:size.width,height:350}, viewport,true);
  assert.equal(position.left,154);
  assert.equal(position.top,450 - 4 - 350/3);
  const moved = teamInfoPosition({left:100,right:110,top:20,bottom:30}, {width:size.width,height:350}, {...viewport,left:180,top:230},true);
  assert.equal(moved.left-position.left,30);
  assert.equal(moved.top-position.top,30);
});

test('Нижняя панель учитывает безопасную область на низком экране', () => {
  const viewport = {...phone,height:100};
  const size = teamInfoSize(viewport,true,34);
  assert.equal(size.maxHeight,54);
  assert.deepEqual(teamInfoPosition({left:0,right:32,top:0,bottom:32}, {width:size.width,height:size.maxHeight},viewport,true,34),{left:12,top:12});
});
