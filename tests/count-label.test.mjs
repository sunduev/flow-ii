import assert from 'node:assert/strict';
import { test } from 'node:test';
import { countLabel } from '../.test-build/model/count-label.js';

test('Русские счётчики: единицы, 2–4, 5–20 и окончания больших чисел', () => {
  for (const [forms, expected] of [
    [['турнир', 'турнира', 'турниров'], ['21 турнир', '22 турнира', '11 турниров']],
    [['команда', 'команды', 'команд'], ['21 команда', '22 команды', '11 команд']],
    [['игрок', 'игрока', 'игроков'], ['21 игрок', '22 игрока', '11 игроков']],
  ]) {
    for (const [i, count] of [21, 22, 11].entries()) assert.equal(countLabel(count, forms), expected[i]);
    for (const count of [0, 5, 10, 12, 13, 14, 20, 111, 112, 114]) assert.equal(countLabel(count, forms), `${count} ${forms[2]}`);
    for (const count of [1, 101, 671]) assert.equal(countLabel(count, forms), `${count} ${forms[0]}`);
    for (const count of [2, 3, 4, 102, 104]) {
      assert.equal(countLabel(count, forms), `${count} ${forms[1]}`);
    }
  }
});
