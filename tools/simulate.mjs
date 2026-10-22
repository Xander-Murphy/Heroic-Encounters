/**
 * Balance simulator: plays many dungeon runs with a simple "sensible player"
 * AI and prints win rates. Run with:  node tools/simulate.mjs [runs] [heroIds...]
 */
import { ContentLibrary } from '../web/js/content/ContentLibrary.js';
import { DungeonRun, RunState } from '../web/js/engine/DungeonRun.js';
import { Random } from '../web/js/engine/Random.js';
import { resolverFor } from '../web/js/engine/targeting.js';

const library = new ContentLibrary();
const runs = Number(process.argv[2] ?? 300);
const teamIds = process.argv.slice(3);

const pct = (character) => character.health / character.maxHealth;

/** Heals when someone is hurt, buffs when ready, otherwise the strongest attack on the weakest enemy. */
function planHero(combat, hero) {
  const usable = hero.usableAbilities();
  const allies = combat.livingHeroes();
  const hurt = allies.filter((ally) => pct(ally) < 0.55).sort((a, b) => pct(a) - pct(b));
  const heals = usable.filter((ability) => ability.isSupportive && ability.power > 0);
  let ability;
  if (hurt.length && heals.length) ability = heals[0];
  else {
    const offensive = usable.filter((a) => !a.isSupportive || a.target === 'self');
    ability = offensive.sort((a, b) => b.cooldown - a.cooldown || b.power - a.power)[0] ?? hero.basicAttack;
  }
  const resolver = resolverFor(ability.target);
  const candidates = resolver.candidates(hero, combat.battlefield);
  let index = 0;
  if (resolver.requiresChoice) {
    const score = ability.isSupportive ? pct : (character) => character.health;
    candidates.forEach((candidate, i) => { if (score(candidate) < score(candidates[index])) index = i; });
  }
  combat.queueAction(hero, ability, resolver.resolve(hero, combat.battlefield, index));
}

function simulate(dungeonId, team, seed) {
  const run = new DungeonRun({
    dungeon: library.get(dungeonId), party: team.map((id) => library.instantiate(id)),
    enemyFactory: library.enemyFactory, rng: new Random(seed),
  });
  while (!run.isOver) {
    const combat = run.startEncounter();
    let guard = 0;
    while (!combat.isOver() && guard++ < 60) {
      combat.planEnemyActions();
      combat.heroesAwaitingOrders().forEach((hero) => planHero(combat, hero));
      run.record(combat.resolveRound());
    }
    if (!combat.isOver()) return { won: false, wave: run.waveIndex, stalled: true };
    run.finishEncounter();
  }
  return { won: run.state === RunState.WON, wave: run.waveIndex, rounds: run.stats.rounds };
}

const heroIds = library.heroes({ source: 'core' }).map((hero) => hero.id);
const teams = teamIds.length ? [teamIds] : null;
const rng = new Random(42);

for (const dungeon of library.dungeons({ source: 'core' })) {
  let wins = 0; let rounds = 0; let stalls = 0;
  const reached = [0, 0, 0, 0];
  for (let i = 0; i < runs; i++) {
    const team = teams ? teams[0] : rng.shuffle(heroIds).slice(0, 3);
    const result = simulate(dungeon.id, team, 1000 + i);
    if (result.won) { wins++; rounds += result.rounds; }
    if (result.stalled) stalls++;
    reached[Math.min(3, result.wave)]++;
  }
  console.log(`${dungeon.name.padEnd(20)} win ${(100 * wins / runs).toFixed(1)}%  avg rounds ${(rounds / Math.max(1, wins)).toFixed(1)}  died at wave [1,2,3,boss]=${reached.join('/')}  stalls ${stalls}`);
}
