// Ops-dir facts other than jobs: lane ceilings, Claude usage, host load, NEEDS_LEAD.md sections.
import type { Host, NeedsLeadItem, Snapshot } from '../src/snapshot.ts';

/** `NAME=value  # comment` lines of a shell config; only the numeric value of `name`. */
export function configNumber(text: string, name: string): number | null {
  const m = new RegExp(`^${name}=(\\d+)`, 'm').exec(text);
  return m === null ? null : Number(m[1]);
}

const week = 7 * 24 * 3600;

/** usage-feed.json, as bin/usage-gate reads it; pace = 0.95 x the elapsed part of the week. */
export function parseUsage(json: unknown, now: Date): Snapshot['usage'] {
  if (typeof json !== 'object' || json === null) return null;
  const util = (json as Record<string, unknown>)['weekly_util'];
  const reset = (json as Record<string, unknown>)['weekly_reset_epoch'];
  if (typeof util !== 'number' || typeof reset !== 'number') return null;
  const left = Math.min(Math.max(reset - now.getTime() / 1000, 0), week);
  return {
    weeklyUtil: util,
    pace: Math.round(0.95 * (1 - left / week) * 1000) / 1000,
    resetAt: new Date(reset * 1000).toISOString(),
  };
}

/** GitHub's heading anchor. */
export function anchor(heading: string): string {
  return heading.toLowerCase().trim().replace(/[^\p{L}\p{N}\s-]/gu, '').replace(/\s/g, '-');
}

/**
 * The `## ` sections of NEEDS_LEAD.md whose first `Status` line does not say done. A section
 * without a Status line is a record, not a request, and stays out.
 */
export function openNeedsLead(markdown: string): NeedsLeadItem[] {
  const items: NeedsLeadItem[] = [];
  const sections = markdown.split(/^## /m).slice(1);
  for (const section of sections) {
    const title = section.split('\n')[0]?.trim() ?? '';
    const status = /^Status\b[^:\n]*:(.*)$/m.exec(section)?.[1];
    if (status === undefined || /\b(all )?done\b/i.test(status)) continue;
    // The heading's remarks in parentheses ("(after <name>'s OK)") stay out: only the topic is shown.
    const topic = title.replace(/\s*\(.*$/, '');
    items.push({ title: topic, source: 'NEEDS_LEAD.md', ref: anchor(topic) });
  }
  return items;
}

/** /proc/loadavg, /proc/meminfo and a core count; disk from df. */
export function parseHost(loadavg: string, meminfo: string, cores: number, diskFreeKb: number): Host {
  const [l1 = NaN, l5 = NaN, l15 = NaN] = loadavg.trim().split(/\s+/).map(Number);
  const kb = (key: string): number =>
    Number(new RegExp(`^${key}:\\s+(\\d+) kB`, 'm').exec(meminfo)?.[1] ?? NaN);
  const gb = (k: number): number => Math.round((k / 1024 / 1024) * 10) / 10;
  return {
    name: 'hz',
    cores,
    load: [l1, l5, l15],
    memAvailGb: gb(kb('MemAvailable')),
    memTotalGb: gb(kb('MemTotal')),
    diskFreeGb: Math.round(diskFreeKb / 1024 / 1024),
  };
}

export async function readHost(): Promise<Host> {
  const cpuinfo = await Deno.readTextFile('/proc/cpuinfo');
  const cores = cpuinfo.split('\n').filter((l) => l.startsWith('processor')).length;
  const { stdout } = await new Deno.Command('df', {
    args: ['-Pk', Deno.env.get('HOME') ?? '/'],
    stdout: 'piped',
  }).output();
  const freeKb = Number(new TextDecoder().decode(stdout).trim().split('\n').at(-1)?.split(/\s+/)[3] ?? NaN);
  return parseHost(
    await Deno.readTextFile('/proc/loadavg'),
    await Deno.readTextFile('/proc/meminfo'),
    cores,
    freeKb,
  );
}
