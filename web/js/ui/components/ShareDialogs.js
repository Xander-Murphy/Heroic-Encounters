import { CannotUpdateError, ImportStatus, PublishState } from '../../sharing/ShareService.js';
import { copyToClipboard, h, plural, replaceChildren } from '../dom.js';
import { characterCard } from './Card.js';
import { Modal } from './Modal.js';

const KIND_ICON = { hero: '🦸', enemy: '👹', dungeon: '🏰' };

const STATUS_TEXT = {
  [ImportStatus.NEW]: { label: 'New', tone: 'good' },
  [ImportStatus.UPDATE]: { label: 'Update', tone: 'info' },
  [ImportStatus.INVALID]: { label: 'Invalid — skipped', tone: 'bad' },
  [ImportStatus.BLOCKED]: { label: 'Already yours — skipped', tone: 'muted' },
};

/** Small preview of a definition: a card for characters, a summary for dungeons. */
export function definitionPreview(definition, library) {
  if (definition.kind === 'dungeon') {
    return h('div', { class: 'dungeon-chip' },
      h('div', { class: 'dungeon-chip-icon' }, definition.icon),
      h('div', {}, h('b', {}, definition.name), h('div', { class: 'muted' }, definition.description || `${plural(definition.waves.length, 'wave')} and a boss`)));
  }
  try {
    return characterCard(library.factory.createCharacter(definition), { classes: 'small' });
  } catch {
    return h('div', { class: 'muted' }, definition.name);
  }
}

/** Shows what a paste would add, then imports on confirmation. Returns the report or null. */
export async function openImportDialog(app, input) {
  const { sharing, library } = app.services;
  const preview = await sharing.preview(input);

  if (preview.errors?.length) {
    app.toaster.error(preview.errors[0]);
    return null;
  }

  const importable = preview.items.filter((item) => [ImportStatus.NEW, ImportStatus.UPDATE].includes(item.status));
  const body = h('div', { class: 'import-preview' },
    h('p', {}, preview.author ? `Shared by ${preview.author}` : 'Shared content', preview.code ? ` · code ${preview.code}` : ''),
    h('div', { class: 'import-items' }, preview.items.map((item) => {
      const status = STATUS_TEXT[item.status];
      return h('div', { class: 'import-item' },
        h('div', { class: 'import-item-head' },
          h('span', {}, `${KIND_ICON[item.definition?.kind] ?? '❔'} ${item.name}`),
          h('span', { class: ['pill', `pill-${status.tone}`] }, status.label)),
        item.valid ? definitionPreview(item.definition, library) : h('ul', { class: 'errors' }, item.errors.slice(0, 4).map((error) => h('li', {}, error))));
    })),
    importable.length ? null : h('p', { class: 'muted' }, 'There is nothing new to import.'));

  const confirmed = await new Modal({
    title: preview.title ? `Import "${preview.title}"` : 'Import content',
    body,
    wide: true,
    actions: [
      { label: 'Cancel', value: false },
      ...(importable.length ? [{ label: `Import ${plural(importable.length, 'item')}`, value: true, primary: true }] : []),
    ],
  }).open();
  if (!confirmed) return null;

  const report = sharing.importPreview(preview);
  const added = report.added.length + report.updated.length;
  app.toaster.show(`${added} added to your collection${report.skipped.length ? `, ${report.skipped.length} skipped` : ''}.`, { icon: '📥', tone: 'good' });
  return report;
}

