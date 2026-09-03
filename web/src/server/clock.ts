/** Reloj inyectable para vencimientos deterministas en tests (doc 09: reloj local fake). */
export interface Clock {
  now(): Date;
}

export const systemClock: Clock = { now: () => new Date() };

export function isoDaysFromNow(clock: Clock, days: number): string {
  return new Date(clock.now().getTime() + days * 24 * 60 * 60 * 1000).toISOString();
}

export function isoMinutesFromNow(clock: Clock, minutes: number): string {
  return new Date(clock.now().getTime() + minutes * 60 * 1000).toISOString();
}
