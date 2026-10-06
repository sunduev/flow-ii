import './style.css';
import { loadHistory } from './model/load-history';
import { resolveTournamentPage } from './model/tournament-page';
import { countLabel } from './model/count-label';
import { createHistoryIndex, buildHistoryGraph, getDiagramData } from './history';
import { getHistoryDiagramData } from './history/diagram-view';
import { initialSelection, selectParticipation, selectPlayer, togglePlayer, playerLabel, setAllRosters } from './history/selection';
import { renderDiagram } from './diagram';
import { createTeamInfo } from './diagram/team-info';
import { enableDiagramPan } from './diagram/pan';
import { zoomDiagram, enableDiagramDoubleClickZoom, type ZoomPoint } from './diagram/zoom';
const status = document.querySelector<HTMLElement>('#load-status')!;
async function start(): Promise<void> {
  // Vite не должен преобразовывать runtime URL каталога в URL статического ресурса.
  // Общий модуль находится в src/ при dev и assets/ после сборки.
  const siteUrl = new URL(/* @vite-ignore */ '../', import.meta.url);
  const page = resolveTournamentPage(location.pathname, siteUrl.pathname, __TOURNAMENT_ROUTES__);
  if ('redirect' in page) {
    location.replace(page.redirect + location.search + location.hash);
    return;
  }
  const { tournament } = page;
  document.title = `Инфографика ${tournament.name}`;
  const index = createHistoryIndex(await loadHistory(new URL(tournament.history, siteUrl).href));
  const graph = buildHistoryGraph(index);
  let selection = initialSelection(index);
  const diagram = document.querySelector<HTMLElement>('#diagram')!;
  enableDiagramPan(diagram);
  const playerFilter = document.querySelector<HTMLButtonElement>('#player-filter')!;
  const playerFilterName = document.querySelector<HTMLElement>('#player-filter-name')!;
  const from = document.querySelector<HTMLSelectElement>('#from-year')!;
  const to = document.querySelector<HTMLSelectElement>('#to-year')!;
  const allRostersButton = document.querySelector<HTMLButtonElement>('#all-rosters-mode')!;
  const compactButton = document.querySelector<HTMLButtonElement>('#compact-mode')!;
  const zoomOut = document.querySelector<HTMLButtonElement>('#zoom-out')!;
  const zoomReset = document.querySelector<HTMLButtonElement>('#zoom-reset')!;
  const zoomIn = document.querySelector<HTMLButtonElement>('#zoom-in')!;
  const scales = [10, 25, 33, 50, 67, 80, 100, 125, 150, 200];
  let scaleIndex = scales.indexOf(100);
  let compact = false;
  let resultsView = { left: 0, top: 0 };
  if (!selection.participationId) { status.textContent = 'Пока нет результатов турнира.'; }
  else {
    document.querySelector<HTMLElement>('#workspace')!.hidden = false;
    status.textContent = `${tournament.name} · ${countLabel(index.editions.length, ['турнир', 'турнира', 'турниров'])} · ${countLabel(index.teamById.size, ['команда', 'команды', 'команд'])} · ${countLabel(index.playerById.size, ['игрок', 'игрока', 'игроков'])}`;
    for (const edition of index.editions) for (const select of [from, to]) select.add(new Option(String(edition.year), String(edition.year)));
    from.value = String(index.editions[0].year); to.value = String(index.editions.at(-1)!.year);
    const teamInfo = createTeamInfo(diagram, index, () => selection, id => {
      selection = togglePlayer(selection, id);
      draw();
    });
    playerFilter.addEventListener('click', () => {
      selection = selectPlayer(selection, null);
      draw();
      compactButton.focus({ preventScroll: true });
    });

    function changeScale(nextIndex: number, point?: ZoomPoint): void {
      const previous = scales[scaleIndex] / 100;
      const next = Math.max(0, Math.min(nextIndex, scales.length - 1));
      if (next === scaleIndex) return;
      scaleIndex = next;
      teamInfo.hide();
      zoomDiagram(diagram, previous, scales[scaleIndex] / 100, point);
      // Сохранённая прокрутка общей таблицы тоже выражена в масштабированных px.
      const ratio = scales[scaleIndex] / 100 / previous;
      resultsView = { left: resultsView.left * ratio, top: resultsView.top * ratio };
      zoomReset.textContent = `${scales[scaleIndex]}%`;
      zoomReset.setAttribute('aria-label', `Масштаб ${scales[scaleIndex]}%. Вернуть 100%`);
      zoomOut.disabled = scaleIndex === 0;
      zoomIn.disabled = scaleIndex === scales.length - 1;
    }
    zoomOut.addEventListener('click', () => changeScale(scaleIndex - 1));
    zoomReset.addEventListener('click', () => changeScale(scales.indexOf(100)));
    zoomIn.addEventListener('click', () => changeScale(scaleIndex + 1));
    enableDiagramDoubleClickZoom(diagram, () => scales[scaleIndex] / 100, point => changeScale(scales.indexOf(100), point));

    function draw(): void {
      teamInfo.hide();
      playerFilter.hidden = selection.playerId === null;
      if (selection.playerId) {
        const name = playerLabel(index, selection.playerId);
        playerFilterName.textContent = name;
        playerFilter.setAttribute('aria-label', `Убрать фильтр игрока: ${name}`);
      }
      const base = getDiagramData(index, graph, { fromYear: Number(from.value), toYear: Number(to.value) });
      const data = compact ? getHistoryDiagramData(index, base, selection) : base;
      const count = [...data.participationsByEdition.values()].reduce((sum, entries) => sum + entries.length, 0);
      compactButton.setAttribute('aria-pressed', String(compact));
      allRostersButton.setAttribute('aria-pressed', String(selection.allRosters));
      if (count === 0 && compact) {
        const empty = document.createElement('p');
        empty.className = 'diagram-empty';
        empty.textContent = 'В этом диапазоне нет участий выбранной истории. Выбор сохранён. Измените период, чтобы увидеть участия этой истории.';
        diagram.replaceChildren(empty);
      } else {
        renderDiagram(diagram, data, index, selection, id => {
          selection = selectParticipation(selection, id);
          draw();
          diagram.querySelector<SVGGElement>(`[data-participation-id="${CSS.escape(id)}"]`)?.focus();
        }, scales[scaleIndex] / 100);
      }
    }

    allRostersButton.addEventListener('click', () => {
      selection = setAllRosters(index, selection, !selection.allRosters);
      draw();
    });
    compactButton.addEventListener('click', () => {
      if (!compact) resultsView = { left: diagram.scrollLeft, top: diagram.scrollTop };
      compact = !compact; draw();
      if (!compact) { diagram.scrollLeft = resultsView.left; diagram.scrollTop = resultsView.top; }
    });
    from.addEventListener('change', () => { if (Number(from.value) > Number(to.value)) to.value = from.value; draw(); });
    to.addEventListener('change', () => { if (Number(to.value) < Number(from.value)) from.value = to.value; draw(); });
    draw();

  }
}
void start().catch(error => { status.textContent = error instanceof Error ? error.message : 'Не удалось загрузить JSON.'; status.classList.add('error'); });
