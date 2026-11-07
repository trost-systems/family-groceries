// Fetches /data/snapshot.json every 60 s while the tab is visible, renders it, keeps the freshness
// label ticking, and runs the theme toggle and the job drawer.
import type { Job, Snapshot } from '../src/snapshot.ts';
import { snapshotPath } from '../src/snapshot.ts';
import { h } from './dom.ts';
import { freshness } from './format.ts';
import { type Plot, renderJob, renderPage } from './render.ts';

const pollMs = 60_000;

function need<T extends Element>(selector: string, type: new () => T): T {
  const el = document.querySelector(selector);
  if (!(el instanceof type)) throw new Error(`nexus: ${selector} missing from index.html`);
  return el;
}

const app = need('#app', HTMLElement);
const fresh = need('#freshness', HTMLElement);
const themeButton = need('#theme', HTMLButtonElement);
const drawer = need('#drawer', HTMLDialogElement);
const drawerTitle = need('#drawer-title', HTMLElement);
const drawerBody = need('#drawer-body', HTMLElement);

let snapshot: Snapshot | null = null;
let fetchFailed = false;
let plots: Plot[] = [];
let opener: HTMLElement | null = null;

function isSnapshot(v: unknown): v is Snapshot {
  return typeof v === 'object' && v !== null && (v as { schema?: unknown }).schema === 1 &&
    Array.isArray((v as { jobs?: unknown }).jobs);
}

function drawPlots(): void {
  for (const plot of plots) {
    const width = Math.floor(plot.slot.clientWidth);
    if (width <= 0) continue;
    plot.slot.replaceChildren(plot.draw(width));
  }
}

function showFreshness(): void {
  if (snapshot === null) {
    fresh.textContent = fetchFailed ? 'no data' : 'loading';
    fresh.dataset['level'] = fetchFailed ? 'outdated' : 'fresh';
    return;
  }
  const f = freshness(snapshot.generatedAt, new Date());
  const word = f.level === 'fresh' ? '' : `${f.level}: `;
  fresh.textContent = `${word}${f.label}${fetchFailed ? ' (refresh failed)' : ''}`;
  fresh.dataset['level'] = fetchFailed && f.level === 'fresh' ? 'stale' : f.level;
  document.documentElement.dataset['freshness'] = f.level;
}

function render(): void {
  if (snapshot === null) return;
  const page = renderPage(snapshot, new Date());
  plots = page.plots;
  app.replaceChildren(page.main);
  drawPlots();
  showFreshness();
  if (drawer.open) {
    const id = drawer.dataset['job'];
    const job = snapshot.jobs.find((j) => j.id === id);
    if (job === undefined) drawer.close();
    else fillDrawer(job);
  }
}

async function load(): Promise<void> {
  try {
    const res = await fetch(snapshotPath, { cache: 'no-store' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data: unknown = await res.json();
    if (!isSnapshot(data)) throw new Error('not a schema 1 snapshot');
    fetchFailed = false;
    if (snapshot?.generatedAt === data.generatedAt) return showFreshness();
    snapshot = data;
    render();
  } catch (e) {
    fetchFailed = true;
    console.error('nexus: snapshot fetch failed', e);
    if (snapshot === null) {
      app.replaceChildren(
        h('p', { class: 'empty load-error' }, 'No data: the snapshot could not be loaded.'),
      );
    }
    showFreshness();
  }
}

function fillDrawer(job: Job): void {
  drawer.dataset['job'] = job.id;
  drawerTitle.textContent = job.title;
  drawerBody.replaceChildren(renderJob(job, new Date()));
}

app.addEventListener('click', (event) => {
  const target = event.target instanceof Element ? event.target.closest('button.job-open') : null;
  if (!(target instanceof HTMLButtonElement) || snapshot === null) return;
  const job = snapshot.jobs.find((j) => j.id === target.dataset['job']);
  if (job === undefined) return;
  opener = target;
  fillDrawer(job);
  drawer.showModal();
});

drawer.addEventListener('close', () => {
  const id = opener?.dataset['job'];
  const again = id === undefined
    ? null
    : app.querySelector<HTMLButtonElement>(`button.job-open[data-job="${CSS.escape(id)}"]`);
  (again ?? opener)?.focus();
  opener = null;
});
drawer.addEventListener('click', (event) => {
  if (event.target === drawer) drawer.close();
});
need('#drawer-close', HTMLButtonElement).addEventListener('click', () => drawer.close());

type Theme = 'auto' | 'light' | 'dark';
const themes: readonly Theme[] = ['auto', 'light', 'dark'];

function applyTheme(theme: Theme): void {
  if (theme === 'auto') delete document.documentElement.dataset['theme'];
  else document.documentElement.dataset['theme'] = theme;
  themeButton.textContent = `Theme: ${theme}`;
  themeButton.setAttribute('aria-label', `Colour theme: ${theme}. Change`);
}

function storedTheme(): Theme {
  const v = localStorage.getItem('nexus-theme');
  return themes.find((t) => t === v) ?? 'auto';
}

themeButton.addEventListener('click', () => {
  const next = themes[(themes.indexOf(storedTheme()) + 1) % themes.length] ?? 'auto';
  localStorage.setItem('nexus-theme', next);
  applyTheme(next);
});
applyTheme(storedTheme());

let resizeTimer: ReturnType<typeof setTimeout> | undefined;
globalThis.addEventListener('resize', () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(drawPlots, 120);
});

let pollTimer: ReturnType<typeof setTimeout> | undefined;
function schedule(): void {
  clearTimeout(pollTimer);
  if (document.visibilityState === 'visible') {
    pollTimer = setTimeout(() => void load().then(schedule), pollMs);
  }
}
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') void load().then(schedule);
  else clearTimeout(pollTimer);
});
setInterval(showFreshness, 15_000);
void load().then(schedule);
