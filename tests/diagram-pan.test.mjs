import assert from 'node:assert/strict';
import { test } from 'node:test';
import { enableDiagramPan } from '../.test-build/diagram/pan.js';

function setup() {
  const host = new EventTarget();
  host.ownerDocument = new EventTarget();
  host.scrollLeft = 200;
  host.scrollTop = 300;
  host.clientLeft = host.clientTop = 1;
  host.clientWidth = 600;
  host.clientHeight = 400;
  host.getBoundingClientRect = () => ({ left: 0, top: 0 });
  const classes = new Set();
  host.classList = { add: name => classes.add(name), remove: name => classes.delete(name) };
  let capture = null;
  host.setPointerCapture = id => { capture = id; };
  host.hasPointerCapture = id => capture === id;
  host.releasePointerCapture = () => { capture = null; };
  enableDiagramPan(host);
  function send(type, values = {}) {
    const event = new Event(type, { cancelable: true });
    Object.assign(event, { pointerId: 1, pointerType: 'mouse', button: 0, buttons: 1, clientX: 300, clientY: 200, detail: 1 }, values);
    (['pointermove', 'pointerup', 'pointercancel'].includes(type) ? host.ownerDocument : host).dispatchEvent(event);
    return event;
  }
  return { host, classes, send, capture: () => capture };
}

test('Перетаскивание двигает обе оси и подавляет последующий клик', () => {
  const { host, classes, send, capture } = setup();
  send('pointerdown');
  send('pointermove', { clientX: 260, clientY: 170 });
  assert.equal(host.scrollLeft, 240);
  assert.equal(host.scrollTop, 330);
  assert.equal(capture(), 1);
  assert.ok(classes.has('is-panning'));
  send('pointerup');
  assert.equal(capture(), null);
  assert.equal(classes.size, 0);
  assert.equal(send('click').defaultPrevented, true);
  send('pointerdown');
  send('pointerup');
  assert.equal(send('click').defaultPrevented, false);
});

test('Дрожание руки до 5 px сохраняет обычное нажатие', () => {
  const { host, send, capture } = setup();
  send('pointerdown');
  send('pointermove', { clientX: 303, clientY: 202 });
  assert.equal(host.scrollLeft, 200);
  assert.equal(host.scrollTop, 300);
  assert.equal(capture(), null);
  send('pointerup');
  assert.equal(send('click').defaultPrevented, false);
});

test('Touch, перо, другие кнопки и полоса прокрутки остаются нативными', () => {
  for (const values of [{ pointerType: 'touch' }, { pointerType: 'pen' }, { button: 1 }, { button: 2 }, { clientX: 605 }, { clientY: 405 }]) {
    const { host, send, classes } = setup();
    send('pointerdown', values);
    send('pointermove', { clientX: 100, clientY: 100 });
    assert.equal(host.scrollLeft, 200);
    assert.equal(host.scrollTop, 300);
    assert.equal(classes.size, 0);
  }
});

test('Отпускание вне контейнера, отмена и потеря захвата завершают жест', () => {
  for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) {
    const { host, send, classes } = setup();
    send('pointerdown');
    send('pointermove', { clientX: 250 });
    send(type);
    send('pointermove', { clientX: 200 });
    assert.equal(host.scrollLeft, 250);
    assert.equal(classes.size, 0);
  }
});

test('Другой указатель не вмешивается; клавиатурный клик не подавляется', () => {
  const { host, send } = setup();
  send('pointerdown');
  send('pointermove', { pointerId: 2, clientX: 100 });
  send('pointerup', { pointerId: 2 });
  assert.equal(host.scrollLeft, 200);
  send('pointermove', { clientX: 250 });
  send('pointerup');
  assert.equal(send('click', { detail: 0 }).defaultPrevented, false);
});

test('Отпущенная кнопка не оставляет диаграмму в режиме перетаскивания', () => {
  const { host, send, classes } = setup();
  send('pointerdown');
  send('pointermove', { clientX: 250 });
  send('pointermove', { buttons: 0, clientX: 200 });
  assert.equal(host.scrollLeft, 250);
  assert.equal(classes.size, 0);
});

test('Новый touch-жест после отмены мыши не теряет нажатие', () => {
  const { send } = setup();
  send('pointerdown');
  send('pointermove', { clientX: 250 });
  send('pointercancel');
  send('pointerdown', { pointerType: 'touch' });
  send('pointerup', { pointerType: 'touch' });
  assert.equal(send('click').defaultPrevented, false);
});

test('Нативное перетаскивание ссылки не прерывает прокрутку мышью', () => {
  const { send } = setup();
  assert.equal(send('dragstart').defaultPrevented, false);
  send('pointerdown');
  assert.equal(send('dragstart').defaultPrevented, true);
  send('pointerup');
  assert.equal(send('dragstart').defaultPrevented, false);
});
