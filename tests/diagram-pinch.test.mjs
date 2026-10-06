import assert from 'node:assert/strict';
import { test } from 'node:test';
import { enableDiagramPinchZoom } from '../.test-build/diagram/pinch.js';
import { zoomDiagram } from '../.test-build/diagram/zoom.js';
import { createZoomFrameUpdate } from '../.test-build/diagram/zoom-frame.js';

function setup(initialScale = 1, batched = false) {
  const host = new EventTarget();
  host.ownerDocument = new EventTarget();
  host.clientLeft = host.clientTop = 1;
  host.clientWidth = 600; host.clientHeight = 400;
  host.scrollLeft = 700; host.scrollTop = 500;
  host.getBoundingClientRect = () => ({ left: 20, top: 30 });
  const svg = { style: {}, getAttribute: name => ({ width: '3000', height: '2000' })[name] };
  const stage = { style: {}, querySelector: () => svg };
  host.querySelector = () => stage;
  const child = {};
  host.contains = target => target === host || target === child;
  let scale = initialScale;
  let starts = 0;
  const changes = [];
  const frames = new Map();
  let frameId = 0;
  const apply = (next, anchor, point) => {
    changes.push(next);
    zoomDiagram(host, scale, next, anchor, point);
    scale = next;
  };
  const queue = createZoomFrameUpdate(() => scale, apply,
    callback => { frames.set(++frameId, callback); return frameId; }, id => frames.delete(id));
  enableDiagramPinchZoom(host, () => scale, batched ? queue.schedule : apply, () => { starts++; queue.cancel(); });
  function touch(identifier, x, y = 100, target = host) { return { identifier, clientX: x + 21, clientY: y + 31, target }; }
  function send(type, touches = [], values = {}) {
    const event = new Event(type, { cancelable: true });
    Object.assign(event, { touches, detail: 1 }, values);
    (['touchend', 'touchcancel'].includes(type) ? host.ownerDocument : host).dispatchEvent(event);
    return event;
  }
  return { host, svg, stage, child, send, touch, changes, scale: () => scale, starts: () => starts, frames,
    flush: () => { const callbacks = [...frames.values()]; frames.clear(); callbacks.forEach(callback => callback(0)); } };
}

test('Несколько движений и отпускание до кадра сохраняют последний масштаб и перемещение', () => {
  const s = setup(1, true);
  s.send('touchstart', [s.touch(1, 100), s.touch(2, 200)]);
  s.send('touchmove', [s.touch(1, 90, 110), s.touch(2, 210, 110)]);
  s.send('touchmove', [s.touch(1, 95, 120), s.touch(2, 245, 120)]);
  s.send('touchend');
  assert.equal(s.scale(), 1);
  assert.equal(s.frames.size, 1);
  s.flush();
  assert.deepEqual(s.changes, [1.5]);
  assert.equal(s.host.scrollLeft, 1105);
  assert.equal(s.host.scrollTop, 780);
});

test('Растяжение и сжатие плавно масштабируют существующий SVG вокруг пальцев', () => {
  const s = setup();
  assert.equal(s.send('touchstart', [s.touch(1, 100), s.touch(2, 200, 100, s.child)]).defaultPrevented, true);
  assert.equal(s.starts(), 1);
  assert.equal(s.send('touchmove', [s.touch(1, 75), s.touch(2, 225, 100, s.child)]).defaultPrevented, true);
  assert.equal(s.scale(), 1.5);
  assert.equal(s.svg.style.transform, 'scale(1.5)');
  assert.equal(s.stage.style.width, '4500px');
  assert.equal(s.host.scrollLeft, 1125);
  assert.equal(s.host.scrollTop, 800);
  s.send('touchmove', [s.touch(2, 175, 100, s.child), s.touch(1, 125)]);
  assert.equal(s.scale(), .5);
  assert.equal(s.host.scrollLeft, 275);
  assert.equal(s.host.scrollTop, 200);
});

test('Середину можно двигать без изменения масштаба, в том числе на пределе', () => {
  const s = setup(2);
  s.send('touchstart', [s.touch(1, 100), s.touch(2, 200)]);
  s.send('touchmove', [s.touch(1, 130, 120), s.touch(2, 230, 120)]);
  assert.equal(s.scale(), 2);
  assert.equal(s.host.scrollLeft, 670);
  assert.equal(s.host.scrollTop, 480);
});

test('Масштаб ограничен 10–200%, края прокрутки не уходят в минус', () => {
  const s = setup();
  s.send('touchstart', [s.touch(1, 100), s.touch(2, 200)]);
  s.send('touchmove', [s.touch(1, 0), s.touch(2, 500)]);
  assert.equal(s.scale(), 2);
  s.send('touchmove', [s.touch(1, 150), s.touch(2, 151)]);
  assert.equal(s.scale(), .1);
  assert.equal(s.host.scrollLeft, 0);
  assert.equal(s.host.scrollTop, 0);
});

test('Один палец, касание вне диаграммы, нулевой размах и пустая диаграмма остаются нативными', () => {
  for (const kind of ['single', 'outside', 'zero', 'empty']) {
    const s = setup();
    if (kind === 'empty') s.host.querySelector = () => null;
    const touches = kind === 'single' ? [s.touch(1, 100)] : [s.touch(1, 100), s.touch(2, kind === 'zero' ? 100 : 200, 100, kind === 'outside' ? {} : s.host)];
    assert.equal(s.send('touchstart', touches).defaultPrevented, false);
    assert.equal(s.send('touchmove', touches).defaultPrevented, false);
    assert.deepEqual(s.changes, []);
    assert.equal(s.starts(), 0);
    assert.equal(s.send('click').defaultPrevented, false);
  }
});

test('Отпускание/отмена завершают зум; остаточное касание и клик не выбирают команду', () => {
  for (const type of ['touchend', 'touchcancel']) {
    const s = setup();
    s.send('touchstart', [s.touch(1, 100), s.touch(2, 200)]);
    s.send('touchmove', [s.touch(1, 75), s.touch(2, 225)]);
    s.send(type, [s.touch(1, 75)]);
    assert.equal(s.send('touchmove', [s.touch(1, 50)]).defaultPrevented, true);
    assert.equal(s.scale(), 1.5);
    s.send('touchend');
    assert.equal(s.send('click', [], { detail: 0 }).defaultPrevented, false);
    assert.equal(s.send('click').defaultPrevented, true);
    s.send('touchstart', [s.touch(3, 100)]);
    s.send('touchend');
    assert.equal(s.send('click').defaultPrevented, false);
    s.send('touchstart', [s.touch(4, 100), s.touch(5, 200)]);
    s.send('touchmove', [s.touch(4, 100), s.touch(5, 180)]);
    assert.ok(Math.abs(s.scale() - 1.2) < 1e-10);
  }
});

test('Третий палец и потеря отменяемого события не продолжают зум', () => {
  const s = setup();
  s.send('touchstart', [s.touch(1, 100), s.touch(2, 200)]);
  s.send('touchstart', [s.touch(1, 100), s.touch(2, 200), s.touch(3, 300)]);
  s.send('touchmove', [s.touch(1, 50), s.touch(2, 250), s.touch(3, 300)]);
  assert.equal(s.scale(), 1);
  s.send('touchend');
  s.send('touchstart', [s.touch(4, 100), s.touch(5, 200)]);
  const event = new Event('touchmove');
  Object.assign(event, { touches: [s.touch(4, 50), s.touch(5, 250)] });
  s.host.dispatchEvent(event);
  assert.equal(s.scale(), 1);
});
