import { sizeDiagramStage } from './zoom';
import { diagramDimensions } from './geometry';
import { scalePoint } from 'd3-scale';
import { linkHorizontal } from 'd3-shape';
import type { DiagramData, HistoryIndex } from '../history';
import { createPlayerColors, getSelectionHistories, getSelectionRelations, isRosterParticipation, type Selection } from '../history/selection';

const namespace = 'http://www.w3.org/2000/svg';
function svgElement<K extends keyof SVGElementTagNameMap>(tag: K, attributes: Record<string, string | number> = {}): SVGElementTagNameMap[K] {
  const element = document.createElementNS(namespace, tag);
  for (const [key, value] of Object.entries(attributes)) element.setAttribute(key, String(value));
  return element;
}
export function renderDiagram(host: HTMLElement, data: DiagramData, index: HistoryIndex, selection: Selection, onSelect: (id: string) => void, scale = 1): void {
  const { width, height } = diagramDimensions([...data.participationsByEdition.values()].map(items => items.length));
  const svg = svgElement('svg', { width, height, 'aria-label': 'Команды по годам, от новых к старым' });
  const years = svgElement('svg', { width, height: 44, 'aria-label': 'Годы турниров' });
  const x = scalePoint<string>().domain(data.editions.map(edition => edition.id)).range([18, width - 218]);
  const positions = new Map<string, { x: number; y: number }>();
  const relations = getSelectionRelations(index, selection);
  const histories = getSelectionHistories(index, selection);
  const colors = createPlayerColors(histories.map(history => history.player.id));
  for (const edition of data.editions) {
    const label = svgElement('text', { x: x(edition.id)!, y: 30, class: 'year-label' });
    label.textContent = String(edition.year);
    if (edition.tournamentId) {
      const anchor = svgElement('a', {
        href: `https://rating.chgk.info/tournaments/${edition.tournamentId}`,
        target: '_blank', rel: 'noopener noreferrer', class: 'year-link',
        'aria-label': `${edition.year}: открыть турнир на rating.chgk.info (в новой вкладке)`,
      });
      anchor.append(label);
      years.append(anchor);
    } else years.append(label);
    data.participationsByEdition.get(edition.id)!.forEach((participation, row) => positions.set(participation.id, { x: x(edition.id)!, y: 65 + row * 42 }));
  }
  const curve = linkHorizontal<{ source: [number, number]; target: [number, number] }, [number, number]>().x(point => point[0]).y(point => point[1]);
  function drawLink(sourceId: string, targetId: string, gap: boolean, color: string, offset: number): void {
    const source = positions.get(sourceId)!;
    const target = positions.get(targetId)!;
    const path = svgElement('path', { d: curve({ source: [source.x, source.y + offset], target: [target.x + 200, target.y + offset] })!, fill: 'none', stroke: color, 'stroke-width': 2.5, class: 'player-link', 'aria-hidden': 'true' });
    if (gap) path.setAttribute('stroke-dasharray', '6 5');
    svg.append(path);
  }
  // Смещение зависит от позиции в полном наборе игроков, а не от фильтра.
  histories.forEach((history, position) => {
    if (selection.playerId && selection.playerId !== history.player.id) return;
    const spacing = Math.min(4, 24 / Math.max(1, histories.length - 1));
    const offset = (position - (histories.length - 1) / 2) * spacing;
    for (const link of data.playerLinks.filter(link => link.playerId === history.player.id)) drawLink(link.sourceId, link.targetId, link.isGap, colors.get(history.player.id)!, offset);
  });
  for (const edition of data.editions) {
    for (const participation of data.participationsByEdition.get(edition.id)!) {
      const point = positions.get(participation.id)!;
      const selected = participation.id === selection.participationId;
      const relation = relations.get(participation.id);
      const related = relation !== undefined;
      const sameTeam = !selected && relation?.sameTeam;
      const additional = !selected && relation?.additional;
      const roster = isRosterParticipation(index, selection, participation.id);
      const hasInfo = selected || related;
      const group = svgElement('g', { transform: `translate(${point.x},${point.y - 16})`, role: 'button', tabindex: -1, 'aria-pressed': String(selected), 'aria-label': `${edition.year}, место ${participation.place}, ${participation.displayName}${sameTeam ? ', та же команда, что и выбранная' : ''}${additional ? ', связь через другие составы' : ''}`, class: `team-node${selected ? ' selected' : ''}${related ? ' highlighted' : ''}${sameTeam ? ' same-team' : ''}${additional ? ' additional' : ''}`, 'data-participation-id': participation.id });
      group.append(svgElement('rect', { width: 200, height: 32, rx: 3 }));
      const title = svgElement('title'); title.textContent = `${participation.place} · ${participation.displayName}`; group.append(title);
      const foreign = svgElement('foreignObject', { x: 8, y: 0, width: hasInfo ? 158 : 184, height: 32 });
      const text = document.createElement('div'); text.className = 'team-label'; text.textContent = participation.displayName; foreign.append(text); group.append(foreign);
      group.addEventListener('click', () => onSelect(participation.id));
      group.addEventListener('keydown', event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onSelect(participation.id); } });
      svg.append(group);
      if (hasInfo) {
        // Кнопка — сосед узла команды, чтобы её нажатие не выбирало команду.
        const info = svgElement('foreignObject', { x: point.x + 168, y: point.y - 16, width: 32, height: 32 });
        const button = document.createElement('button');
        button.type = 'button';
        button.className = `team-info-button${selected ? ' selected' : sameTeam ? '' : ' other-team'}`;
        button.dataset.relatedParticipationId = participation.id;
        const infoLabel = roster ? (selected ? 'Выбранный состав' : 'Состав команды')
          : selection.allRosters ? 'Связь с составами выбранной команды' : 'Связь с выбранным составом';
        button.setAttribute('aria-label', `${infoLabel}: ${participation.displayName}, ${edition.year}`);
        button.setAttribute('aria-expanded', 'false');
        button.setAttribute('aria-controls', 'team-info-card');
        const icon = svgElement('svg', {
          viewBox: '0 0 24 24', width: 18, height: 18, fill: 'none',
          stroke: 'currentColor', 'stroke-width': 2, 'stroke-linecap': 'round',
          'stroke-linejoin': 'round', 'aria-hidden': 'true', focusable: 'false',
        });
        if (roster) {
          icon.append(
            svgElement('path', { d: 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2' }),
            svgElement('circle', { cx: 9, cy: 7, r: 4 }),
            svgElement('path', { d: 'M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75' }),
          );
        } else {
          icon.append(
            svgElement('path', { d: 'M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71' }),
            svgElement('path', { d: 'M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71' }),
          );
        }
        button.append(icon);
        info.append(button);
        svg.append(info);
      }
    }
  }
  const stage = document.createElement('div');
  stage.className = 'diagram-stage';
  stage.append(svg);
  const header = document.createElement('div');
  header.className = 'diagram-years';
  const clip = document.createElement('div');
  clip.className = 'diagram-years-clip';
  clip.append(years);
  header.append(clip);
  host.replaceChildren(header, stage);
  sizeDiagramStage(stage, svg, scale);
}
