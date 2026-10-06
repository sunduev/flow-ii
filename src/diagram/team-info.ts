import type { HistoryIndex } from '../history';
import { createPlayerColors, getSelectionPlayerIds, getTeamInfoPlayerIds, isRosterParticipation, playerLabel, type Selection } from '../history/selection';
import { createFrameUpdate, shouldCloseOnOutsideClick, shouldCloseOnResize, shouldCloseOnScroll } from './team-info-events';
import { teamInfoPosition, teamInfoSize } from './team-info-position';

/** Одна карточка поверх страницы. Её открытие не меняет выбор и SVG. */
export function createTeamInfo(host: HTMLElement, index: HistoryIndex, getSelection: () => Selection, onPlayer: (id: string) => void): { hide: () => void } {
  const mobile = window.matchMedia('(max-width: 600px), (hover: none)');
  const card = document.createElement('section');
  card.id = 'team-info-card';
  card.className = 'team-info-card';
  card.setAttribute('aria-labelledby', 'team-info-heading');
  card.tabIndex = -1;
  card.hidden = true;
  document.body.append(card);
  let opener: HTMLButtonElement | null = null;
  let viewport = { width: window.innerWidth, height: window.innerHeight };
  let measured: { width: number; height: number; size: ReturnType<typeof teamInfoSize>; bottomInset: number } | null = null;
  const frameUpdate = createFrameUpdate(position, callback => window.requestAnimationFrame(callback), id => window.cancelAnimationFrame(id));

  function schedulePosition(): void {
    if (!card.hidden && opener?.isConnected) frameUpdate.schedule();
  }

  function position(): void {
    if (card.hidden || !opener?.isConnected) return;
    const visual = window.visualViewport;
    const visible = {
      left: visual?.offsetLeft ?? 0, top: visual?.offsetTop ?? 0,
      width: visual?.width ?? window.innerWidth, height: visual?.height ?? window.innerHeight,
      scale: visual?.scale ?? 1,
    };
    const bottomInset = measured?.bottomInset ?? (mobile.matches ? parseFloat(getComputedStyle(card).marginBottom) : 12);
    const size = teamInfoSize(visible, mobile.matches, bottomInset);
    // Нижняя мобильная панель не зависит от положения кнопки в SVG.
    const anchor = mobile.matches ? { left: 0, right: 0, top: 0, bottom: 0 } : opener.getBoundingClientRect();
    if (!measured || size.width !== measured.size.width || size.maxHeight !== measured.size.maxHeight || size.scale !== measured.size.scale) {
      card.style.width = `${size.width}px`;
      card.style.maxHeight = `${size.maxHeight}px`;
      card.style.transform = `scale(${size.scale})`;
      // Повторное измерение нужно только после смены содержимого или размера.
      measured = { width: card.offsetWidth, height: card.offsetHeight, size, bottomInset };
    }
    const point = teamInfoPosition(anchor, measured, visible, mobile.matches, bottomInset);
    const left = `${point.left}px`;
    const top = `${point.top}px`;
    if (card.style.left !== left) card.style.left = left;
    if (card.style.top !== top) card.style.top = top;
  }

  function hide(restoreFocus = false): void {
    frameUpdate.cancel();
    measured = null;
    const button = opener;
    const focusInside = card.contains(document.activeElement);
    card.hidden = true;
    opener = null;
    button?.setAttribute('aria-expanded', 'false');
    if ((restoreFocus || focusInside) && button?.isConnected) button.focus({ preventScroll: true });
  }
  function buttonFor(target: EventTarget | null): HTMLButtonElement | null {
    if (!(target instanceof Element)) return null;
    const button = target.closest<HTMLButtonElement>('.team-info-button');
    return button && host.contains(button) ? button : null;
  }
  function open(button: HTMLButtonElement, id = button.dataset.relatedParticipationId!): void {
    if (button === opener) { hide(true); return; }
    hide();
    const selection = getSelection();
    const playerIds = getTeamInfoPlayerIds(index, selection, id);
    if (!playerIds.length) return;
    const participation = index.participationById.get(id)!;
    const active = index.participationById.get(selection.participationId!)!;
    const roster = isRosterParticipation(index, selection, id);
    const colors = createPlayerColors(getSelectionPlayerIds(index, selection));
    const header = document.createElement('div');
    header.className = 'team-info-header';
    const heading = document.createElement('h3');
    heading.id = 'team-info-heading';
    heading.textContent = `${participation.displayName} · ${index.editionById.get(participation.editionId)!.year}`;
    const close = document.createElement('button');
    close.type = 'button';
    close.className = 'team-info-close';
    close.setAttribute('aria-label', roster ? 'Закрыть состав команды' : 'Закрыть связь команд');
    close.textContent = '×';
    close.addEventListener('click', () => hide(true));
    header.append(heading, close);
    const place = document.createElement('p');
    place.className = 'team-info-caption';
    place.textContent = `Место: ${String(participation.place).replace('.', ',')}`;
    const caption = document.createElement('p');
    caption.className = 'team-info-caption';
    caption.textContent = selection.allRosters ? `Из составов «${active.displayName}»:` : `Из выбранного состава «${active.displayName} · ${index.editionById.get(active.editionId)!.year}»:`;
    const list = document.createElement('ul');
    function choose(playerId: string): void {
      // Перерисовка заменяет SVG: найдём новую кнопку того же участия.
      onPlayer(playerId);
      const anchor = host.querySelector<HTMLButtonElement>(`[data-related-participation-id="${CSS.escape(id)}"]`);
      if (!anchor) return;
      open(anchor);
      const focusTarget = card.querySelector<HTMLButtonElement>(`[data-player-id="${CSS.escape(playerId)}"]`);
      focusTarget?.focus({ preventScroll: true });
    }
    for (const playerId of playerIds) {
      const item = document.createElement('li');
      const marker = document.createElement('span');
      marker.className = 'team-info-marker';
      marker.style.backgroundColor = colors.get(playerId)!;
      marker.setAttribute('aria-hidden', 'true');
      if (roster) {
        const player = document.createElement('button');
        player.type = 'button';
        player.className = 'roster-player';
        player.dataset.playerId = playerId;
        player.setAttribute('aria-pressed', String(selection.playerId === playerId));
        player.append(marker, document.createTextNode(playerLabel(index, playerId)));
        if (selection.playerId === playerId) {
          const remove = document.createElement('span');
          remove.className = 'filter-remove';
          remove.textContent = '×';
          remove.setAttribute('aria-hidden', 'true');
          player.append(remove);
        }
        player.addEventListener('click', () => choose(playerId));
        item.append(player);
      } else item.append(marker, document.createTextNode(playerLabel(index, playerId)));
      list.append(item);
    }
    card.replaceChildren(header, place, ...(roster ? [] : [caption]), list);
    card.hidden = false;
    opener = button;
    position();
    button.setAttribute('aria-expanded', 'true');
    card.focus({ preventScroll: true });
  }
  host.addEventListener('click', event => {
    const button = buttonFor(event.target);
    if (button) { event.stopPropagation(); open(button); }
  });
  // Завершённое нажатие закрывает карточку, начало pan/pinch — нет.
  document.addEventListener('click', event => {
    if (shouldCloseOnOutsideClick(event.composedPath(), card, buttonFor(event.target) !== null)) hide();
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && opener) { event.preventDefault(); hide(true); }
  });
  window.addEventListener('scroll', event => {
    const target = event.target;
    const origin = target instanceof Node && card.contains(target) ? 'card'
      : target instanceof Node && host.contains(target) ? 'diagram' : 'page';
    if (shouldCloseOnScroll(origin, mobile.matches)) hide();
    else if (origin !== 'card') schedulePosition();
  }, true);
  window.addEventListener('resize', () => {
    const next = { width: window.innerWidth, height: window.innerHeight };
    // Высота на телефоне может меняться вместе с панелями браузера.
    if (shouldCloseOnResize(viewport, next, mobile.matches)) hide();
    else schedulePosition();
    viewport = next;
  });
  mobile.addEventListener('change', () => hide());
  window.visualViewport?.addEventListener('resize', schedulePosition);
  window.visualViewport?.addEventListener('scroll', schedulePosition);
  return { hide: () => hide() };
}
