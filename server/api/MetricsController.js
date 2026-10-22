import { TRACKED_EVENTS } from '../../web/js/analytics/Analytics.js';
import { addDays, dateKey, daysBetween } from '../../web/js/progression/dates.js';
import { HttpError, readJson, sendJson } from '../http.js';

const INSTALL_ID_PATTERN = /^[a-z0-9-]{6,64}$/i;
const DEFAULT_HEROES = 4;

/**
 * Turns raw activity into the key metrics from Business.md:
 * daily active players, return rate after 1 and 7 days, run completion and
 * heroes unlocked per player. Pure function of the snapshot, so it is
 * identical for every storage backend and easy to test.
 */
export function summarizeMetrics({ installDays, eventCounts, reachedBoss, heroUnlocks }, today = dateKey()) {
  const installs = [...installDays.entries()];
  const activeOn = (day) => installs.filter(([, days]) => days.includes(day)).length;

  const cohort = (minAgeDays) => installs.filter(([, days]) => daysBetween(days[0], today) >= minAgeDays);
  const d1Cohort = cohort(1);
  const d7Cohort = cohort(7);
  const returnedNextDay = d1Cohort.filter(([, days]) => days.includes(addDays(days[0], 1))).length;
  const returnedAfterWeek = d7Cohort.filter(([, days]) => days.some((day) => daysBetween(days[0], day) >= 7)).length;

  const runsStarted = eventCounts['run.started'] ?? 0;
  const unlockTotal = [...heroUnlocks.values()].reduce((sum, count) => sum + count, 0);
  const ratio = (part, whole) => (whole ? part / whole : null);

  return {
    generatedFor: today,
    players: installs.length,
    dailyActive: activeOn(today),
    dailyActiveLast7: Array.from({ length: 7 }, (_, index) => {
      const day = addDays(today, index - 6);
      return { day, players: activeOn(day) };
    }),
    returnRate1Day: ratio(returnedNextDay, d1Cohort.length),
    returnRate7Day: ratio(returnedAfterWeek, d7Cohort.length),
    runsStarted,
    runsFinished: eventCounts['run.finished'] ?? 0,
    runCompletion: ratio(reachedBoss, runsStarted),
    heroesUnlockedPerPlayer: installs.length ? DEFAULT_HEROES + unlockTotal / installs.length : null,
    contentCreated: eventCounts['content.created'] ?? 0,
    contentShared: eventCounts['content.shared'] ?? 0,
    contentImported: eventCounts['content.imported'] ?? 0,
  };
}

/** Receives anonymous gameplay events and serves the metrics summary. */
export class MetricsController {
  constructor({ store, rateLimiter, now = () => new Date() }) {
    this.store = store;
    this.rateLimiter = rateLimiter;
    this.now = now;
  }

  register(router) {
    router.post('/api/metrics', (context) => this.ingest(context));
    router.get('/api/metrics/summary', (context) => this.summary(context));
    return router;
  }

  async ingest({ request, response, ip }) {
    if (this.rateLimiter && !this.rateLimiter.take(ip)) throw new HttpError(429, 'Too many requests.');
    const { installId, events } = await readJson(request, 50_000);
    if (!INSTALL_ID_PATTERN.test(installId ?? '')) throw new HttpError(400, 'installId is required.');
    if (!Array.isArray(events)) throw new HttpError(400, 'events must be a list.');

    const accepted = events.slice(0, 200)
      .filter((event) => TRACKED_EVENTS.includes(event?.name))
      .map((event) => ({ name: event.name, props: { reachedBoss: event.props?.reachedBoss === true } }));
    // The server's own date is used so a wrong client clock can't skew retention.
    await this.store.recordEvents(installId, dateKey(this.now()), accepted);
    sendJson(response, 200, { ok: true, accepted: accepted.length });
  }

  async summary({ response }) {
    sendJson(response, 200, summarizeMetrics(await this.store.metricsSnapshot(), dateKey(this.now())));
  }
}
