import assert from 'node:assert/strict';
import { test } from 'node:test';
import { zoomScroll, zoomDiagram, sizeDiagramStage, enableDiagramDoubleClickZoom, stepZoomScale } from '../.test-build/diagram/zoom.js';

const view = { left: 700, top: 500, width: 600, height: 400, diagramWidth: 3000, diagramHeight: 2000 };
test('Зум жестом сохраняет якорь под движущейся серединой пальцев', () => {
  assert.deepEqual(zoomScroll(view, 1, 1.5, { x: 100, y: 50 }, { x: 130, y: 80 }), { left: 1070, top: 745 });
  assert.deepEqual(zoomScroll(view, 1, 1, { x: 100, y: 50 }, { x: 130, y: 80 }), { left: 670, top: 470 });
});
test('Кнопки после плавного зума выбирают соседние уровни', () => {
  for (const [scale, down, up] of [[.73, .67, .8], [1.1, 1, 1.25], [.5, .33, .67], [.1, .1, .25], [2, 1.5, 2]]) {
    assert.equal(stepZoomScale(scale, -1), down);
    assert.equal(stepZoomScale(scale, 1), up);
  }
});
test('Уменьшение сохраняет координату центра в исходном SVG', () => {
  assert.deepEqual(zoomScroll(view, 1, .5), { left: 200, top: 150 });
});
test('Возврат к 100% восстанавливает центр', () => {
  assert.deepEqual(zoomScroll({ ...view, left: 200, top: 150 }, .5, 1), { left: 700, top: 500 });
});
test('Край и диаграмма меньше окна ограничивают прокрутку', () => {
  assert.deepEqual(zoomScroll({ ...view, left: 2400, top: 1600 }, 1, .5), { left: 900, top: 600 });
  assert.deepEqual(zoomScroll({ ...view, diagramWidth: 320, diagramHeight: 200 }, 1, .25), { left: 0, top: 0 });
  assert.deepEqual(zoomScroll({ ...view, left: 0, top: 0 }, 1, .5), { left: 0, top: 0 });
});
test('Масштаб меняет существующий SVG и область прокрутки без замены узлов', () => {
  const svg = { style: {}, getAttribute: name => ({ width: '3000', height: '2000' })[name] };
  const stage = { style: {}, querySelector: () => svg };
  const host = { scrollLeft: 700, scrollTop: 500, clientWidth: 600, clientHeight: 400, querySelector: () => stage };
  zoomDiagram(host, 1, .5);
  assert.equal(svg.style.transform, 'scale(0.5)');
  assert.equal(stage.style.width, '1500px');
  assert.equal(stage.style.height, '1000px');
  assert.equal(host.scrollLeft, 200);
  assert.equal(host.scrollTop, 150);
  sizeDiagramStage(stage, svg, 1.25);
  assert.equal(stage.style.width, '3750px');
  assert.equal(stage.style.height, '2500px');
});
test('Пустой компактный диапазон не мешает сменить масштаб', () => {
  assert.doesNotThrow(() => zoomDiagram({ querySelector: () => null }, 1, .5));
});



test('Зум помещает точку клика в центр', () => {
  assert.deepEqual(zoomScroll(view, .5, 1, { x: 100, y: 50 }), { left: 1300, top: 900 });
  assert.deepEqual(zoomScroll({ ...view, left: 0, top: 0 }, .5, 1, { x: 0, y: 0 }), { left: 0, top: 0 });
  assert.deepEqual(zoomScroll({ ...view, left: 900, top: 600 }, .5, 1, { x: 600, y: 400 }), { left: 2400, top: 1600 });
  assert.deepEqual(zoomScroll(view, 1, .1), { left: 0, top: 0 });
});

