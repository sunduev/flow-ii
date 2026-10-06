import assert from 'node:assert/strict';
import { test } from 'node:test';
import { enableDiagramWheelZoom } from '../.test-build/diagram/wheel.js';
import { createZoomFrameUpdate } from '../.test-build/diagram/zoom-frame.js';

function setup(initialScale = 1) {
  const host = new EventTarget();
  host.clientLeft = host.clientTop = 1;
  host.clientWidth = 600; host.clientHeight = 400;
  host.getBoundingClientRect = () => ({ left: 20, top: 30 });
  host.querySelector = () => ({});
  let scale = initialScale;
  const calls = [];
  const frames = new Map();
  let id = 0;
  const queue = createZoomFrameUpdate(() => scale, (next, anchor, destination) => {
    scale = next; calls.push({ scale, anchor, destination });
  }, callback => { frames.set(++id, callback); return id; }, id => frames.delete(id));
  enableDiagramWheelZoom(host, queue.getScale, (next, point) => queue.schedule(next, point, point));
  function send(values = {}, cancelable = true) {
    const event = new Event('wheel', { cancelable });
    Object.assign(event, { altKey: true, ctrlKey: false, metaKey: false, shiftKey: false, deltaY: -100, deltaX: 0, deltaMode: 0, clientX: 121, clientY: 81 }, values);
    host.dispatchEvent(event); return event;
  }
  return { host, send, calls, frames, flush: () => {
    const callbacks = [...frames.values()]; frames.clear(); callbacks.forEach(callback => callback(0));
  } };
}

test('Alt/Option + вверх увеличивает вокруг курсора; вниз возвращает масштаб', () => {
  const s = setup();
  assert.equal(s.send().defaultPrevented, true);
  s.flush();
  assert.ok(Math.abs(s.calls[0].scale - Math.exp(.2)) < 1e-12);
  assert.deepEqual(s.calls[0].anchor, { x: 100, y: 50 });
  assert.deepEqual(s.calls[0].destination, { x: 100, y: 50 });
  s.send({ deltaY: 100 }); s.flush();
  assert.ok(Math.abs(s.calls.at(-1).scale - 1) < 1e-12);
});

test('Десять малых событий колеса до кадра накапливаются в одно обновление', () => {
  const s = setup();
  for (let i = 0; i < 10; i++) s.send({ deltaY: -5 });
  assert.equal(s.frames.size, 1);
  assert.deepEqual(s.calls, []);
  s.flush();
  assert.equal(s.calls.length, 1);
  assert.ok(Math.abs(s.calls[0].scale - Math.exp(.1)) < 1e-12);
});

test('Строки и страницы приводятся к тем же пикселям', () => {
  for (const [deltaY, deltaMode, pixels] of [[-3, 1, -48], [1, 2, 400]]) {
    const s = setup();
    s.send({ deltaY, deltaMode }); s.flush();
    assert.ok(Math.abs(s.calls[0].scale - Math.exp(-pixels * .002)) < 1e-12);
  }
});

test('На пределах 10–200% колесо перехвачено, лишнего кадра нет', () => {
  for (const [scale, deltaY] of [[.1, 100], [2, -100]]) {
    const s = setup(scale);
    assert.equal(s.send({ deltaY }).defaultPrevented, true);
    assert.equal(s.frames.size, 0);
    assert.deepEqual(s.calls, []);
  }
  const s = setup();
  s.send({ deltaY: -10000 }); s.flush();
  assert.equal(s.calls.at(-1).scale, 2);
  s.send({ deltaY: 10000 }); s.flush();
  assert.equal(s.calls.at(-1).scale, .1);
});

test('Обычное колесо, Ctrl/Command/Shift, горизонталь, полосы и пустой диапазон остаются нативными', () => {
  const s = setup();
  for (const values of [{ altKey: false }, { ctrlKey: true }, { metaKey: true }, { shiftKey: true }, { deltaY: 0, deltaX: 100 }, { deltaY: 10, deltaX: 100 }, { clientX: 10 }, { clientX: 621 }, { clientY: 431 }]) {
    assert.equal(s.send(values).defaultPrevented, false);
  }
  assert.equal(s.send({}, false).defaultPrevented, false);
  s.host.querySelector = () => null;
  assert.equal(s.send().defaultPrevented, false);
  assert.equal(s.frames.size, 0);
  assert.deepEqual(s.calls, []);
});