/** Share options for one piece of content: string, link, community code. */
export async function openShareDialog(app, id) {
  const { sharing, library, api, account } = app.services;
  const definition = library.get(id);
  let shareString;
  try {
    shareString = await sharing.exportString([id]);
  } catch (error) {
    app.toaster.error(error.message);
    return;
  }
  const link = `${location.origin}${location.pathname}#import=${shareString}`;
  const bundled = library.bundleFor([id]).length - 1;
  const codeArea = h('div', { class: 'share-code' });
  const communityIntro = h('p', {});
  const communityActions = h('div', { class: 'row-left' });
  let closeDialog = () => {};

  const copy = async (text, what) => {
    if (await copyToClipboard(text)) app.toaster.show(`${what} copied — send it to a friend!`, { icon: '📋', tone: 'good' });
    else app.toaster.error('Could not copy. Select the text and copy it manually.');
  };

  /** A button that stays disabled and says `busyLabel` while its task runs. */
  const actionButton = (label, busyLabel, task, classes = '') => {
    const button = h('button', {
      class: classes,
      disabled: !api.available,
      onclick: async () => {
        button.disabled = true;
        button.textContent = busyLabel;
        await task();
        button.disabled = false;
        button.textContent = label;
      },
    }, label);
    return button;
  };

  const renderCommunity = ({ offerNewEntry = false } = {}) => {
    const code = library.meta(id)?.publishedCode;
    const state = sharing.publishState(id);
    communityIntro.className = api.available ? '' : 'muted';
    if (!api.available) communityIntro.textContent = 'The community server isn\'t reachable from this copy of the game, so short codes are unavailable. Share strings and links still work.';
    else if (code) communityIntro.textContent = account.user ? 'This is published. Anyone can find it under Community or type in this code.' : 'This is published. Sign in to update or remove it.';
    else if (account.user) communityIntro.textContent = 'Publish it to get a short code anyone can type in, and let other players find it under Community. You can update or remove it later.';
    else communityIntro.textContent = 'Sign in to publish it. You\'ll get a short code anyone can type in, other players can find it under Community, and you can update or remove it later. Your share string and link above work without an account.';
    replaceChildren(codeArea,
      code ? h('div', { class: 'big-code' }, code) : null,
      code ? h('button', { onclick: () => copy(code, 'Code') }, 'Copy code') : null,
      state === PublishState.CHANGED ? h('p', { class: 'warning' }, 'You\'ve changed this since publishing. Players still get the older version.') : null);

    const publish = async (options) => {
      try {
        const { updated } = await sharing.publish(id, options);
        app.toaster.show(updated ? `${definition.name} updated for everyone.` : `${definition.name} published.`, { icon: '🌐', tone: 'good' });
        renderCommunity();
      } catch (error) {
        app.toaster.error(error.message);
        if (error instanceof CannotUpdateError) renderCommunity({ offerNewEntry: true });
      }
    };

    if (!account.user) {
      replaceChildren(communityActions, h('button', {
        class: 'primary',
        disabled: !api.available,
        onclick: () => {
          closeDialog();
          app.navigate('settings');
        },
      }, 'Sign in'));
      return;
    }

    replaceChildren(communityActions,
      state === PublishState.NOT_PUBLISHED ? actionButton('Publish to community', 'Publishing…', () => publish(), 'primary') : null,
      state === PublishState.CHANGED ? actionButton('Update published version', 'Updating…', () => publish(), 'primary') : null,
      offerNewEntry ? actionButton('Publish as a new entry', 'Publishing…', () => publish({ asNew: true })) : null,
      code ? actionButton('Remove from community', 'Removing…', async () => {
        const sure = await Modal.confirm(`Remove ${definition.name} from the community?`, 'It stays in your Workshop, and players who already imported it keep their copy. Its code stops working.', { confirmLabel: 'Remove', danger: true });
        if (!sure) return;
        try {
          await sharing.unpublish(code);
          app.toaster.show(`${definition.name} removed from the community.`, { icon: '🗑️' });
          renderCommunity();
        } catch (error) {
          app.toaster.error(error.message);
        }
      }, 'danger') : null);
  };
  renderCommunity();

  await new Modal({
    title: `Share ${definition.name}`,
    wide: true,
    body: (close) => {
      closeDialog = close;
      return h('div', { class: 'share-dialog' },
        h('p', {}, 'Your friends can paste this into ', h('b', {}, 'Community → Import'), ' to add it to their game. It works offline — no account needed.'),
        bundled > 0 ? h('p', { class: 'muted' }, `Includes ${plural(bundled, 'custom enemy', 'custom enemies')} this ${definition.kind} needs.`) : null,
        h('textarea', { class: 'share-string', readonly: true, rows: 4, value: shareString, onfocus: (event) => event.target.select() }),
        h('div', { class: 'row-left' },
          h('button', { onclick: () => copy(shareString, 'Share string') }, 'Copy share string'),
          h('button', { onclick: () => copy(link, 'Link') }, 'Copy link')),
        h('h3', {}, 'Community database'),
        communityIntro,
        communityActions,
        codeArea);
    },
    actions: [{ label: 'Done', value: true, primary: false }],
  }).open();
}
