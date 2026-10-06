import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createZoomFrameUpdate } from '../.test-build/diagram/zoom-frame.js';
import { zoomScroll } from '../.test-build/diagram/zoom.js';

function setup() {
  let scale = 1;
  let view = { left: 700, top: 500, width: 600, height: 400, diagramWidth: 3000, diagramHeight: 2000 };
  const frames = new Map();
  const calls = [];
  let id = 0;
  const queue = createZoomFrameUpdate(() => scale, (next, anchor, destination) => {
    view = { ...view, ...zoomScroll(view, scale, next, anchor, destination) };
    scale = next;
    calls.push({ scale, left: view.left, top: view.top });
  }, callback => { frames.set(++id, callback); return id; }, id => frames.delete(id));
  return { queue, calls, frames, flush: () => {
    const callbacks = [...frames.values()]; frames.clear(); callbacks.forEach(callback => callback(0));
  } };
}

test('Несколько перемещений пальцев дают один кадр с итоговым масштабом и якорем', () => {
  const s = setup();
  s.queue.schedule(1.2, { x: 100, y: 50 }, { x: 110, y: 60 });
  s.queue.schedule(1.5, { x: 110, y: 60 }, { x: 130, y: 90 });
  assert.equal(s.frames.size, 1);
  assert.deepEqual(s.calls, []);
  assert.equal(s.queue.getScale(), 1.5);
  s.flush();
  assert.deepEqual(s.calls, [{ scale: 1.5, left: 1070, top: 735 }]);
  s.queue.schedule(1.5, { x: 130, y: 90 }, { x: 140, y: 100 });
  s.flush();
  assert.deepEqual(s.calls.at(-1), { scale: 1.5, left: 1060, top: 725 });
});

test('Колесо с движущимся курсором сохраняет оба накопленных преобразования', () => {
  const s = setup();
  s.queue.schedule(1.25, { x: 200, y: 100 }, { x: 200, y: 100 });
  s.queue.schedule(1.5, { x: 300, y: 200 }, { x: 300, y: 200 });
  s.flush();
  assert.deepEqual(s.calls, [{ scale: 1.5, left: 1170, top: 820 }]);
});

test('Отмена перед сменой диаграммы не применяет старый жест и не блокирует следующий', () => {
  const s = setup();
  const point = { x: 100, y: 100 };
  s.queue.schedule(1.25, point, point);
  s.queue.cancel();
  assert.equal(s.frames.size, 0);
  assert.equal(s.queue.getScale(), 1);
  s.flush();
  assert.deepEqual(s.calls, []);
  s.queue.schedule(.5, point, point);
  s.flush();
  assert.deepEqual(s.calls, [{ scale: .5, left: 300, top: 200 }]);
});

test('Неизменный жест и взаимно обратные события не обновляют DOM', () => {
  const s = setup();
  const point = { x: 100, y: 100 };
  s.queue.schedule(1, point, point);
  assert.equal(s.frames.size, 0);
  s.queue.schedule(1.25, point, point);
  s.queue.schedule(1, point, point);
  s.flush();
  assert.deepEqual(s.calls, []);
});
