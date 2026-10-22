# Architecture & Design

Heroic Encounters is a static web app (HTML, CSS, JavaScript ES modules — no build step) plus an optional zero-dependency Node server for the community database.

## Why JavaScript (and not Python)

The original prototype used Python + Pygame. For a browser game:

- Python can't run in a browser natively. Pyodide is a ~10 MB download with slow start-up; a Python server running every fight would need a connection and can't work offline.
- JavaScript runs everywhere the game needs to: the browser (game, offline play, local saves) **and** Node (server, tests). The engine, the content schema and the share codec are the *same files* in both places, so the server validates uploads with exactly the rules the game uses.
- The original object-oriented design (Prototype, Strategy, State, composable effects, target resolvers) ported class-for-class.

## Layers

```text
            ┌──────────────────────── ui/ ────────────────────────┐
            │ App (screen registry) · Screens · Workshop editors  │w
            └───────────────┬─────────────────────────────────────┘
                            │ uses services (injected by services.js)
 ┌──────────────┬───────────┼─────────────┬──────────────┬─────────────┐
 │ progression/ │ sharing/  │ content/    │ persistence/ │ analytics/  │
 │ Profile      │ ShareSvc  │ Library     │ Storage      │ Analytics   │
 │ Achievements │ Codec     │ Factory     │ adapters     │ sinks       │
 │ DailyChall.  │ Bundles   │ Schema      │ SaveTransfer │             │
 └──────┬───────┴─────┬─────┴──────┬──────┴──────────────┴──────┬──────┘
        │             │            │                            │
        └─────────────┴──── engine/ (pure rules, no DOM) ───────┘
                                   ▲
                  server/ ─────────┘ reuses content/schema + sharing/codec
```

`engine/` depends on nothing. `content/` turns JSON into engine objects. Everything above talks to the engine only through those objects. `ui/` is the only layer that touches the DOM.

## Engine (ported from the Python design)

| Class | Role | Pattern |
| --- | --- | --- |
| `Character` → `Hero`, `Enemy` → `Boss` | Health, stats, effects, damage pipeline (immunity → resistance → defense) | Inheritance, Encapsulation |
| `Ability` holds `AbilityEffect[]` | Damage, Heal, Lifesteal, ApplyStatus, Dispel | Composition, Open/Closed via `EffectRegistry` |
| `StatusEffect` | Buff/debuff/DoT/HoT/immunity/stun/taunt; answers questions about itself | SRP |
| `Prototype` | Content is built once and `clone()`d per fight (keeps classes, unlike `structuredClone`) | Prototype |
| `TargetResolver` subclasses | Who an ability may hit (taunt lives here) | Strategy, Open/Closed |
| `EnemyBehavior` subclasses | Enemy AI, stateless and shared | Strategy (`BehaviorRegistry`) |
| `Combat` | Rounds: plan → `beginRound` / `executeNextAction` / `finishRound` (stepwise for animation) | — |
| `DungeonRun` | Waves → boss, rest between waves, stats, log; gets enemies from an injected `enemyFactory` | Dependency Inversion |
| `RunModifier` subclasses | Daily-challenge twists via hooks | Template Method |
| `Random` | Seeded RNG; separate spawn stream so daily waves are identical for everyone | — |

## SOLID in practice

- **Single responsibility** — `Combat` knows rules, `CombatScreen` knows input and drawing, `Animator` knows animation, `GameSession` knows how runs start.
- **Open/closed** — new effect types, enemy behaviors, run modifiers, achievements, unlock rules, validators and screens are added by registering a class/entry; existing code doesn't change.
- **Liskov** — every `AbilityEffect`, `EnemyBehavior`, `StorageAdapter`, `CommunityStore` and `AnalyticsSink` subclass is usable wherever its base is.
- **Interface segregation** — small interfaces: storage is `read/write/remove`; the library store is `load/save`; sinks are `record/flush`.
- **Dependency inversion** — `services.js` is the only place implementations are chosen. Tests swap in `MemoryStorageAdapter`, in-memory server stores and fake APIs.

## Other patterns

- **Observer** — `EventBus`: gameplay emits `run.finished`, `content.shared`…; progression, analytics and toasts subscribe independently.
- **State** — the `App` holds one current `Screen` and swaps it on navigation (successor of the original `GameState` enum).
- **Template Method** — `EditorScreen` (load draft, validate, preview, save) with `HeroEditorScreen` / `EnemyEditorScreen` / `DungeonEditorScreen` filling in the form; `CharacterEditorScreen` shares hero/enemy sections.
- **Factory** — `ContentFactory` builds engine objects from validated JSON.
- **Facade** — `ShareService` hides codec, bundles, library and API behind export/preview/import/publish.

## Content pipeline & security

Every definition — built-in, created, pasted, downloaded or uploaded — goes through `content/schema.js`, which returns a **new object containing only known fields** with ranges enforced. Unknown properties and prototype tricks never reach the engine. All UI text is set with `textContent` (via `ui/dom.js`), never `innerHTML`, so shared names can't inject markup. The server adds a strict Content-Security-Policy, request size limits, rate limiting, and path-traversal protection.

## Server

`server/app.js` builds a request handler from injected dependencies: `Router`, `ContentController` (publish → validate → dedupe by content hash → short code; fetch, list, like, report), `MetricsController` (anonymous events → key metrics), and `StaticFiles`. Storage is the `CommunityStore` interface with `SqliteCommunityStore` (Node's built-in `node:sqlite`) and `MemoryCommunityStore` (optionally snapshotted to JSON). A hosted database would be one more subclass.
