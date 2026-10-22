import { HERO_ROLES, LIMITS } from '../../content/schema.js';
import { selectField, textField } from './fields.js';
import { CharacterEditorScreen } from './CharacterEditorScreen.js';
import { ABILITY_PRESETS } from './presets.js';

const preset = (id) => ABILITY_PRESETS.find((entry) => entry.id === id).build();

export class HeroEditorScreen extends CharacterEditorScreen {
  static kind = 'hero';
  static label = 'hero';
  static title = 'Hero editor';

  blankDraft() {
    return {
      name: '', className: 'Adventurer', specialization: '', role: 'damage', portrait: '🦸', theme: 'arcane', lore: '',
      health: 90, attack: 20, defense: 1, speed: 6, resistances: {}, basicAttackSchool: 'physical',
      abilities: [preset('strike'), preset('aoe')],
    };
  }

  renderIdentityExtras() {
    const { draft, update } = this;
    return [
      textField({ label: 'Class', draft, key: 'className', max: LIMITS.shortText, onChange: update, help: 'e.g. Bard, Paladin, Alchemist' }),
      textField({ label: 'Specialization (optional)', draft, key: 'specialization', max: LIMITS.shortText, onChange: update }),
      selectField({ label: 'Role', draft, key: 'role', onChange: update, options: HERO_ROLES.map((role) => ({ value: role, label: role[0].toUpperCase() + role.slice(1) })) }),
    ];
  }
}
