import { daysBetween } from '../progression/dates.js';

/**
 * Gameplay analytics for the key metrics in Business.md: daily active
 * players, return rate after 1 and 7 days, run completion (share of runs
 * that reach the boss) and heroes unlocked per player.
 *
 * Analytics listens to the event bus and forwards a fixed allow-list of
 * events to its sinks (Strategy). Sinks never see personal data — only an
 * anonymous random install id and event names with small numeric details.
 */
export const TRACKED_EVENTS = Object.freeze([
  'session.start', 'run.started', 'run.finished', 'hero.unlocked', 'level.up',
  'achievement.unlocked', 'content.created', 'content.shared', 'content.imported',
]);

/** Base class for places analytics events can go. */
export class AnalyticsSink {
  record(_event) {}

  async flush() {}
}

/** Batches events and posts them to the community server, if one is reachable and the player allows it. */
export class RemoteAnalyticsSink extends AnalyticsSink {
  constructor({ api, installId, isEnabled, batchSize = 20 }) {
    super();
    this.api = api;
    this.installId = installId;
    this.isEnabled = isEnabled;
    this.batchSize = batchSize;
    this.queue = [];
  }

  record(event) {
    if (!this.isEnabled()) return;
    this.queue.push(event);
    if (this.queue.length >= this.batchSize) this.flush();
  }

  async flush() {
    if (!this.queue.length || !this.api.available || !this.isEnabled()) return;
    const batch = this.queue.splice(0, this.queue.length);
    try {
      await this.api.sendMetrics(this.installId, batch);
    } catch {
      this.queue.unshift(...batch.slice(-100)); // try again later, but never grow without bound
    }
  }
}

/** Keeps the last few hundred events in memory for the in-game stats page and debugging. */
export class MemoryAnalyticsSink extends AnalyticsSink {
  constructor(limit = 300) {
    super();
    this.limit = limit;
    this.events = [];
  }

  record(event) {
    this.events.push(event);
    if (this.events.length > this.limit) this.events.shift();
  }
}

const SAFE_PROPS = ['dungeonId', 'won', 'reachedBoss', 'rounds', 'heroesLost', 'daily', 'kind', 'method', 'count', 'level', 'id'];

export class Analytics {
  constructor({ events, sinks = [] }) {
    this.sinks = sinks;
    events.on('*', (payload, name) => this.track(name, payload));
  }

  track(name, payload = {}) {
    if (!TRACKED_EVENTS.includes(name)) return;
    const props = {};
    for (const key of SAFE_PROPS) {
      if (key in payload && ['string', 'number', 'boolean'].includes(typeof payload[key])) props[key] = payload[key];
    }
    const event = { name, at: new Date().toISOString(), props };
    this.sinks.forEach((sink) => sink.record(event));
  }

  flush() {
    return Promise.all(this.sinks.map((sink) => sink.flush()));
  }
}

/** This player's own engagement numbers, derived from their profile. */
export function localMetrics(profile, unlockedHeroCount, totalHeroCount) {
  const days = [...profile.data.playDays].sort();
  const first = days[0];
  const returned = (minimumGap) => Boolean(first) && days.some((day) => daysBetween(first, day) >= minimumGap);
  const started = profile.stat('runsStarted');
  return {
    daysPlayed: days.length,
    returnedAfter1Day: returned(1),
    returnedAfter7Days: returned(7),
    runsStarted: started,
    runCompletion: started ? profile.stat('reachedBoss') / started : 0,
    winRate: profile.stat('runsFinished') ? profile.stat('runsWon') / profile.stat('runsFinished') : 0,
    heroesUnlocked: unlockedHeroCount,
    totalHeroes: totalHeroCount,
  };
}
