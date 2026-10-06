import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import ExcelJS from 'exceljs';
import { parseSourceFilename, convertSources, writeHistory } from '../.script-build/scripts/convert-xlsx.js';

test('Имя выгрузки даёт год и строковый ID источника', () => {
  assert.deepEqual(parseSourceFilename('source/tournament-with-players-1710-2011.xlsx'), { tournamentId: '1710', year: 2011 });
  assert.deepEqual(parseSourceFilename('tournament-with-players-0017-2001.xlsx'), { tournamentId: '0017', year: 2001 });
});

test('XLSX по заголовкам преобразуются в полный ожидаемый JSON и пересоздаются', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'chr-flow-convert-'));
  try {
    await mkdir(join(dir, 'source'));
    const headers = ['IDplayer', 'Фамилия', 'Team ID', 'Место', 'Имя', 'Название', 'Отчество', 'Флаг', 'Город'];
    const early = new ExcelJS.Workbook();
    const sheet = early.addWorksheet('Результаты');
    sheet.addRow(headers);
    sheet.addRow(['001', ' Иванов ', '02', 6.5, ' Иван ', ' Старое ', ' Иванович ', 0, 'Город']);
    sheet.addRow([100, 'Иванов', 10, 6.5, 'Иван', 'Другая', 'Иванович', 1, 'Город']);
    sheet.addRow([]);
    for (let id = 2; id <= 7; id++) sheet.addRow([id, 'Петров', '02', 6.5, 'Пётр', 'Старое', '', 0]);
    await early.xlsx.writeFile(join(dir, 'source/tournament-with-players-0017-2001.xlsx'));
    const later = new ExcelJS.Workbook();
    later.addWorksheet('Первый').addRows([
      ['Название', 'Team ID', 'Место', 'IDplayer', 'Фамилия', 'Имя', 'Отчество'],
      [' Новое ', '02', 1, '001', ' Новая ', ' Анна ', ''],
    ]);
    await later.xlsx.writeFile(join(dir, 'source/tournament-with-players-18-2003.xlsx'));
    const manifest = join(dir, 'sources.json');
    await writeFile(manifest, JSON.stringify({ editions: [
      { file: 'source/tournament-with-players-18-2003.xlsx', name: 'Позднее проведение' },
      { file: 'source/tournament-with-players-0017-2001.xlsx', sheet: 'Результаты', name: 'Раннее проведение' },
    ] }));
    const expected = {
      schemaVersion: 1,
      editions: [{ id: '2001', year: 2001, name: 'Раннее проведение', tournamentId: '0017' }, { id: '2003', year: 2003, name: 'Позднее проведение', tournamentId: '18' }],
      teams: [{ id: '02', name: 'Новое' }, { id: '10', name: 'Другая' }],
      players: [
        { id: '001', name: 'Новая А.' }, { id: '100', name: 'Иванов И.' },
        ...['2', '3', '4', '5', '6', '7'].map(id => ({ id, name: 'Петров П.' })),
      ],
      participations: [
        { id: '2001:02', editionId: '2001', teamId: '02', displayName: 'Старое', place: 6.5, playerIds: ['001', '2', '3', '4', '5', '6', '7'] },
        { id: '2001:10', editionId: '2001', teamId: '10', displayName: 'Другая', place: 6.5, playerIds: ['100'] },
        { id: '2003:02', editionId: '2003', teamId: '02', displayName: 'Новое', place: 1, playerIds: ['001'] },
      ],
    };
    assert.deepEqual(await convertSources(manifest), expected);
    const output = join(dir, 'public/data/tournament-history.json');
    await writeHistory(manifest, output);
    assert.deepEqual(JSON.parse(await readFile(output, 'utf8')), expected);
    const first = await readFile(output, 'utf8');
    assert.equal(first.trimEnd().split('\n').length, 1, 'Готовый JSON должен записываться одной строкой');
    await writeFile(output, 'старый результат');
    await writeHistory(manifest, output);
    assert.equal(await readFile(output, 'utf8'), first);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

// Все входные компоненты этого сценария синтетические.
test('XLSX создаёт сокращённые подписи из отдельных колонок без отчества', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'chr-flow-names-'));
  try {
    const workbook = new ExcelJS.Workbook();
    workbook.addWorksheet('Имена').addRows([
      ['Team ID', 'Название', 'Место', 'IDplayer', 'Фамилия', 'Имя', 'Отчество'],
      ['01', 'Синтетическая команда', 1, '001', ' Тестов ', ' Иван ', 'Первое'],
      ['01', 'Синтетическая команда', 1, '002', 'Тестов', 'Иван', 'Второе'],
      ['01', 'Синтетическая команда', 1, '003', 'Демо-Пробный', 'Анна-Мария', ''],
      ['01', 'Синтетическая команда', 1, '004', 'ёлкин', 'ёгор', ''],
      ['01', 'Синтетическая команда', 1, '005', '', 'Имя', ''],
      ['01', 'Синтетическая команда', 1, '006', 'Тестов', '', ''],
      ['01', 'Синтетическая команда', 1, '007', '', '', ''],
      ['01', 'Синтетическая команда', 1, '008', 'Составная фамилия', '𐐨имя', ''],
    ]);
    await workbook.xlsx.writeFile(join(dir, 'tournament-with-players-001-2026.xlsx'));
    const manifest = join(dir, 'sources.json');
    await writeFile(manifest, JSON.stringify({ editions: [{ file: 'tournament-with-players-001-2026.xlsx', name: 'Синтетический турнир' }] }));
    assert.deepEqual((await convertSources(manifest)).players, [
      { id: '001', name: 'Тестов И.' }, { id: '002', name: 'Тестов И.' },
      { id: '003', name: 'Демо-Пробный А.' }, { id: '004', name: 'ёлкин Ё.' },
      { id: '005', name: 'И.' }, { id: '006', name: 'Тестов' },
      { id: '007', name: '' }, { id: '008', name: 'Составная фамилия 𐐀.' },
    ]);
  } finally { await rm(dir, { recursive: true, force: true }); }
});
