import { ImportStatus } from '../../sharing/ShareService.js';
import { copyToClipboard, h, plural } from '../dom.js';
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
  const { sharing, library, api } = app.services;
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
  const codeArea = h('div', { class: 'share-code' }, library.meta(id)?.publishedCode ? h('div', { class: 'big-code' }, library.meta(id).publishedCode) : null);

  const copy = async (text, what) => {
    if (await copyToClipboard(text)) app.toaster.show(`${what} copied — send it to a friend!`, { icon: '📋', tone: 'good' });
    else app.toaster.error('Could not copy. Select the text and copy it manually.');
  };

  const publishButton = h('button', {
    class: 'primary',
    disabled: !api.available,
    onclick: async () => {
      publishButton.disabled = true;
      publishButton.textContent = 'Publishing…';
      try {
        const { code } = await sharing.publish(id);
        codeArea.replaceChildren(h('div', { class: 'big-code' }, code), h('button', { onclick: () => copy(code, 'Code') }, 'Copy code'));
        publishButton.textContent = 'Published';
      } catch (error) {
        app.toaster.error(error.message);
        publishButton.disabled = false;
        publishButton.textContent = 'Publish to community';
      }
    },
  }, 'Publish to community');

  await new Modal({
    title: `Share ${definition.name}`,
    wide: true,
    body: h('div', { class: 'share-dialog' },
      h('p', {}, 'Your friends can paste this into ', h('b', {}, 'Community → Import'), ' to add it to their game. It works offline — no account needed.'),
      bundled > 0 ? h('p', { class: 'muted' }, `Includes ${plural(bundled, 'custom enemy', 'custom enemies')} this ${definition.kind} needs.`) : null,
      h('textarea', { class: 'share-string', readonly: true, rows: 4, value: shareString, onfocus: (event) => event.target.select() }),
      h('div', { class: 'row-left' },
        h('button', { onclick: () => copy(shareString, 'Share string') }, 'Copy share string'),
        h('button', { onclick: () => copy(link, 'Link') }, 'Copy link')),
      h('h3', {}, 'Community database'),
      api.available
        ? h('p', {}, 'Publish it to get a short code anyone can type in, and let other players find it under Community.')
        : h('p', { class: 'muted' }, 'The community server isn\'t reachable from this copy of the game, so short codes are unavailable. Share strings and links still work.'),
      h('div', { class: 'row-left' }, publishButton),
      codeArea),
    actions: [{ label: 'Done', value: true, primary: false }],
  }).open();
}