test('Точка клика передаётся применению масштаба существующего SVG', () => {
  const svg = { style: {}, getAttribute: name => ({ width: '3000', height: '2000' })[name] };
  const stage = { style: {}, querySelector: () => svg };
  const host = { scrollLeft: 700, scrollTop: 500, clientWidth: 600, clientHeight: 400, querySelector: () => stage };
  zoomDiagram(host, .5, 1, { x: 100, y: 50 });
  assert.equal(host.scrollLeft, 1300);
  assert.equal(host.scrollTop, 900);
});


function clickSetup() {
  const host = new EventTarget();
  host.clientLeft = host.clientTop = 1;
  host.clientWidth = 600; host.clientHeight = 400;
  host.getBoundingClientRect = () => ({ left: 20, top: 30 });
  host.querySelector = () => ({});
  let kind = '.team-node';
  host.closest = selector => selector.split(',').some(part => part.trim() === kind) ? {} : null;
  let scale = .5;
  const points = [];
  enableDiagramDoubleClickZoom(host, () => scale, point => { points.push(point); scale = 1; });
  function send(type = 'click', values = {}) {
    const event = new Event(type, { cancelable: true });
    Object.assign(event, { clientX: 121, clientY: 81, button: 0, detail: 1, shiftKey: false }, values);
    host.dispatchEvent(event);
    return event;
  }
  return { host, points, send, setScale: value => { scale = value; }, setKind: value => { kind = value; } };
}

test('Первый клик выбирает, второй приближает после замены SVG без повторного выбора', () => {
  const { host, points, send } = clickSetup();
  let selections = 0;
  host.addEventListener('click', () => { selections++; host.querySelector = () => ({ newSvg: true }); });
  assert.equal(send().defaultPrevented, false);
  assert.equal(selections, 1);
  assert.equal(send('click', { detail: 2 }).defaultPrevented, true);
  assert.equal(selections, 1);
  assert.deepEqual(points, [{ x: 100, y: 50 }]);
  send('dblclick', { detail: 2 });
  assert.equal(points.length, 1);
});

test('Dblclick по фону тоже приближает', () => {
  const { points, send, setKind } = clickSetup();
  setKind('background');
  assert.equal(send('dblclick', { detail: 2 }).defaultPrevented, true);
  assert.deepEqual(points, [{ x: 100, y: 50 }]);
});

test('Колесо, Shift-клик, клавиатура, кнопки/ссылки, >=100% и пустой диапазон не перехватываются', () => {
  const { host, points, send, setKind, setScale } = clickSetup();
  for (const type of ['wheel', 'click']) assert.equal(send(type, { shiftKey: true, altKey: true }).defaultPrevented, false);
  assert.equal(send('click', { detail: 0 }).defaultPrevented, false);
  for (const kind of ['a', 'button']) {
    setKind(kind);
    assert.equal(send('click', { detail: 2 }).defaultPrevented, false);
    assert.equal(send('dblclick', { detail: 2 }).defaultPrevented, false);
  }
  setKind('.team-node');
  for (const values of [{ detail: 2, clientX: 621 }, { detail: 2, clientY: 431 }, { detail: 2, button: 2 }]) assert.equal(send('click', values).defaultPrevented, false);
  for (const scale of [1, 1.5]) { setScale(scale); assert.equal(send('click', { detail: 2 }).defaultPrevented, false); }
  setScale(.5); host.querySelector = () => null;
  assert.equal(send('click', { detail: 2 }).defaultPrevented, false);
  assert.deepEqual(points, []);
});

test('Закреплённые годы масштабируются вместе с колонками', () => {
  const headerSvg = { style: {}, getAttribute: name => ({ width: '3000', height: '44' })[name] };
  const header = { style: { setProperty(name, value) { this[name] = value; } }, querySelector: () => headerSvg };
  const svg = { style: {}, getAttribute: name => ({ width: '3000', height: '2000' })[name] };
  const stage = { style: {}, previousElementSibling: header };
  sizeDiagramStage(stage, svg, .5);
  assert.equal(header.style.width, '1500px');
  assert.equal(header.style['--year-height'], '22px');
  assert.equal(headerSvg.style.transform, 'scale(0.5)');
});
