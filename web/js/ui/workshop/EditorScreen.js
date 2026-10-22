import { ContentSource, newContentId } from '../../content/ContentLibrary.js';
import { validateDefinition } from '../../content/schema.js';
import { h, replaceChildren } from '../dom.js';
import { Screen, screenHeader } from '../Screen.js';
import { openShareDialog } from '../components/ShareDialogs.js';

/**
 * Shared skeleton for the hero, enemy and dungeon editors (Template Method).
 *
 * The base class loads the draft (new, edit or remix), lays out the form
 * and the live preview, validates and saves. Subclasses supply:
 *   kind, label            — what is being edited
 *   blankDraft()           — starting point for "new"
 *   renderForm()           — the form controls (bound to this.draft)
 *   renderPreview(value)   — preview of the normalized definition
 */
export class EditorScreen extends Screen {
  static nav = 'workshop';
  static kind = 'abstract';
  static label = 'item';

  enter() {
    const { library, profile } = this.services;
    const kind = this.constructor.kind;
    const { id, remixOf } = this.params;

    if (id && library.get(id) && library.meta(id).source === ContentSource.CREATED) {
      this.mode = 'edit';
      this.draft = structuredClone(library.get(id));
    } else if (remixOf && library.get(remixOf)) {
      this.mode = 'remix';
      const original = library.get(remixOf);
      this.draft = { ...structuredClone(original), id: newContentId(kind), name: `${original.name} Remix`.slice(0, 32) };
      delete this.draft.unlock;
    } else {
      this.mode = 'new';
      this.draft = { ...this.blankDraft(), id: newContentId(kind), kind };
    }
    this.draft.author = profile.data.playerName || this.draft.author || '';
    this.showErrors = false;
    this.previewRoot = h('div', { class: 'editor-preview-body' });
  }

  blankDraft() {
    throw new Error('blankDraft() not implemented');
  }

  renderForm() {
    throw new Error('renderForm() not implemented');
  }

  renderPreview(_value) {
    return null;
  }

  /** Call after any change to the draft. */
  update = () => {
    this.#renderPreview();
  };

  render() {
    const { label } = this.constructor;
    const titles = { new: `New ${label}`, edit: `Edit ${this.draft.name || label}`, remix: `Remix ${label}` };
    this.#renderPreview();
    return [
      screenHeader(titles[this.mode], this.mode === 'remix' ? 'You\'re working on a copy — the original stays as it is.' : null,
        h('button', { onclick: () => this.app.navigate('workshop', { kind: this.constructor.kind }) }, '← Back to Workshop')),
      h('div', { class: 'editor-layout' },
        h('form', { class: 'editor-form', onsubmit: (event) => event.preventDefault(), novalidate: true }, this.renderForm()),
        h('aside', { class: 'editor-preview' }, this.previewRoot)),
    ];
  }

  /** Re-render the whole form (after structural changes like adding an ability). */
  rebuild() {
    const scroll = window.scrollY;
    this.refresh();
    window.scrollTo({ top: scroll });
  }

  #renderPreview() {
    const { valid, errors, value } = validateDefinition(this.draft);
    let preview;
    try {
      preview = value ? this.renderPreview(value) : null;
    } catch {
      preview = h('p', { class: 'muted' }, 'Preview unavailable until the errors below are fixed.');
    }
    replaceChildren(this.previewRoot,
      h('h2', {}, 'Preview'),
      preview,
      !valid && this.showErrors ? h('div', { class: 'errors-box', role: 'alert' }, h('b', {}, 'Fix these before saving:'), h('ul', {}, errors.slice(0, 8).map((error) => h('li', {}, error)))) : null,
      !valid && !this.showErrors ? h('p', { class: 'muted' }, `${errors.length} thing${errors.length === 1 ? '' : 's'} left to fill in.`) : null,
      h('div', { class: 'editor-actions' },
        h('button', { class: 'primary', type: 'button', onclick: () => this.#save(false) }, '💾 Save'),
        h('button', { type: 'button', onclick: () => this.#save(true) }, '🎁 Save & share')));
  }

  async #save(andShare) {
    const { library, progression } = this.services;
    const isNew = !library.has(this.draft.id);
    const result = library.save(this.draft, { source: ContentSource.CREATED });
    if (!result.ok) {
      this.showErrors = true;
      this.#renderPreview();
      this.app.toaster.error('Some fields need attention — see the list under the preview.');
      return;
    }
    progression.recordCreation(result.definition, { isNew });
    this.app.toaster.show(`${result.definition.name} saved to your Workshop.`, { icon: '💾', tone: 'good' });
    this.app.navigate('workshop', { kind: this.constructor.kind });
    if (andShare) await openShareDialog(this.app, result.definition.id);
  }
}
