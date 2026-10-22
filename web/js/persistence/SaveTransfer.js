import { ShareCodec } from '../sharing/ShareCodec.js';

const SAVE_FORMAT = 'heroic-encounters/save';

/**
 * Whole-save backup: profile, settings and library in one string, so a
 * player can move their progress and imported content to another browser
 * or keep a copy before clearing site data.
 */
export class SaveTransfer {
  constructor({ adapter, keys = ['profile', 'settings', 'library', 'library-deleted', 'metrics'], codec = new ShareCodec() }) {
    this.adapter = adapter;
    this.keys = keys;
    this.codec = codec;
  }

  async exportSave() {
    const data = Object.fromEntries(this.keys.map((key) => [key, this.adapter.read(key)]));
    return this.codec.encode({ format: SAVE_FORMAT, version: 1, savedAt: new Date().toISOString(), data });
  }

  /** Replace local data with a backup. The caller should reload the page afterwards. */
  async importSave(text) {
    const payload = await this.codec.decode(text);
    if (payload?.format !== SAVE_FORMAT || typeof payload.data !== 'object' || payload.data === null) {
      throw new Error('That is not a Heroic Encounters save backup.');
    }
    for (const key of this.keys) {
      if (payload.data[key] !== undefined && payload.data[key] !== null) this.adapter.write(key, payload.data[key]);
    }
    return payload.savedAt;
  }
}
