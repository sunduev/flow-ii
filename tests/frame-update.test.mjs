import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createFrameUpdate } from '../.test-build/diagram/team-info-events.js';

test('Серия событий обновляет актуальное состояние один раз в кадр; следующий кадр доступен', () => {
  const pending = new Map();
  let nextId = 0;
  let state = 0;
  const seen = [];
  const update = createFrameUpdate(() => seen.push(state), callback => {
    pending.set(++nextId, callback);
    return nextId;
  }, id => pending.delete(id));
  for (state = 0; state < 10; state++) update.schedule();
  assert.equal(pending.size, 1);
  const flush = () => { const callbacks = [...pending.values()]; pending.clear(); callbacks.forEach(callback => callback(0)); };
  flush();
  assert.deepEqual(seen, [10]);
  state = 20;
  update.schedule();
  flush();
  assert.deepEqual(seen, [10, 20]);
});

test('Закрытие отменяет ожидающее обновление; повторное открытие допускает новую очередь', () => {
  const pending = new Map();
  let nextId = 0;
  let calls = 0;
  const update = createFrameUpdate(() => calls++, callback => {
    pending.set(++nextId, callback);
    return nextId;
  }, id => pending.delete(id));
  update.schedule();
  update.cancel();
  update.cancel();
  assert.equal(pending.size, 0);
  assert.equal(calls, 0);
  update.schedule();
  const callback = [...pending.values()][0];
  pending.clear();
  callback(0);
  assert.equal(calls, 1);
});
