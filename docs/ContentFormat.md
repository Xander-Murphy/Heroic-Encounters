# Content & Share Format

Player-made content is plain JSON. The authoritative rules (fields, ranges, defaults) are in `web/js/content/schema.js` (`LIMITS`); this page is an overview.

## Share strings

```
HE1.<base64url( deflate-raw( JSON bundle ) )>
```

`HE1u.` is an uncompressed fallback for browsers without `CompressionStream`. Share links are `https://…/#import=HE1.…`; community codes are 8 characters like `K7F2-QX9P` (no 0/O/1/I).

### Bundle

```json
{
  "format": "heroic-encounters/bundle",
  "version": 1,
  "title": "Wyrm Lair",
  "author": "Alice",
  "createdAt": "2026-10-21T18:00:00.000Z",
  "items": [ /* hero, enemy and dungeon definitions */ ]
}
```

Exporting a dungeon automatically includes the custom enemies it uses. Built-in content (`core:` ids) is referenced by id only. At most 40 items per bundle.

## Definitions

**Hero** — `id`, `kind: "hero"`, `name`, `className`, `specialization`, `role` (damage/tank/healer/support), `portrait` (emoji), `theme`, `lore`, `health` 1–500, `attack` 0–60, `defense` 0–20, `speed` 1–20, `resistances` (school → −50…75 %), `basicAttackSchool`, `abilities` (1–4).

**Enemy** — same character fields plus `rank` (minion/elite/boss; bosses up to 999 health), `enemyType` (physical/caster), `behavior` (random/aggressive/support/cunning), and for bosses `phases` (up to 3): `{ atHealthPercent, message, status }`.

**Ability** — `name`, `description`, `power` 0–80, `cooldown` 0–8, `target` (self, single_ally, all_allies, single_enemy, all_enemies), `school`, `priority` 0–10, `animation` (optional), `effects` (1–3):

| type | extra fields |
| --- | --- |
| `damage` | — (uses ability power × (1 + attack/100)) |
| `heal` | — |
| `lifesteal` | `percent` 10–100 |
| `status` | `status`: `{ name, icon, type, category, magnitude, duration, schools, stat, tickSchool }` |
| `dispel` | `categories`, `harmful` |

Status `type`: buff, debuff, damage_over_time, heal_over_time, immunity, stun, taunt. `category`: physical, magical, curse, disease, poison.

**Dungeon** — `id`, `kind: "dungeon"`, `name`, `description`, `icon`, `theme`, `difficulty` 1–5, `scaling` 0–0.3 (enemy attack growth per wave), `restBetweenWaves` 0–0.5, `waves` (1–6) of `{ enemies: [ids], min, max }` (1–4 enemies), `boss` (enemy id).

## Adding a new kind of effect (developers)

1. Subclass `AbilityEffect` in `engine/effects/` with a static `type`, `apply()`, `summary()` and `budgetValue()`.
2. Register it in `EffectRegistry.js`.
3. Add its fields to `EffectValidator` in `content/schema.js` and an option in `ui/workshop/presets.js`.

Nothing in `Ability`, `Combat` or the UI combat screen needs to change.
