import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { basename, dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import ExcelJS from 'exceljs';
import type { TournamentHistory, Participation } from '../src/model/types.js';
import { getTournament, readTournamentRegistry } from './tournaments.js';

interface SourceEdition { file: string; name: string; sheet?: string }
interface SourceList { editions: SourceEdition[] }

export function parseSourceFilename(file: string): { tournamentId: string; year: number } {
  const match = /^tournament-with-players-(\d+)-(\d{4})\.xlsx$/.exec(basename(file))!;
  return { tournamentId: match[1], year: Number(match[2]) };
}

function cellText(cell: ExcelJS.Cell): string {
  return (typeof cell.value === 'number' ? String(cell.value) : cell.text).trim();
}

/** Отдельные колонки XLSX становятся отображаемым именем без отчества. */
function formatPlayerName(firstName: string, lastName: string): string {
  const initial = Array.from(firstName)[0]?.toUpperCase();
  return [lastName, initial ? initial + '.' : ''].filter(Boolean).join(' ');
}

const compareIds = (a: string, b: string): number => a < b ? -1 : a > b ? 1 : 0;

/** Читает корректные источники по контракту; факты не валидируются. */
export async function convertSources(manifestPath: string): Promise<TournamentHistory> {
  const sources: SourceList = JSON.parse(await readFile(manifestPath, 'utf8'));
  const editions = sources.editions.map(source => ({ ...source, ...parseSourceFilename(source.file) }))
    .sort((a, b) => a.year - b.year);
  const teams = new Map<string, string>();
  const players = new Map<string, string>();
  const history: TournamentHistory = { schemaVersion: 1, editions: [], teams: [], players: [], participations: [] };
  for (const source of editions) {
    const editionId = String(source.year);
    history.editions.push({ id: editionId, year: source.year, name: source.name.trim(), tournamentId: source.tournamentId });
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(resolve(dirname(manifestPath), source.file));
    const sheet = source.sheet ? workbook.getWorksheet(source.sheet) : workbook.worksheets[0];
    if (!sheet) throw new Error(`Не удалось прочитать лист ${source.sheet ?? '(первый)'}: ${source.file}`);
    const columns = new Map<string, number>();
    sheet.getRow(1).eachCell((cell, column) => columns.set(cellText(cell), column));
    const groups = new Map<string, Participation>();
    sheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return;
      let hasContent = false;
      row.eachCell(cell => { if (cellText(cell)) hasContent = true; });
      if (!hasContent) return;
      const text = (header: string): string => cellText(row.getCell(columns.get(header)!));
      const teamId = text('Team ID');
      const playerId = text('IDplayer');
      const displayName = text('Название');
      teams.set(teamId, displayName);
      players.set(playerId, formatPlayerName(text('Имя'), text('Фамилия')));
      let participation = groups.get(teamId);
      if (!participation) {
        participation = { id: `${editionId}:${teamId}`, editionId, teamId, displayName, place: Number(text('Место')), playerIds: [] };
        groups.set(teamId, participation);
      }
      participation.playerIds.push(playerId);
    });
    const participations = [...groups.values()].sort((a, b) => a.place - b.place || compareIds(a.teamId, b.teamId));
    for (const participation of participations) participation.playerIds.sort(compareIds);
    history.participations.push(...participations);
  }
  history.teams = [...teams].sort(([a], [b]) => compareIds(a, b)).map(([id, name]) => ({ id, name }));
  history.players = [...players].sort(([a], [b]) => compareIds(a, b)).map(([id, name]) => ({ id, name }));
  return history;
}

export async function writeHistory(manifestPath: string, outputPath: string): Promise<TournamentHistory> {
  const history = await convertSources(manifestPath);
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(history)}\n`, 'utf8');
  return history;
}

/** Пересоздаёт историю только выбранной серии, не обращаясь к другим исходникам. */
export async function writeTournament(slug?: string, root = process.cwd()): Promise<TournamentHistory> {
  const registry = await readTournamentRegistry(root);
  const tournament = getTournament(registry, slug ?? registry.defaultTournament);
  return writeHistory(resolve(root, tournament.sources), resolve(root, 'public', tournament.history));
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    const history = process.argv[3]
      ? await writeHistory(resolve(process.argv[2]), resolve(process.argv[3]))
      : await writeTournament(process.argv[2]);
    console.log(`История сохранена${process.argv[2] ? `: ${process.argv[2]}` : ''}.\n${history.editions.length} проведений, ${history.participations.length} участий, ${history.players.length} игроков.`);
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
