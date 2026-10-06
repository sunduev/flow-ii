import assert from 'node:assert/strict';
import { test } from 'node:test';
import { shouldCloseOnResize, shouldCloseOnScroll } from '../.test-build/diagram/team-info-events.js';

test('Мобильная карточка остаётся открытой при изменении высоты окна', () => {
  assert.equal(shouldCloseOnResize({ width: 390, height: 844 }, { width: 390, height: 800 }, true), false);
  assert.equal(shouldCloseOnResize({ width: 390, height: 800 }, { width: 390, height: 844 }, true), false);
});

test('Смена ширины закрывает карточку, десктоп учитывает и высоту', () => {
  assert.equal(shouldCloseOnResize({ width: 390, height: 844 }, { width: 844, height: 390 }, true), true);
  assert.equal(shouldCloseOnResize({ width: 1280, height: 720 }, { width: 1280, height: 600 }, false), true);
  assert.equal(shouldCloseOnResize({ width: 1280, height: 720 }, { width: 1280, height: 720 }, false), false);
});

test('Прокрутка страницы и диаграммы сохраняет мобильную карточку', () => {
  assert.equal(shouldCloseOnScroll('page', true), false);
  assert.equal(shouldCloseOnScroll('diagram', true), false);
  assert.equal(shouldCloseOnScroll('page', false), true);
  assert.equal(shouldCloseOnScroll('diagram', false), true);
  assert.equal(shouldCloseOnScroll('card', true), false);
  assert.equal(shouldCloseOnScroll('card', false), false);
});

test('Нажатие игрока остаётся внутренним после замены списка; отдельное внешнее нажатие закрывает', async () => {
  const { shouldCloseOnOutsideClick } = await import('../.test-build/diagram/team-info-events.js');
  const card = new EventTarget();
  const removedPlayer = new EventTarget();
  const outside = new EventTarget();
  assert.equal(shouldCloseOnOutsideClick([removedPlayer,card], card, false), false);
  assert.equal(shouldCloseOnOutsideClick([outside], card, false), true);
  assert.equal(shouldCloseOnOutsideClick([outside], card, true), false);
});
