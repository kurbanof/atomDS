/* ============================================================
   АТОМ — трекер привычек, собранный по идеям книги
   «Атомные привычки» Джеймса Клира.
   Чистый JS, без зависимостей. Данные — в localStorage.
   ============================================================ */

"use strict";

const STORAGE_KEY = "atom-habits-v1";
const APP_VERSION = 1;

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

const MONTHS_SHORT = ["янв", "фев", "мар", "апр", "мая", "июн", "июл", "авг", "сен", "окт", "ноя", "дек"];
const WEEKDAYS_SHORT = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];
const WEEKDAYS_FULL = ["понедельник", "вторник", "среда", "четверг", "пятница", "суббота", "воскресенье"];

let state = null;
let draft = null;
let currentRoute = "today";
let modalState = null;
let lastFocused = null;
let toastTimer = null;

/* ------------------------------------------------------------
   Утилиты
   ------------------------------------------------------------ */

function esc(value) {
  return String(value ?? "").replace(/[&<>"']/g, (ch) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  }[ch]));
}

function uid(prefix = "id") {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function pad(n) {
  return String(n).padStart(2, "0");
}

function dateKey(date = new Date()) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function parseKey(key) {
  const [y, m, d] = String(key).split("-").map(Number);
  return new Date(y, m - 1, d);
}

function addDays(date, n) {
  const x = new Date(date);
  x.setDate(x.getDate() + n);
  return x;
}

function utcDay(date) {
  return Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
}

function diffDays(from, to) {
  return Math.round((utcDay(to) - utcDay(from)) / 86400000);
}

function isoDay(date) {
  const d = date.getDay();
  return d === 0 ? 7 : d;
}

function startOfWeek(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - (isoDay(d) - 1));
  return d;
}

function shortDate(date) {
  return `${date.getDate()} ${MONTHS_SHORT[date.getMonth()]}`;
}

function longDate(date) {
  return date.toLocaleDateString("ru-RU", { weekday: "long", day: "numeric", month: "long" });
}

function plural(n, one, few, many) {
  const abs = Math.abs(n) % 100;
  const last = abs % 10;
  if (abs > 10 && abs < 20) return many;
  if (last > 1 && last < 5) return few;
  if (last === 1) return one;
  return many;
}

function clamp(n, min, max) {
  return Math.min(max, Math.max(min, n));
}

function safeColor(value, fallback = "#3F6B57") {
  return /^#[0-9a-fA-F]{6}$/.test(String(value || "")) ? value : fallback;
}

function safeTheme(value) {
  return value === "dark" ? "dark" : "light";
}

function mulberry32(a) {
  return function random() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* ------------------------------------------------------------
   Иконки
   ------------------------------------------------------------ */

const ICONS = {
  today: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  habits: '<path d="M8 6h12M8 12h12M8 18h12"/><circle cx="4" cy="6" r="1.2" fill="currentColor" stroke="none"/><circle cx="4" cy="12" r="1.2" fill="currentColor" stroke="none"/><circle cx="4" cy="18" r="1.2" fill="currentColor" stroke="none"/>',
  identity: '<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 3.6-7 8-7s8 3 8 7"/>',
  progress: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
  book: '<path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v16H6.5A2.5 2.5 0 0 0 4 21.5z"/><path d="M4 5.5V21.5M8 7h8M8 11h6"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2.8 2.8-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6V21h-4v-.1a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1L4.2 17l.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.6-1H3v-4h.1a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9L4.2 7 7 4.2l.1.1a1.7 1.7 0 0 0 1.9.3 1.7 1.7 0 0 0 1-1.6V3h4v.1a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1L19.8 7l-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.6 1h.1v4H21a1.7 1.7 0 0 0-1.6 1z"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  check: '<path d="M4.5 12.5 9 17l10.5-11"/>',
  moon: '<path d="M20 14.5A8.5 8.5 0 0 1 9.5 4 7 7 0 1 0 20 14.5z"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
  chevron: '<path d="M6 9l6 6 6-6"/>',
  flame: '<path d="M12 22c4 0 7-2.7 7-6.5 0-3-1.8-5.2-4-7.5.3 2.2-.8 3.7-2 4.5.2-4.2-2-7.2-4.5-9.5.2 4.7-3.5 6.7-3.5 11.3C5 19 8 22 12 22z"/>',
  edit: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>',
  dots: '<circle cx="5" cy="12" r="1.4" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1.4" fill="currentColor" stroke="none"/><circle cx="19" cy="12" r="1.4" fill="currentColor" stroke="none"/>',
  close: '<path d="M6 6l12 12M18 6 6 18"/>',
  download: '<path d="M12 3v12M7 11l5 5 5-5"/><path d="M4 21h16"/>',
  trash: '<path d="M3 6h18M8 6V4h8v2M6 6l1 15h10l1-15"/><path d="M10 11v6M14 11v6"/>',
  spark: '<path d="M12 2l1.8 6.2L20 10l-6.2 1.8L12 18l-1.8-6.2L4 10l6.2-1.8z"/>',
  quote: '<path d="M9 11H5a4 4 0 0 1 4-4V4a7 7 0 0 0-7 7v6h7zM22 11h-4a4 4 0 0 1 4-4V4a7 7 0 0 0-7 7v6h7z"/>',
  target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.4" fill="currentColor" stroke="none"/>',
  link: '<path d="M10 13a5 5 0 0 0 7 0l2-2a5 5 0 0 0-7-7l-1 1"/><path d="M14 11a5 5 0 0 0-7 0l-2 2a5 5 0 0 0 7 7l1-1"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  home: '<path d="M3 11l9-8 9 8"/><path d="M5 10v10h14V10"/>',
  archive: '<path d="M3 4h18v4H3z"/><path d="M5 8v12h14V8M10 12h4"/>',
  restore: '<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 3.6-7 8-7s8 3 8 7"/>'
};

function icon(name, size = 18) {
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name] || ""}</svg>`;
}

function atomMark(size = 30) {
  return `<svg class="atom-mark" width="${size}" height="${size}" viewBox="0 0 48 48" fill="none" aria-hidden="true">
    <ellipse cx="24" cy="24" rx="20" ry="8" transform="rotate(30 24 24)" stroke="currentColor" stroke-width="1.5"/>
    <ellipse cx="24" cy="24" rx="20" ry="8" transform="rotate(-30 24 24)" stroke="currentColor" stroke-width="1.5"/>
    <ellipse cx="24" cy="24" rx="20" ry="8" transform="rotate(90 24 24)" stroke="currentColor" stroke-width="1.5"/>
    <circle cx="24" cy="24" r="3.4" fill="currentColor"/>
    <circle cx="41" cy="34" r="2" fill="currentColor"/>
    <circle cx="8" cy="15" r="1.6" fill="currentColor"/>
  </svg>`;
}

/* ------------------------------------------------------------
   Хранилище и состояние
   ------------------------------------------------------------ */

function blankState() {
  return {
    version: APP_VERSION,
    onboarded: false,
    isDemo: false,
    createdAt: dateKey(),
    profile: { name: "", focusIdentityId: null },
    identities: [],
    habits: [],
    logs: {},
    audit: {},
    settings: { theme: "light", hideDemoBanner: false }
  };
}

function normalizeState(raw) {
  if (!raw || typeof raw !== "object") return null;
  if (!Array.isArray(raw.identities) || !Array.isArray(raw.habits)) return null;
  const next = {
    version: APP_VERSION,
    onboarded: Boolean(raw.onboarded) || raw.identities.length > 0,
    isDemo: Boolean(raw.isDemo),
    createdAt: raw.createdAt || dateKey(),
    profile: {
      name: typeof raw.profile?.name === "string" ? raw.profile.name : "",
      focusIdentityId: raw.profile?.focusIdentityId || null
    },
    identities: raw.identities
      .filter((item) => item && item.id && item.title)
      .map((item) => ({
        id: String(item.id),
        key: item.key || "custom",
        title: String(item.title),
        short: item.short || String(item.title),
        statement: item.statement || "",
        why: item.why || "",
        emoji: item.emoji || "✳️",
        color: safeColor(item.color)
      })),
    habits: raw.habits
      .filter((item) => item && item.id && item.title)
      .map((item) => ({
        id: String(item.id),
        title: String(item.title),
        emoji: item.emoji || "✳️",
        identityId: String(item.identityId || ""),
        anchor: item.anchor || "",
        time: item.time || "",
        place: item.place || "",
        minVersion: item.minVersion || "сделать один маленький шаг",
        reward: item.reward || "",
        environment: item.environment || "",
        partner: item.partner || "",
        stake: item.stake || "",
        days: (() => {
          const days = Array.isArray(item.days) ? item.days.map(Number).filter((d) => d >= 1 && d <= 7) : [];
          return days.length ? days : [1, 2, 3, 4, 5, 6, 7];
        })(),
        createdAt: item.createdAt || raw.createdAt || dateKey(),
        archived: Boolean(item.archived)
      })),
    logs: raw.logs && typeof raw.logs === "object" ? raw.logs : {},
    audit: raw.audit && typeof raw.audit === "object" ? raw.audit : {},
    settings: {
      theme: safeTheme(raw.settings?.theme),
      hideDemoBanner: Boolean(raw.settings?.hideDemoBanner)
    }
  };
  if (!next.profile.focusIdentityId || !next.identities.some((i) => i.id === next.profile.focusIdentityId)) {
    next.profile.focusIdentityId = next.identities[0]?.id || null;
  }
  return next;
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return normalizeState(JSON.parse(raw));
  } catch (error) {
    console.warn("Не удалось прочитать данные:", error);
    return null;
  }
}

function saveState() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (error) {
    console.warn("Не удалось сохранить данные:", error);
    toast("Не удалось сохранить данные в браузере", "error");
  }
}

/* ------------------------------------------------------------
   Производные данные
   ------------------------------------------------------------ */

function activeHabits() {
  return state.habits.filter((habit) => !habit.archived);
}

function identityById(id) {
  return state.identities.find((item) => item.id === id) || null;
}

function identityColor(identityId) {
  return safeColor(identityById(identityId)?.color);
}

function focusIdentity() {
  return identityById(state.profile.focusIdentityId) || state.identities[0] || null;
}

function scheduledOn(habit, date) {
  return Array.isArray(habit.days) && habit.days.includes(isoDay(date));
}

function habitsForDay(date) {
  const key = dateKey(date);
  return activeHabits().filter((habit) => key >= habit.createdAt && scheduledOn(habit, date));
}

function getEntry(key, habitId) {
  return state.logs[key]?.[habitId] || null;
}

function isDone(key, habitId) {
  return Boolean(getEntry(key, habitId));
}

function hasAnyLog(key) {
  return Boolean(state.logs[key] && Object.keys(state.logs[key]).length);
}

function setEntry(key, habitId, mode) {
  if (!state.logs[key]) state.logs[key] = {};
  if (!mode) {
    delete state.logs[key][habitId];
    if (!Object.keys(state.logs[key]).length) delete state.logs[key];
  } else {
    state.logs[key][habitId] = mode;
  }
}

function habitStreak(habit) {
  let cursor = new Date();
  let streak = 0;
  if (scheduledOn(habit, cursor) && !isDone(dateKey(cursor), habit.id)) {
    cursor = addDays(cursor, -1);
  }
  for (let i = 0; i < 3660; i += 1) {
    const key = dateKey(cursor);
    if (key < habit.createdAt) break;
    if (scheduledOn(habit, cursor)) {
      if (isDone(key, habit.id)) streak += 1;
      else break;
    }
    cursor = addDays(cursor, -1);
  }
  return streak;
}

function habitMissRun(habit) {
  let cursor = addDays(new Date(), -1);
  let missed = 0;
  for (let i = 0; i < 120; i += 1) {
    if (dateKey(cursor) < habit.createdAt) break;
    if (scheduledOn(habit, cursor)) {
      if (isDone(dateKey(cursor), habit.id)) break;
      missed += 1;
    }
    cursor = addDays(cursor, -1);
  }
  return missed;
}

function habitStats(habit, windowDays = 30) {
  let done = 0;
  let min = 0;
  let full = 0;
  let opportunities = 0;
  const today = new Date();
  for (let i = 1; i <= windowDays; i += 1) {
    const date = addDays(today, -i);
    const key = dateKey(date);
    if (key < habit.createdAt) continue;
    if (!scheduledOn(habit, date)) continue;
    opportunities += 1;
    const entry = getEntry(key, habit.id);
    if (entry) {
      done += 1;
      if (entry === "full") full += 1;
      if (entry === "min") min += 1;
    }
  }
  let total = 0;
  Object.values(state.logs).forEach((entries) => {
    if (entries[habit.id]) total += 1;
  });
  const last14 = [];
  for (let i = 13; i >= 0; i -= 1) {
    const date = addDays(today, -i);
    const key = dateKey(date);
    last14.push({
      date,
      key,
      scheduled: scheduledOn(habit, date) && key >= habit.createdAt,
      entry: getEntry(key, habit.id),
      isToday: i === 0
    });
  }
  return {
    done,
    min,
    full,
    opportunities,
    rate: opportunities ? done / opportunities : 0,
    total,
    streak: habitStreak(habit),
    missRun: habitMissRun(habit),
    last14
  };
}

function todayStats() {
  const list = habitsForDay(new Date());
  const doneList = list.filter((habit) => isDone(dateKey(), habit.id));
  const full = doneList.filter((habit) => getEntry(dateKey(), habit.id) === "full").length;
  const min = doneList.length - full;
  let votes = 0;
  const entries = state.logs[dateKey()] || {};
  votes = Object.keys(entries).length;
  return { list, done: doneList.length, total: list.length, full, min, votes };
}

function activeDayCount() {
  return Object.keys(state.logs).filter((key) => hasAnyLog(key)).length;
}

function activeStreak() {
  let cursor = new Date();
  if (!hasAnyLog(dateKey(cursor))) cursor = addDays(cursor, -1);
  let streak = 0;
  for (let i = 0; i < 3660; i += 1) {
    if (hasAnyLog(dateKey(cursor))) streak += 1;
    else break;
    cursor = addDays(cursor, -1);
  }
  return streak;
}

function allScheduledDone(date) {
  const list = habitsForDay(date);
  if (!list.length) return false;
  return list.every((habit) => isDone(dateKey(date), habit.id));
}

function perfectStreak() {
  let cursor = new Date();
  if (!allScheduledDone(cursor)) cursor = addDays(cursor, -1);
  let streak = 0;
  for (let i = 0; i < 3660; i += 1) {
    const list = habitsForDay(cursor);
    if (list.length) {
      if (allScheduledDone(cursor)) streak += 1;
      else break;
    }
    cursor = addDays(cursor, -1);
  }
  return streak;
}

function perfectDayCount() {
  let count = 0;
  const today = new Date();
  for (let i = 0; i < 3660; i += 1) {
    const date = addDays(today, -i);
    const key = dateKey(date);
    if (key < state.createdAt) break;
    const list = habitsForDay(date);
    if (list.length && allScheduledDone(date)) count += 1;
  }
  return count;
}

function completionRate(days = 30) {
  let done = 0;
  let opportunities = 0;
  const today = new Date();
  for (let i = 1; i <= days; i += 1) {
    const date = addDays(today, -i);
    const key = dateKey(date);
    activeHabits().forEach((habit) => {
      if (key < habit.createdAt) return;
      if (!scheduledOn(habit, date)) return;
      opportunities += 1;
      if (isDone(key, habit.id)) done += 1;
    });
  }
  return opportunities ? done / opportunities : 0;
}

function daysInSystem() {
  const start = parseKey(state.createdAt || dateKey());
  return Math.max(1, diffDays(start, new Date()) + 1);
}

function compounding() {
  return Math.pow(1.01, Math.max(0, activeDayCount()));
}

const LEVELS = [
  { min: 0, name: "Первый голос" },
  { min: 1, name: "Искра" },
  { min: 5, name: "Набирает силу" },
  { min: 15, name: "Формируется" },
  { min: 30, name: "Большинство" },
  { min: 60, name: "Закрепляется" },
  { min: 120, name: "Сильная идентичность" },
  { min: 240, name: "Это уже вы" },
  { min: 500, name: "Глубокая идентичность" }
];

function levelInfo(votes) {
  let index = 0;
  LEVELS.forEach((level, i) => {
    if (votes >= level.min) index = i;
  });
  const current = LEVELS[index];
  const next = LEVELS[index + 1] || null;
  const progress = next ? clamp((votes - current.min) / (next.min - current.min), 0, 1) : 1;
  return {
    index,
    name: current.name,
    next,
    progress,
    remaining: next ? Math.max(0, next.min - votes) : 0
  };
}

function identityStats(identityId) {
  const habits = activeHabits().filter((habit) => habit.identityId === identityId);
  let full = 0;
  let min = 0;
  Object.entries(state.logs).forEach(([key, entries]) => {
    habits.forEach((habit) => {
      const entry = entries[habit.id];
      if (entry === "full") full += 1;
      if (entry === "min") min += 1;
    });
  });
  const votes = full + min;
  const todayKey = dateKey();
  const todayEntries = state.logs[todayKey] || {};
  const todayVotes = habits.filter((habit) => todayEntries[habit.id]).length;
  const level = levelInfo(votes);
  return { habits, full, min, votes, todayVotes, level };
}

function weekVotes(identityId, days = 7) {
  const habits = activeHabits().filter((habit) => habit.identityId === identityId);
  let count = 0;
  for (let i = 0; i < days; i += 1) {
    const entries = state.logs[dateKey(addDays(new Date(), -i))] || {};
    habits.forEach((habit) => {
      if (entries[habit.id]) count += 1;
    });
  }
  return count;
}

function quoteOfDay() {
  const start = parseKey(state.createdAt || dateKey());
  const index = Math.abs(diffDays(start, new Date())) % QUOTES.length;
  return QUOTES[index];
}

/* ------------------------------------------------------------
   Общие фрагменты интерфейса
   ------------------------------------------------------------ */

function navItems() {
  const t = todayStats();
  const badge = t.total ? `${t.done}/${t.total}` : "";
  return [
    { route: "today", label: "Сегодня", icon: "today", badge },
    { route: "habits", label: "Привычки", icon: "habits", badge: String(activeHabits().length) },
    { route: "identity", label: "Идентичность", icon: "identity", badge: String(state.identities.length) },
    { route: "progress", label: "Прогресс", icon: "progress", badge: "" },
    { route: "book", label: "Из книги", icon: "book", badge: "" }
  ];
}

function navHTML() {
  return navItems().map((item) => `
    <a class="nav-link ${currentRoute === item.route ? "is-active" : ""}" href="#${item.route}" ${currentRoute === item.route ? 'aria-current="page"' : ""}>
      <span class="nav-icon">${icon(item.icon, 19)}</span>
      <span class="nav-label">${item.label}</span>
      ${item.badge ? `<span class="nav-badge">${item.badge}</span>` : ""}
    </a>`).join("");
}

function mobileNavHTML() {
  return `<nav class="mobile-nav" aria-label="Основная навигация">
    ${navItems().map((item) => `
      <a class="mnav-link ${currentRoute === item.route ? "is-active" : ""}" href="#${item.route}" ${currentRoute === item.route ? 'aria-current="page"' : ""}>
        ${icon(item.icon, 20)}<span>${item.label}</span>
      </a>`).join("")}
  </nav>`;
}

function shellHTML() {
  const focus = focusIdentity();
  const name = state.profile.name.trim();
  const initial = name ? name.slice(0, 1).toUpperCase() : "Я";
  const routeLabels = { today: "Сегодня", habits: "Привычки", identity: "Идентичность", progress: "Прогресс", book: "Из книги" };
  const theme = state.settings.theme;
  return `<aside class="sidebar">
      <a class="brand" href="#today" aria-label="АТОМ — на главную">
        <span class="brand-mark">${atomMark(34)}</span>
        <span class="brand-text"><b>атом</b><small>трекер привычек</small></span>
      </a>
      <nav class="nav" aria-label="Основная навигация">${navHTML()}</nav>
      <div class="sidebar-foot">
        <div class="side-quote">
          <span class="side-quote-mark">“</span>
          <p>${esc(quoteOfDay().text)}</p>
          <small>${esc(quoteOfDay().chapter)} · Джеймс Клир</small>
        </div>
        <div class="side-actions">
          <button class="icon-btn" data-action="open-settings" aria-label="Настройки" title="Настройки">${icon("settings")}</button>
          <button class="icon-btn" data-action="toggle-theme" aria-label="Сменить тему" title="Сменить тему">${icon(theme === "dark" ? "sun" : "moon")}</button>
        </div>
        <div class="side-profile">
          <span class="avatar" ${focus ? `style="--av:${safeColor(focus.color)}"` : ""}>${esc(initial)}</span>
          <div class="side-profile-text">
            <strong>${esc(name || "Без имени")}</strong>
            <small>${activeHabits().length} ${plural(activeHabits().length, "привычка", "привычки", "привычек")}</small>
          </div>
        </div>
      </div>
    </aside>
    <div class="main">
      <header class="topbar">
        <div class="topbar-left">
          <a class="mobile-brand" href="#today">атом</a>
          <h2 class="topbar-title">${routeLabels[currentRoute] || "Сегодня"}</h2>
        </div>
        <div class="topbar-actions">
          <button class="icon-btn top-settings" data-action="open-settings" aria-label="Настройки">${icon("settings")}</button>
          <button class="btn btn-primary" data-action="open-habit">${icon("plus", 17)}<span>Привычка</span></button>
        </div>
      </header>
      <main id="view" class="view" tabindex="-1"></main>
    </div>
    ${mobileNavHTML()}
    <div id="confetti-root" class="confetti-root" aria-hidden="true"></div>`;
}

function demoBanner() {
  if (!state.isDemo || state.settings.hideDemoBanner) return "";
  return `<div class="demo-banner">
    <span class="demo-dot"></span>
    <p><strong>Демо-режим.</strong> 50 дней истории, чтобы вы увидели, как работают механики.</p>
    <button class="link-btn" data-action="start-fresh">Начать своё ${icon("arrow", 15)}</button>
    <button class="icon-btn demo-close" data-action="dismiss-demo" aria-label="Скрыть">${icon("close", 15)}</button>
  </div>`;
}

function pageHead(eyebrow, title, lede, actions = "") {
  return `<div class="page-head">
    <div class="page-head-copy">
      <p class="eyebrow">${eyebrow}</p>
      <h1>${title}</h1>
      ${lede ? `<p class="lede">${lede}</p>` : ""}
    </div>
    ${actions ? `<div class="head-actions">${actions}</div>` : ""}
  </div>`;
}

function sectionHead(title, aside = "", eyebrow = "") {
  return `<div class="section-head">
    <div>${eyebrow ? `<p class="eyebrow">${eyebrow}</p>` : ""}<h2>${title}</h2></div>
    ${aside ? `<div class="section-aside">${aside}</div>` : ""}
  </div>`;
}

function emptyState(title, text, action = "") {
  return `<div class="empty">
    <div class="empty-orbit">${atomMark(74)}</div>
    <h3>${title}</h3>
    <p>${text}</p>
    ${action}
  </div>`;
}

/* ------------------------------------------------------------
   Главный экран «Сегодня»
   ------------------------------------------------------------ */

function greeting() {
  const hour = new Date().getHours();
  if (hour < 5) return "Доброй ночи";
  if (hour < 12) return "Доброе утро";
  if (hour < 18) return "Добрый день";
  return "Добрый вечер";
}

function cueLine(habit) {
  const parts = [];
  if (habit.anchor) parts.push(`После: ${esc(habit.anchor)}`);
  const meta = [habit.time, habit.place].filter(Boolean).map(esc).join(" · ");
  if (meta) parts.push(meta);
  return parts.length ? parts.join(" — ") : "В любое время";
}

function statStrip() {
  const t = todayStats();
  const streak = activeStreak();
  const perfect = perfectDayCount();
  return `<section class="stat-strip" aria-label="Сводка дня">
    <div class="stat">
      <span class="stat-icon">${icon("check", 18)}</span>
      <div><strong class="stat-value">${t.done}<span class="stat-of">/${t.total}</span></strong><span class="stat-label">сделано сегодня</span></div>
    </div>
    <div class="stat">
      <span class="stat-icon">${icon("flame", 18)}</span>
      <div><strong class="stat-value">${streak}</strong><span class="stat-label">${plural(streak, "день", "дня", "дней")} в потоке</span></div>
    </div>
    <div class="stat">
      <span class="stat-icon">${icon("spark", 18)}</span>
      <div><strong class="stat-value">+${t.votes}</strong><span class="stat-label">${plural(t.votes, "голос", "голоса", "голосов")} за день</span></div>
    </div>
    <div class="stat stat-perfect">
      <span class="stat-icon">${icon("target", 18)}</span>
      <div><strong class="stat-value">${perfect}</strong><span class="stat-label">${plural(perfect, "идеальный день", "идеальных дня", "идеальных дней")} всего</span></div>
    </div>
  </section>`;
}

function identityBanner() {
  const identity = focusIdentity();
  if (!identity) {
    return `<section class="identity-banner identity-banner--empty">
      <div><p class="eyebrow">Кем я становлюсь</p><h2>Сначала выберите идентичность.</h2><p>Не цель, а человека, которым хотите стать.</p></div>
      <a class="btn btn-light" href="#identity">Выбрать</a>
    </section>`;
  }
  const stats = identityStats(identity.id);
  const level = stats.level;
  const pct = Math.round(level.progress * 100);
  return `<section class="identity-banner" style="--id:${safeColor(identity.color)}">
    <div class="ib-glow" aria-hidden="true"></div>
    <div class="ib-main">
      <p class="eyebrow">Кем я становлюсь</p>
      <h2>«${esc(identity.statement || identity.title)}»</h2>
      <p class="ib-sub">${esc(identity.title)} · ${stats.todayVotes ? `сегодня +${stats.todayVotes} ${plural(stats.todayVotes, "голос", "голоса", "голосов")}` : "сегодня ещё нет голосов"}</p>
    </div>
    <div class="ib-progress">
      <div class="ib-level-row"><span>${level.name}</span><span>${stats.votes} ${plural(stats.votes, "голос", "голоса", "голосов")}</span></div>
      <div class="bar"><span style="width:${pct}%"></span></div>
      <p class="ib-hint">${level.next ? `Ещё ${level.remaining} — и «${level.next.name}»` : "Максимальный уровень. Это уже вы."}</p>
      <a class="ib-link" href="#identity">Все идентичности ${icon("arrow", 14)}</a>
    </div>
  </section>`;
}

function miniDays(habit) {
  const stats = habitStats(habit);
  const color = identityColor(habit.identityId);
  return `<div class="mini-days" aria-label="Последние 14 дней" style="--hc:${color}">
    ${stats.last14.map((day) => {
      const cls = day.entry === "full" ? "is-full" : day.entry === "min" ? "is-min" : day.scheduled ? "is-miss" : "is-off";
      const title = `${shortDate(day.date)} — ${day.entry === "full" ? "выполнено" : day.entry === "min" ? "минимум" : day.scheduled ? "пропуск" : "не запланировано"}`;
      return `<span class="mini-day ${cls} ${day.isToday ? "is-today" : ""}" title="${esc(title)}"></span>`;
    }).join("")}
  </div>`;
}

function missNote(habit, done, missRun) {
  if (!done && missRun === 1) {
    return `<p class="miss-note miss-amber">${icon("flame", 14)} Вчера был пропуск. Сегодня — день, когда цепочка не рвётся дважды.</p>`;
  }
  if (!done && missRun >= 2) {
    return `<p class="miss-note miss-red">${icon("restore", 14)} Цепочка прервалась. Не идеальность, а возвращение: сделайте хотя бы двухминутную версию.</p>`;
  }
  if (done && missRun > 0) {
    return `<p class="miss-note miss-green">${icon("spark", 14)} Цепочка восстановлена. Именно так и работает «никогда не пропускай дважды».</p>`;
  }
  return "";
}

function habitCard(habit, options = {}) {
  const today = Boolean(options.today);
  const key = dateKey();
  const entry = getEntry(key, habit.id);
  const canCheck = today || scheduledOn(habit, new Date());
  const stats = habitStats(habit);
  const color = identityColor(habit.identityId);
  const done = Boolean(entry);
  const missRun = today ? stats.missRun : 0;
  const identity = identityById(habit.identityId);
  const minTitle = habit.minVersion || "сделать один маленький шаг";
  const checkInner = entry === "full" ? icon("check", 22) : entry === "min" ? `<span class="half">½</span>` : `<span class="check-dot"></span>`;
  const checkLabel = done ? `Отменить отметку «${esc(habit.title)}»` : `Отметить «${esc(habit.title)}» выполненной`;
  return `<article class="habit-card ${done ? "is-done" : ""} ${!done && missRun >= 2 ? "is-broken" : ""}" style="--hc:${color}">
    ${canCheck
      ? `<button class="check ${entry === "full" ? "is-full" : entry === "min" ? "is-min" : ""}" data-action="check-full" data-id="${esc(habit.id)}" aria-label="${checkLabel}">${checkInner}</button>`
      : `<span class="check check-static ${entry === "full" ? "is-full" : entry === "min" ? "is-min" : ""}" title="Сегодня не запланировано">${checkInner}</span>`}
    <div class="habit-body">
      <div class="habit-title-row">
        <span class="habit-emoji" aria-hidden="true">${esc(habit.emoji || "✳️")}</span>
        <h3>${esc(habit.title)}</h3>
        ${stats.streak > 0 ? `<span class="streak" title="Серия по этой привычке">${icon("flame", 13)} ${stats.streak}</span>` : ""}
      </div>
      <p class="cue">${cueLine(habit)}</p>
      <div class="habit-tags">
        ${canCheck
          ? `<button class="tag tag-min" data-action="check-min" data-id="${esc(habit.id)}" title="Правило двух минут: минимальная версия тоже считается">${icon("clock", 13)} 2 мин · ${esc(minTitle)}</button>`
          : `<span class="tag tag-min tag-static">${icon("clock", 13)} 2 мин · ${esc(minTitle)}</span>`}
        ${habit.reward ? `<span class="tag tag-reward" title="Сочетание приятного с полезным">${icon("spark", 13)} ${esc(habit.reward)}</span>` : ""}
      </div>
      ${miniDays(habit)}
      ${today ? missNote(habit, done, missRun) : ""}
      ${!today ? `<div class="habit-stats-row">
        <span><b>${stats.opportunities ? `${Math.round(stats.rate * 100)}%` : "—"}</b> за 30 дней</span>
        <span><b>${stats.total}</b> всего</span>
        <span>${identity ? esc(identity.short) : "без идентичности"}</span>
      </div>` : ""}
    </div>
    <div class="habit-tools">
      <button class="icon-btn" data-action="edit-habit" data-id="${esc(habit.id)}" aria-label="Изменить привычку" title="Изменить">${icon("edit", 16)}</button>
      <button class="icon-btn" data-action="habit-more" data-id="${esc(habit.id)}" aria-label="Детали привычки" title="Детали">${icon("dots", 17)}</button>
    </div>
  </article>`;
}

function plateauText() {
  const days = daysInSystem();
  if (days < 7) return "Вы в самом начале. Усилия уже накапливаются — просто результат приходит позже, чем хочется.";
  if (days < 21) return "Это «Долина разочарования»: лёд уже нагрет, но ещё не растаял. Продолжайте — критическая точка ближе, чем кажется.";
  if (days < 45) return "Плато начинает работать на вас. Не сравнивайте день 1 с днём 30 — сравнивайте траекторию.";
  return "Вы прошли период, когда результат отстаёт от усилий. Теперь важнее не рывок, а непрерывность.";
}

function plateauChart(compact = false) {
  const width = compact ? 340 : 780;
  const height = compact ? 150 : 320;
  const margin = compact ? { l: 10, r: 10, t: 16, b: 10 } : { l: 46, r: 22, t: 26, b: 38 };
  const innerW = width - margin.l - margin.r;
  const innerH = height - margin.t - margin.b;
  const days = daysInSystem();
  const domain = Math.max(60, days + 12);
  const X = (x) => margin.l + (x / domain) * innerW;
  const Y = (v) => margin.t + (1 - v) * innerH;
  const steps = 90;
  let actual = "";
  for (let i = 0; i <= steps; i += 1) {
    const x = (domain * i) / steps;
    const v = Math.pow(x / domain, 2.35);
    actual += `${i === 0 ? "M" : "L"}${X(x).toFixed(1)},${Y(v).toFixed(1)} `;
  }
  let valley = actual;
  for (let i = steps; i >= 0; i -= 1) {
    const x = (domain * i) / steps;
    const v = x / domain;
    valley += `L${X(x).toFixed(1)},${Y(v).toFixed(1)} `;
  }
  valley += "Z";
  const day = clamp(days, 0, domain);
  const dayValue = Math.pow(day / domain, 2.35);
  const ticks = [];
  for (let t = 0; t <= domain; t += 30) ticks.push(t);
  const grid = ticks.map((t) => `<line x1="${X(t)}" y1="${margin.t}" x2="${X(t)}" y2="${margin.t + innerH}" />`).join("");
  const labels = ticks.map((t) => `<text x="${X(t)}" y="${height - 12}" text-anchor="middle">${t === 0 ? "старт" : `${t} дн.`}</text>`).join("");
  const marker = `<line class="pc-marker" x1="${X(day)}" y1="${margin.t}" x2="${X(day)}" y2="${margin.t + innerH}" />
    <circle class="pc-dot" cx="${X(day)}" cy="${Y(dayValue)}" r="${compact ? 4 : 5.5}" />
    ${compact ? "" : `<text class="pc-marker-label" x="${X(day) + 10}" y="${Y(dayValue) - 10}">вы здесь</text>`}`;
  return `<svg class="plateau-chart ${compact ? "is-compact" : ""}" viewBox="0 0 ${width} ${height}" role="img" aria-label="Схема плато скрытого потенциала: ожидаемый линейный рост и реальная кривая с отложенным результатом">
    <g class="pc-grid">${grid}</g>
    <path class="pc-valley" d="${valley}" />
    <path class="pc-area" d="${actual} L${X(domain)},${Y(0)} L${X(0)},${Y(0)} Z" />
    <path class="pc-line" d="${actual}" />
    <path class="pc-expected" d="M${X(0)},${Y(0)} L${X(domain)},${Y(1)}" />
    ${marker}
    ${compact ? "" : `<text class="pc-axis-label" x="${margin.l}" y="${margin.t - 8}">видимый результат</text>
    <text class="pc-axis-label pc-axis-right" x="${width - margin.r}" y="${height - 12}" text-anchor="end">время</text>`}
    ${compact ? "" : labels}
  </svg>`;
}

function twoMinuteCard(list) {
  const pending = list.filter((habit) => !isDone(dateKey(), habit.id));
  if (!pending.length) {
    return `<div class="rail-card rail-min">
      <p class="eyebrow">Правило двух минут</p>
      <h3>Всё отмечено.</h3>
      <p class="rail-text">Даже если день был неидеальным — вы не опустились до нуля. Это и есть сохранение роста.</p>
    </div>`;
  }
  const habit = pending[0];
  return `<div class="rail-card rail-min" style="--hc:${identityColor(habit.identityId)}">
    <p class="eyebrow">Правило двух минут</p>
    <h3>Не хочется?</h3>
    <p class="rail-text">Просто <b>${esc(habit.minVersion || "сделайте один маленький шаг")}</b>. Этого достаточно, чтобы цепочка «${esc(habit.title)}» осталась живой.</p>
    <button class="btn btn-soft btn-sm" data-action="check-min" data-id="${esc(habit.id)}">${icon("clock", 15)} Сделать минимум</button>
  </div>`;
}

function quoteCard() {
  const quote = quoteOfDay();
  return `<figure class="rail-card quote-card">
    <span class="quote-mark">“</span>
    <blockquote>${esc(quote.text)}</blockquote>
    <figcaption>${esc(quote.chapter)} · «Атомные привычки»</figcaption>
  </figure>`;
}

function viewToday() {
  const t = todayStats();
  const allDone = t.total > 0 && t.done === t.total;
  const name = state.profile.name.trim();
  const focus = focusIdentity();
  const next = nextHabitsInfo();
  return `<div class="page page-today">
    ${pageHead(
      `${longDate(new Date())}`,
      `${greeting()}${name ? `, ${esc(name)}` : ""}.`,
      focus
        ? `Сегодня вы собираете доказательства для идентичности «${esc(focus.short)}». Не идеальность — присутствие.`
        : "Начните с одного маленького действия. Оно станет первым голосом.",
      `<button class="btn btn-ghost" data-action="open-habit">${icon("plus", 16)} Добавить привычку</button>`
    )}
    ${t.total || state.identities.length ? statStrip() : ""}
    ${identityBanner()}
    <div class="today-grid">
      <section class="today-main">
        ${sectionHead("Ритуалы на сегодня", `<span class="pill">${t.done} из ${t.total}</span>`, "Сделайте очевидным")}
        ${t.list.length
          ? t.list.map((habit) => habitCard(habit, { today: true })).join("")
          : emptyToday(next)}
        ${allDone ? perfectCard() : ""}
      </section>
      <aside class="today-rail">
        <div class="rail-card rail-plateau">
          <div class="rail-head">
            <p class="eyebrow">Глава 1 · отложенный эффект</p>
            <span class="pill pill-quiet">день ${daysInSystem()}</span>
          </div>
          <h3>Плато скрытого потенциала</h3>
          ${plateauChart(true)}
          <p class="rail-text">${plateauText()}</p>
          <a class="text-link" href="#progress">Открыть график ${icon("arrow", 14)}</a>
        </div>
        ${twoMinuteCard(t.list)}
        ${quoteCard()}
      </aside>
    </div>
  </div>`;
}

function emptyToday(next) {
  if (next) {
    return emptyState(
      "Сегодня — день отдыха",
      `По расписанию следующая привычка — ${next.when}: «${esc(next.habit.title)}». Можно ничего не делать. Это тоже часть системы.`,
      `<button class="btn btn-primary" data-action="open-habit">${icon("plus", 16)} Добавить привычку</button>`
    );
  }
  return emptyState(
    "Пока пусто",
    "Добавьте первую привычку и привяжите её к идентичности. Одно действие сегодня важнее идеального плана на год.",
    `<div class="empty-actions"><button class="btn btn-primary" data-action="open-habit">${icon("plus", 16)} Создать привычку</button><a class="btn btn-ghost" href="#identity">Выбрать идентичность</a></div>`
  );
}

function nextHabitsInfo() {
  for (let i = 1; i <= 7; i += 1) {
    const date = addDays(new Date(), i);
    const list = habitsForDay(date);
    if (list.length) {
      const when = i === 1 ? "завтра" : `${longDate(date)}`;
      return { when, habit: list[0] };
    }
  }
  return null;
}

function perfectCard() {
  return `<div class="perfect-card">
    <div class="perfect-spark">${icon("spark", 26)}</div>
    <div><p class="eyebrow">Идеальный день</p><h3>Все голоса собраны.</h3><p>Вы не стали идеальным. Вы стали человеком, который не пропустил день. Это и есть идентичность.</p></div>
  </div>`;
}

/* ------------------------------------------------------------
   Экран «Привычки»
   ------------------------------------------------------------ */

function timeBucket(habit) {
  if (!habit.time) return "В течение дня";
  const hour = Number(habit.time.split(":")[0]);
  if (hour < 12) return "Утро";
  if (hour < 18) return "День";
  return "Вечер";
}

function stackHTML() {
  const habits = activeHabits();
  if (!habits.length) return "";
  const groups = ["Утро", "День", "Вечер", "В течение дня"];
  const sorted = [...habits].sort((a, b) => (a.time || "99:99").localeCompare(b.time || "99:99"));
  return `<section class="card stack-card">
    ${sectionHead("Стек привычек", `<span class="pill pill-quiet">${sorted.length} ${plural(sorted.length, "звено", "звена", "звеньев")}</span>`, "Глава 5 · наложение привычек")}
    <p class="card-lede">Каждое действие — стимул для следующего. Так день собирается сам, без силы воли.</p>
    <div class="stack-groups">
      ${groups.map((group) => {
        const items = sorted.filter((habit) => timeBucket(habit) === group);
        if (!items.length) return "";
        return `<div class="stack-group">
          <div class="stack-group-head"><span>${group}</span><span class="stack-line"></span></div>
          ${items.map((habit) => {
            const done = isDone(dateKey(), habit.id);
            return `<div class="stack-item ${done ? "is-done" : ""}" style="--hc:${identityColor(habit.identityId)}">
              <span class="stack-time">${esc(habit.time || "—")}</span>
              <span class="stack-dot"></span>
              <div class="stack-copy">
                <strong>${esc(habit.title)}</strong>
                <span>${habit.anchor ? `После: ${esc(habit.anchor)}` : "Без якоря"}</span>
              </div>
              <span class="stack-state">${done ? icon("check", 15) : ""}</span>
            </div>`;
          }).join("")}
        </div>`;
      }).join("")}
    </div>
  </section>`;
}

function viewHabits() {
  const habits = activeHabits();
  const archived = state.habits.filter((habit) => habit.archived);
  return `<div class="page">
    ${pageHead(
      "Четыре закона · очевидно, привлекательно, просто, приятно",
      "Привычки",
      "Каждая привычка — атом вашей системы. Здесь можно настроить якорь, двухминутную версию, награду и среду.",
      `<button class="btn btn-primary" data-action="open-habit">${icon("plus", 16)} Новая привычка</button>`
    )}
    ${!state.identities.length ? `<div class="callout">${icon("identity", 18)} Сначала создайте идентичность — привычке нужен «владелец», за кого она голосует. <a href="#identity">Перейти →</a></div>` : ""}
    ${stackHTML()}
    ${sectionHead("Все привычки", `<span class="pill">${habits.length}</span>`, "Управление системой")}
    ${habits.length
      ? `<div class="habit-list">${habits.map((habit) => habitCard(habit)).join("")}</div>`
      : emptyState("Привычек пока нет", "Начните с одной. Маленькой. Такой, которую невозможно не сделать.", `<button class="btn btn-primary" data-action="open-habit">${icon("plus", 16)} Создать привычку</button>`)}
    ${archived.length ? `<details class="archive-block">
      <summary>${icon("archive", 16)} Архив · ${archived.length}</summary>
      <div class="archive-list">
        ${archived.map((habit) => `<div class="archive-row">
          <span>${esc(habit.emoji)} ${esc(habit.title)}</span>
          <div><button class="btn btn-ghost btn-sm" data-action="restore-habit" data-id="${esc(habit.id)}">${icon("restore", 14)} Вернуть</button>
          <button class="icon-btn danger" data-action="delete-habit" data-id="${esc(habit.id)}" aria-label="Удалить">${icon("trash", 15)}</button></div>
        </div>`).join("")}
      </div>
    </details>` : ""}
  </div>`;
}

/* ------------------------------------------------------------
   Экран «Идентичность»
   ------------------------------------------------------------ */

function evidenceDots(identityId) {
  const habits = activeHabits().filter((habit) => habit.identityId === identityId);
  let out = "";
  for (let i = 34; i >= 0; i -= 1) {
    const date = addDays(new Date(), -i);
    const entries = state.logs[dateKey(date)] || {};
    const count = habits.filter((habit) => entries[habit.id]).length;
    const level = count === 0 ? 0 : count === 1 ? 1 : count === 2 ? 2 : 3;
    out += `<span class="evidence-dot lvl-${level}" title="${shortDate(date)} · ${count} ${plural(count, "голос", "голоса", "голосов")}"></span>`;
  }
  return `<div class="evidence-dots" aria-label="Голоса за последние 35 дней">${out}</div>`;
}

function identityCard(identity) {
  const stats = identityStats(identity.id);
  const level = stats.level;
  const pct = Math.round(level.progress * 100);
  const isFocus = state.profile.focusIdentityId === identity.id;
  return `<article class="id-card ${isFocus ? "is-focus" : ""}" style="--id:${safeColor(identity.color)}">
    <header class="id-card-head">
      <span class="id-emoji">${esc(identity.emoji)}</span>
      <div class="id-title">
        <p class="eyebrow">${isFocus ? "Фокусная идентичность" : "Идентичность"}</p>
        <h2>${esc(identity.title)}</h2>
      </div>
      <button class="icon-btn" data-action="edit-identity" data-id="${esc(identity.id)}" aria-label="Изменить идентичность">${icon("edit", 16)}</button>
    </header>
    <p class="id-statement">«${esc(identity.statement)}»</p>
    ${identity.why ? `<p class="id-why">${esc(identity.why)}</p>` : ""}
    <div class="id-level-row"><span>${level.name}</span><span><b>${stats.votes}</b> ${plural(stats.votes, "голос", "голоса", "голосов")}</span></div>
    <div class="bar id-bar"><span style="width:${pct}%"></span></div>
    <p class="id-hint">${level.next ? `До уровня «${level.next.name}» — ${level.remaining} ${plural(level.remaining, "голос", "голоса", "голосов")}` : "Максимальный уровень: идентичность закреплена"}</p>
    <div class="id-evidence">
      <div class="id-evidence-head"><span>Доказательства · 35 дней</span><span>+${weekVotes(identity.id, 7)} за неделю</span></div>
      ${evidenceDots(identity.id)}
    </div>
    <div class="id-habits">
      ${stats.habits.length
        ? stats.habits.map((habit) => `<a class="id-habit" href="#habits" style="--hc:${safeColor(identity.color)}"><span>${esc(habit.emoji)}</span>${esc(habit.title)}</a>`).join("")
        : `<span class="id-empty">Пока нет привычек — добавьте первую.</span>`}
    </div>
    <footer class="id-foot">
      ${isFocus
        ? `<span class="focus-badge">${icon("target", 14)} В фокусе</span>`
        : `<button class="btn btn-soft btn-sm" data-action="focus-identity" data-id="${esc(identity.id)}">${icon("target", 14)} Сделать фокусной</button>`}
      <button class="btn btn-ghost btn-sm" data-action="open-habit" data-identity="${esc(identity.id)}">${icon("plus", 14)} Привычка</button>
      <button class="icon-btn danger" data-action="delete-identity" data-id="${esc(identity.id)}" aria-label="Удалить идентичность">${icon("trash", 15)}</button>
    </footer>
  </article>`;
}

function viewIdentity() {
  return `<div class="page">
    ${pageHead(
      "Глава 2 · привычки формируют идентичность",
      "Кем вы становитесь?",
      "Не «чего я хочу добиться», а «кем я хочу быть». Каждая галочка — это голос. Не нужно единогласие — нужно большинство.",
      `<div class="head-actions"><button class="btn btn-ghost" data-action="open-library">${icon("book", 16)} Библиотека</button><button class="btn btn-primary" data-action="open-identity">${icon("plus", 16)} Идентичность</button></div>`
    )}
    <div class="identity-note">
      <div class="identity-note-icon">${icon("identity", 22)}</div>
      <p><strong>Это не аффирмации.</strong> Идентичность собирается из доказательств: «я сделал это сегодня» → «я человек, который делает это» → «это часть меня». Трекер просто хранит доказательства.</p>
    </div>
    ${state.identities.length
      ? `<div class="id-grid">${state.identities.map(identityCard).join("")}</div>`
      : emptyState("Идентичностей пока нет", "Выберите, кем хотите стать. Не результат — человека, который этот результат создаёт.", `<button class="btn btn-primary" data-action="open-identity">${icon("plus", 16)} Создать идентичность</button>`)}
    <section class="card identity-guide">
      ${sectionHead("Два шага, которые важнее всего", "", "Из главы 2")}
      <div class="guide-grid">
        <div class="guide-step"><span class="guide-num">1</span><h3>Решите, кем хотите быть</h3><p>Опишите идентичность как утверждение: «Я человек, который…». Начните с результатов, которые хотите, и двигайтесь назад — к человеку, который их создаёт.</p></div>
        <div class="guide-step"><span class="guide-num">2</span><h3>Докажите это малыми действиями</h3><p>Каждый чекин — один голос. 30 голосов — уже большинство. Пропуск не отменяет голоса; отменяет только серия пропусков.</p></div>
      </div>
    </section>
  </div>`;
}

/* ------------------------------------------------------------
   Экран «Прогресс»
   ------------------------------------------------------------ */

function heatmapData(weeks = 18) {
  const today = new Date();
  const start = addDays(startOfWeek(today), -(weeks - 1) * 7);
  const habitCount = Math.max(1, activeHabits().length);
  const cells = [];
  for (let i = 0; i < weeks * 7; i += 1) {
    const date = addDays(start, i);
    const key = dateKey(date);
    const count = Object.keys(state.logs[key] || {}).length;
    const future = diffDays(date, today) < 0;
    const before = key < state.createdAt;
    const level = count === 0 ? 0 : clamp(Math.ceil((count / habitCount) * 4), 1, 4);
    cells.push({ date, key, count, future, before, level });
  }
  return { start, cells, weeks };
}

function heatmapHTML() {
  const { start, cells, weeks } = heatmapData(18);
  const monthLabels = [];
  let previousMonth = -1;
  for (let w = 0; w < weeks; w += 1) {
    const monday = addDays(start, w * 7);
    if (monday.getMonth() !== previousMonth) {
      monthLabels.push(MONTHS_SHORT[monday.getMonth()]);
      previousMonth = monday.getMonth();
    } else {
      monthLabels.push("");
    }
  }
  return `<div class="heatmap">
    <div class="hm-months">${monthLabels.map((label) => `<span>${label}</span>`).join("")}</div>
    <div class="hm-grid">
      ${cells.map((cell) => {
        const title = cell.before ? `${shortDate(cell.date)} · до старта` : cell.future ? `${shortDate(cell.date)} · ещё впереди` : `${shortDate(cell.date)} · ${cell.count} ${plural(cell.count, "действие", "действия", "действий")}`;
        return `<span class="hm-cell lvl-${cell.level} ${cell.future ? "is-future" : ""} ${cell.before ? "is-before" : ""}" title="${esc(title)}"></span>`;
      }).join("")}
    </div>
    <div class="hm-legend"><span>меньше</span><i class="lvl-0"></i><i class="lvl-1"></i><i class="lvl-2"></i><i class="lvl-3"></i><i class="lvl-4"></i><span>больше</span></div>
  </div>`;
}

function weeklyBars() {
  const weeks = [];
  const current = startOfWeek(new Date());
  for (let w = 7; w >= 0; w -= 1) {
    const start = addDays(current, -w * 7);
    let done = 0;
    let opportunities = 0;
    for (let d = 0; d < 7; d += 1) {
      const date = addDays(start, d);
      if (diffDays(date, new Date()) < 0) continue;
      const key = dateKey(date);
      activeHabits().forEach((habit) => {
        if (key < habit.createdAt) return;
        if (!scheduledOn(habit, date)) return;
        opportunities += 1;
        if (isDone(key, habit.id)) done += 1;
      });
    }
    weeks.push({ start, rate: opportunities ? done / opportunities : 0, done, opportunities });
  }
  return `<div class="week-bars">
    ${weeks.map((week) => `<div class="week-col" title="${shortDate(week.start)} · ${Math.round(week.rate * 100)}%">
      <div class="week-track"><span style="height:${Math.max(week.opportunities ? 5 : 0, Math.round(week.rate * 100))}%"></span></div>
      <small>${shortDate(week.start)}</small>
    </div>`).join("")}
  </div>`;
}

function performanceRows() {
  const rows = activeHabits().map((habit) => {
    const stats = habitStats(habit);
    let rec = { label: "Мало данных", cls: "neutral" };
    if (stats.opportunities >= 5) {
      if (stats.rate >= 0.85) rec = { label: "Можно усложнить", cls: "easy" };
      else if (stats.rate <= 0.5) rec = { label: "Сделайте проще", cls: "hard" };
      else rec = { label: "В балансе", cls: "ok" };
    }
    return { habit, stats, rec };
  });
  return `<div class="perf-table-wrap">
    <table class="perf-table">
      <thead><tr><th>Привычка</th><th>30 дней</th><th>Серия</th><th>Баланс</th></tr></thead>
      <tbody>
        ${rows.map(({ habit, stats, rec }) => `<tr>
          <td><span class="perf-name">${esc(habit.emoji)} ${esc(habit.title)}</span></td>
          <td><span class="perf-rate">${stats.opportunities ? `${Math.round(stats.rate * 100)}%` : "—"}</span></td>
          <td>${stats.streak} ${plural(stats.streak, "день", "дня", "дней")}</td>
          <td><span class="rec rec-${rec.cls}">${rec.label}</span></td>
        </tr>`).join("")}
      </tbody>
    </table>
  </div>`;
}

function auditHTML() {
  const habits = activeHabits();
  if (!habits.length) return "";
  const counts = { plus: 0, minus: 0, equal: 0 };
  habits.forEach((habit) => {
    if (state.audit[habit.id] && counts[state.audit[habit.id]] !== undefined) counts[state.audit[habit.id]] += 1;
  });
  return `<section class="card audit-card">
    ${sectionHead("Учётная карточка", "", "Глава 4 · осознанность")}
    <p class="card-lede">Помогает ли эта привычка стать тем, кем вы хотите быть? Отметьте без осуждения — это наблюдение, а не приговор.</p>
    <div class="audit-list">
      ${habits.map((habit) => `<div class="audit-row">
        <span class="audit-name">${esc(habit.emoji)} ${esc(habit.title)}</span>
        <div class="audit-btns" role="group" aria-label="Оценка привычки ${esc(habit.title)}">
          <button class="audit-btn ${state.audit[habit.id] === "plus" ? "is-plus" : ""}" data-action="audit" data-id="${esc(habit.id)}" data-value="plus" title="Работает на меня">+</button>
          <button class="audit-btn ${state.audit[habit.id] === "minus" ? "is-minus" : ""}" data-action="audit" data-id="${esc(habit.id)}" data-value="minus" title="Тормозит">−</button>
          <button class="audit-btn ${state.audit[habit.id] === "equal" ? "is-equal" : ""}" data-action="audit" data-id="${esc(habit.id)}" data-value="equal" title="Нейтрально">=</button>
        </div>
      </div>`).join("")}
    </div>
    <div class="audit-summary">
      <span class="audit-sum plus"><b>${counts.plus}</b> работают на вас</span>
      <span class="audit-sum minus"><b>${counts.minus}</b> тормозят</span>
      <span class="audit-sum equal"><b>${counts.equal}</b> нейтральны</span>
    </div>
  </section>`;
}

function viewProgress() {
  const total = Object.values(state.logs).reduce((sum, entries) => sum + Object.keys(entries).length, 0);
  const rate = Math.round(completionRate(30) * 100);
  const compound = compounding();
  const streak = activeStreak();
  return `<div class="page">
    ${pageHead(
      "Глава 1 · сложный процент",
      "Прогресс",
      "Вы не увидите результат в первый день. Но вы увидите накопление. Смотрите на траекторию, а не на отдельную точку.",
      `<a class="btn btn-ghost" href="#book">${icon("book", 16)} Как это работает</a>`
    )}
    <section class="stat-strip stat-strip-progress">
      <div class="stat"><span class="stat-icon">${icon("clock", 18)}</span><div><strong class="stat-value">${daysInSystem()}</strong><span class="stat-label">${plural(daysInSystem(), "день", "дня", "дней")} в системе</span></div></div>
      <div class="stat"><span class="stat-icon">${icon("check", 18)}</span><div><strong class="stat-value">${total}</strong><span class="stat-label">всего действий</span></div></div>
      <div class="stat"><span class="stat-icon">${icon("flame", 18)}</span><div><strong class="stat-value">${streak}</strong><span class="stat-label">${plural(streak, "день", "дня", "дней")} в потоке</span></div></div>
      <div class="stat"><span class="stat-icon">${icon("spark", 18)}</span><div><strong class="stat-value">${Math.round(rate)}%</strong><span class="stat-label">выполнения за 30 дней</span></div></div>
    </section>
    <div class="progress-grid">
      <section class="card heatmap-card">
        ${sectionHead("Тепловая карта", `<span class="pill pill-quiet">18 недель</span>`, "Не разрывай цепочку")}
        <p class="card-lede">Каждая клетка — день. Чем больше выполненных действий, тем ярче. Пропуски видны, но они не стирают уже накопленное.</p>
        ${heatmapHTML()}
      </section>
      <section class="card compound-card">
        <p class="eyebrow">1% каждый день</p>
        <div class="compound-big">×${compound.toFixed(2)}</div>
        <p class="compound-formula">1.01<sup>${activeDayCount()}</sup> · ${activeDayCount()} ${plural(activeDayCount(), "активный день", "активных дня", "активных дней")}</p>
        <p class="card-lede">Не «стать лучше к понедельнику», а быть на 1% лучше, чем вчера. За год это ×37.</p>
        <div class="compound-track"><span style="width:${clamp((compound - 1) / 36.8, 0, 1) * 100}%"></span></div>
        <div class="compound-scale"><span>×1</span><span>×37</span></div>
      </section>
      <section class="card plateau-card">
        ${sectionHead("Плато скрытого потенциала", `<span class="pill pill-quiet">схема</span>`, "Глава 1 · главное терпение")}
        <div class="plateau-layout">
          <div class="plateau-visual">
            ${plateauChart(false)}
            <div class="plateau-legend">
              <span><i class="lg-expected"></i> ожидание</span>
              <span><i class="lg-actual"></i> реальность</span>
              <span><i class="lg-valley"></i> долина разочарования</span>
            </div>
          </div>
          <div class="plateau-copy">
            <div class="ice-cube" aria-hidden="true"><span></span></div>
            <p class="plateau-quote">«Кубик льда при 31° всё ещё твёрдый. Но это не значит, что тепло не работает».</p>
            <p>${plateauText()}</p>
            <p class="muted-small">Вы здесь: день ${daysInSystem()}. Кривая — схема, а не прогноз: она показывает форму отложенного эффекта, а не обещает конкретный результат.</p>
          </div>
        </div>
      </section>
      <section class="card bars-card">
        ${sectionHead("Последние 8 недель", "", "Ритм, а не рекорд")}
        <p class="card-lede">Процент выполненных запланированных действий. Идеальная неделя — не цель; возвращение после провала — цель.</p>
        ${weeklyBars()}
      </section>
      ${activeHabits().length ? `<section class="card perf-card">
        ${sectionHead("Привычки под микроскопом", `<span class="pill pill-quiet">30 дней</span>`, "Правило Златовласки")}
        <p class="card-lede">Слишком просто — скучно. Слишком сложно — страшно. Ищите зону, где получается примерно половина.</p>
        ${performanceRows()}
      </section>` : ""}
      ${activeHabits().length ? auditHTML() : ""}
    </div>
  </div>`;
}

/* ------------------------------------------------------------
   Экран «Из книги»
   ------------------------------------------------------------ */

function lawsStrip() {
  const laws = [
    { n: "1", title: "Очевидно", text: "Время, место, якорь", icon: "target" },
    { n: "2", title: "Привлекательно", text: "Награда и удовольствие", icon: "spark" },
    { n: "3", title: "Просто", text: "Две минуты на старт", icon: "clock" },
    { n: "4", title: "Приятно", text: "Чекин как награда", icon: "check" }
  ];
  return `<div class="laws-strip">${laws.map((law) => `<div class="law">
    <span class="law-n">${law.n}</span>
    <span class="law-icon">${icon(law.icon, 18)}</span>
    <div><strong>${law.title}</strong><small>${law.text}</small></div>
  </div>`).join("")}</div>`;
}

function viewBook() {
  return `<div class="page">
    ${pageHead(
      "16 концепций · одна система",
      "Из книги — в интерфейс",
      "Каждая механика трекера выросла из конкретной идеи «Атомных привычек». Здесь видно, откуда что взялось и где это работает.",
      `<a class="btn btn-ghost" href="#today">${icon("today", 16)} Вернуться к дню</a>`
    )}
    ${lawsStrip()}
    <div class="concept-list">
      ${CONCEPTS.map((concept, index) => `<details class="concept" ${index === 0 ? "open" : ""}>
        <summary>
          <span class="concept-num">${concept.n}</span>
          <span class="concept-emoji">${concept.emoji}</span>
          <span class="concept-title"><strong>${concept.title}</strong><small>${concept.chapter}</small></span>
          <span class="concept-chevron">${icon("chevron", 18)}</span>
        </summary>
        <div class="concept-body">
          <blockquote>${esc(concept.quote)}</blockquote>
          <p>${esc(concept.idea)}</p>
          <div class="concept-feature">
            <span>${icon("spark", 16)} Как это в трекере</span>
            <p>${esc(concept.feature)}</p>
          </div>
          <a class="text-link" href="#${concept.route}">${esc(concept.cta)} ${icon("arrow", 14)}</a>
        </div>
      </details>`).join("")}
    </div>
    <section class="book-footer">
      <div class="book-footer-mark">${atomMark(46)}</div>
      <div><h3>Вы становитесь тем, что представляют собой ваши привычки.</h3><p>Джеймс Клир, «Атомные привычки». Трекер — только зеркало. Действие — ваше.</p></div>
      <a class="btn btn-primary" href="#today">К сегодняшнему дню ${icon("arrow", 15)}</a>
    </section>
  </div>`;
}

/* ------------------------------------------------------------
   Онбординг
   ------------------------------------------------------------ */

function newDraft() {
  return { step: 1, name: "", selected: [], habits: [] };
}

function onboardingHTML() {
  const step = draft.step;
  const stepNames = ["Идентичность", "Первые действия", "Старт"];
  const content = step === 1 ? onboardingStep1() : step === 2 ? onboardingStep2() : onboardingStep3();
  const canNext = step === 1 ? draft.selected.length > 0 : step === 2 ? draft.habits.length > 0 : true;
  return `<div class="onboard">
    <aside class="onboard-art">
      <div class="art-top">
        <span class="art-brand">${atomMark(28)} <b>атом</b></span>
        <span class="art-step">${pad(step)} / 03</span>
      </div>
      <div class="art-center">
        <div class="orbit" aria-hidden="true">
          <span class="orbit-ring r1"></span>
          <span class="orbit-ring r2"></span>
          <span class="orbit-ring r3"></span>
          <span class="orbit-core"></span>
          <span class="orbit-electron e1"></span>
          <span class="orbit-electron e2"></span>
          <span class="orbit-electron e3"></span>
        </div>
        <blockquote>«Вы становитесь тем, что представляют собой ваши привычки».</blockquote>
        <p class="art-author">Джеймс Клир · «Атомные привычки»</p>
      </div>
      <div class="art-bottom">
        <div class="art-stat">1%</div>
        <p>каждый день — это <b>×37</b> за год. Небольшие изменения, грандиозный результат.</p>
      </div>
    </aside>
    <main class="onboard-panel">
      <div class="panel-top">
        <span class="step-label">${stepNames[step - 1]}</span>
        <button class="link-btn" data-action="onboard-demo">Посмотреть демо ${icon("arrow", 14)}</button>
      </div>
      <div class="panel-body">${content}</div>
      <div class="panel-foot">
        <div class="step-dots" aria-hidden="true">${[1, 2, 3].map((n) => `<span class="${n === step ? "is-active" : ""} ${n < step ? "is-done" : ""}"></span>`).join("")}</div>
        <div class="panel-buttons">
          ${step > 1 ? `<button class="btn btn-ghost" data-action="onboard-back">Назад</button>` : ""}
          ${step < 3
            ? `<button class="btn btn-primary" data-action="onboard-next" ${canNext ? "" : "disabled"}>Далее ${icon("arrow", 16)}</button>`
            : `<button class="btn btn-primary btn-lg" data-action="onboard-start">${icon("spark", 17)} Начать</button>`}
        </div>
      </div>
    </main>
  </div>`;
}

function onboardingStep1() {
  return `<div class="onboard-copy">
    <p class="eyebrow">Глава 2 · три слоя изменений</p>
    <h1>Начните не с цели.<br><em>С того, кем станете.</em></h1>
    <p class="onboard-lede">«Похудеть», «выучить язык», «больше читать» — это результаты. Они не переживут понедельник. Выберите идентичность — человека, которым хотите стать, — и привычки станут доказательствами.</p>
    <div class="identity-picker">
      ${IDENTITY_LIBRARY.map((identity) => `<button type="button" class="id-tile ${draft.selected.includes(identity.key) ? "is-selected" : ""}" data-action="onboard-toggle-id" data-key="${identity.key}" style="--id:${identity.color}" aria-pressed="${draft.selected.includes(identity.key)}">
        <span class="id-tile-emoji">${identity.emoji}</span>
        <span class="id-tile-title">${esc(identity.title)}</span>
        <span class="id-tile-check">${icon("check", 14)}</span>
      </button>`).join("")}
    </div>
    <p class="picker-hint"><span data-selected-count>${draft.selected.length}</span> из 3 · выберите одну или несколько</p>
    <label class="field field-inline">
      <span>Как вас зовут? <small>необязательно</small></span>
      <input type="text" data-onboard-name maxlength="40" placeholder="Имя для приветствия" value="${esc(draft.name)}" autocomplete="given-name">
    </label>
  </div>`;
}

function onboardingStep2() {
  const groups = draft.selected
    .map((key) => IDENTITY_LIBRARY.find((identity) => identity.key === key))
    .filter(Boolean);
  return `<div class="onboard-copy">
    <p class="eyebrow">Глава 5 · наложение привычек</p>
    <h1>Соберите первый стек.</h1>
    <p class="onboard-lede">Мы уже привязали действия к якорям — тому, что вы и так делаете. Формула проста: «После [якорь] я сделаю [привычка]». Выберите 1–3 действия на каждую идентичность.</p>
    <div class="stack-picker">
      ${groups.map((identity) => `<div class="pick-group" style="--id:${identity.color}">
        <div class="pick-group-head">
          <span class="pick-emoji">${identity.emoji}</span>
          <div><strong>${esc(identity.short)}</strong><small>${esc(identity.statement)}</small></div>
        </div>
        ${identity.habits.map((habit) => {
          const key = `${identity.key}::${habit.key}`;
          const checked = draft.habits.includes(key);
          const meta = [habit.time, habit.place].filter(Boolean).map(esc).join(" · ");
          return `<label class="habit-option ${checked ? "is-on" : ""}">
            <input type="checkbox" data-onboard-habit value="${key}" ${checked ? "checked" : ""}>
            <span class="habit-option-check">${icon("check", 13)}</span>
            <span class="habit-option-body">
              <strong>${habit.emoji} ${esc(habit.title)}</strong>
              <small>После: ${esc(habit.anchor)}${meta ? ` · ${meta}` : ""}</small>
              <em>2 мин: ${esc(habit.minVersion)}</em>
            </span>
          </label>`;
        }).join("")}
      </div>`).join("")}
    </div>
  </div>`;
}

function onboardingStep3() {
  const identities = draft.selected
    .map((key) => IDENTITY_LIBRARY.find((identity) => identity.key === key))
    .filter(Boolean);
  const habitLabels = draft.habits.map((key) => {
    const [identityKey, habitKey] = key.split("::");
    const identity = IDENTITY_LIBRARY.find((item) => item.key === identityKey);
    const habit = identity?.habits.find((item) => item.key === habitKey);
    return habit ? { habit, identity } : null;
  }).filter(Boolean);
  return `<div class="onboard-copy">
    <p class="eyebrow">Глава 16 · не разрывайте цепочку</p>
    <h1>Ваш атомный старт.</h1>
    <p class="onboard-lede">Всё готово. Одна галочка — один голос. Не нужно быть идеальным: важно не пропустить дважды.</p>
    <div class="start-summary">
      <div class="start-section">
        <span class="start-label">Идентичности</span>
        <div class="start-chips">${identities.map((identity) => `<span class="start-chip" style="--id:${identity.color}"><b>${identity.emoji}</b> ${esc(identity.short)}</span>`).join("")}</div>
      </div>
      <div class="start-section">
        <span class="start-label">Первые привычки · ${habitLabels.length}</span>
        <div class="start-habits">
          ${habitLabels.map(({ habit, identity }) => `<div class="start-habit"><span style="color:${identity.color}">${habit.emoji}</span><span>${esc(habit.title)}</span><small>${habit.time ? esc(habit.time) : "—"}</small></div>`).join("")}
        </div>
      </div>
      <div class="start-section start-date">
        <span class="start-label">Старт</span>
        <p>Сегодня, ${longDate(new Date())}. Первый чекин можно сделать сразу после настройки.</p>
      </div>
    </div>
    <div class="start-rules">
      <div><span>01</span><p><b>Ставьте галочку сразу.</b> Завершение действия — лучший стимул записать его.</p></div>
      <div><span>02</span><p><b>Не пропускайте дважды.</b> Один пропуск — случайность. Два — начало новой привычки.</p></div>
      <div><span>03</span><p><b>Смотрите на цепочку.</b> Не на вес, не на цифру, а на то, что вы не сходите с дистанции.</p></div>
    </div>
  </div>`;
}

/* ------------------------------------------------------------
   Модальные окна
   ------------------------------------------------------------ */

function modalShell(body, extraClass = "") {
  return `<div class="modal-backdrop" data-action="backdrop-close">
    <div class="modal ${extraClass}" role="dialog" aria-modal="true">
      ${body}
    </div>
  </div>`;
}

function renderModal() {
  const root = $("#modal-root");
  if (!root) return;
  if (!modalState) {
    root.innerHTML = "";
    document.body.classList.remove("modal-open");
    return;
  }
  let body = "";
  if (modalState.type === "habit") body = habitFormHTML(modalState.id);
  if (modalState.type === "identity") body = identityFormHTML(modalState.id);
  if (modalState.type === "settings") body = settingsHTML();
  if (modalState.type === "confirm") body = confirmHTML();
  if (modalState.type === "detail") body = habitDetailHTML(modalState.id);
  if (modalState.type === "library") body = libraryHTML();
  const modalClass = modalState.type === "confirm" ? "modal-sm" : modalState.type === "library" ? "modal-lg" : "";
  root.innerHTML = modalShell(body, modalClass);
  document.body.classList.add("modal-open");
  const habitForm = root.querySelector('[data-form="habit"]');
  if (habitForm) updateHabitFormControls(habitForm);
  requestAnimationFrame(() => {
    const preferred = modalState?.type === "library" ? root.querySelector(".library-card .btn") : null;
    const target = preferred || root.querySelector("[autofocus]") || root.querySelector("input:not([type=hidden]), select, textarea, button");
    target?.focus();
  });
}

function openModal(type, id = null) {
  lastFocused = document.activeElement;
  modalState = { type, id };
  renderModal();
}

function closeModal() {
  modalState = null;
  renderModal();
  if (lastFocused && document.contains(lastFocused)) lastFocused.focus();
}

function modalHead(title, subtitle = "") {
  return `<div class="modal-head">
    <div><p class="eyebrow">${subtitle}</p><h2>${title}</h2></div>
    <button class="icon-btn" data-action="close-modal" aria-label="Закрыть">${icon("close", 18)}</button>
  </div>`;
}

function habitFormHTML(id) {
  if (!state.identities.length) {
    return `${modalHead("Сначала идентичность", "Привычке нужен «владелец»")}
      <div class="modal-body"><p class="modal-text">Привычка — это голос за конкретного человека. Создайте идентичность, иначе трекер превратится в список задач.</p></div>
      <div class="modal-foot"><button class="btn btn-ghost" data-action="close-modal">Закрыть</button><button class="btn btn-primary" data-action="open-identity">${icon("plus", 16)} Создать идентичность</button></div>`;
  }
  const existing = id ? state.habits.find((habit) => habit.id === id) : null;
  const habit = existing || {
    title: "",
    emoji: "🌿",
    identityId: modalState?.identityId || state.identities[0].id,
    anchor: "",
    time: "08:00",
    place: "",
    minVersion: "",
    reward: "",
    environment: "",
    partner: "",
    stake: "",
    days: [1, 2, 3, 4, 5, 6, 7]
  };
  const identityOptions = state.identities.map((identity) => `<option value="${esc(identity.id)}" ${identity.id === habit.identityId ? "selected" : ""}>${esc(identity.emoji)} ${esc(identity.title)}</option>`).join("");
  const dayChips = [1, 2, 3, 4, 5, 6, 7].map((day) => `<label class="day-chip"><input type="checkbox" name="days" value="${day}" ${habit.days.includes(day) ? "checked" : ""}><span>${WEEKDAYS_SHORT[day - 1]}</span></label>`).join("");
  const emojiChoices = EMOJI_CHOICES.map((emoji) => `<label class="emoji-choice"><input type="radio" name="emoji" value="${emoji}" ${habit.emoji === emoji ? "checked" : ""}><span>${emoji}</span></label>`).join("");
  const advancedOpen = Boolean(habit.environment || habit.partner || habit.stake);
  return `<form data-form="habit" data-id="${esc(existing?.id || "")}">
    ${modalHead(existing ? "Изменить привычку" : "Новая привычка", "Четыре закона · одна карточка")}
    <div class="modal-body">
      <div class="preview-box" id="habit-preview"></div>
      <div class="form-grid">
        <label class="field field-wide"><span>Название привычки</span><input type="text" name="title" maxlength="80" required placeholder="Например: 10 минут прогулки" value="${esc(habit.title)}" autofocus></label>
        <label class="field field-wide"><span>Идентичность, за которую голосует привычка</span><select name="identityId">${identityOptions}</select></label>
      </div>
      <fieldset class="form-section">
        <legend><span class="law-tag">Закон 1</span> Сделайте очевидным</legend>
        <div class="form-grid">
          <label class="field field-wide"><span>После чего? <small>якорь — уже существующее действие</small></span><input type="text" name="anchor" maxlength="120" placeholder="я выпью утренний кофе" value="${esc(habit.anchor)}"></label>
          <label class="field"><span>Время</span><input type="time" name="time" value="${esc(habit.time)}"></label>
          <label class="field"><span>Место</span><input type="text" name="place" maxlength="80" placeholder="кухня" value="${esc(habit.place)}"></label>
        </div>
      </fieldset>
      <fieldset class="form-section">
        <legend><span class="law-tag">Закон 2</span> Добавьте привлекательности</legend>
        <label class="field"><span>Награда или сочетание приятного с полезным <small>что сделает момент приятнее</small></span><input type="text" name="reward" maxlength="120" placeholder="любимый подкаст во время прогулки" value="${esc(habit.reward)}"></label>
      </fieldset>
      <fieldset class="form-section">
        <legend><span class="law-tag">Закон 3</span> Упростите</legend>
        <label class="field"><span>Двухминутная версия <small>начало, которое невозможно не сделать</small></span><input type="text" name="minVersion" maxlength="140" placeholder="надеть кроссовки и выйти за дверь" value="${esc(habit.minVersion)}"></label>
        <p class="field-hint">Если день провален, кнопка «2 мин» сохранит цепочку и добавит голос.</p>
      </fieldset>
      <fieldset class="form-section">
        <legend><span class="law-tag">Закон 4</span> Привнесите удовольствие</legend>
        <div class="field"><span>Дни недели</span><div class="day-chips">${dayChips}</div></div>
        <p class="field-hint">Само отмечание — награда. Но можно добавить и внешнюю: партнёра, ставку, среду.</p>
      </fieldset>
      <details class="form-advanced" ${advancedOpen ? "open" : ""}>
        <summary>${icon("settings", 15)} Тонкая настройка: среда, партнёр, эмодзи</summary>
        <div class="form-grid">
          <label class="field field-wide"><span>Подготовка среды <small>что должно быть на виду</small></span><input type="text" name="environment" maxlength="140" placeholder="Кроссовки и форма стоят у двери" value="${esc(habit.environment)}"></label>
          <label class="field"><span>Партнёр по привычке</span><input type="text" name="partner" maxlength="60" placeholder="имя" value="${esc(habit.partner)}"></label>
          <label class="field"><span>Ставка / цена пропуска</span><input type="text" name="stake" maxlength="100" placeholder="например: 500 ₽ в фонд «прогулов»" value="${esc(habit.stake)}"></label>
        </div>
        <div class="field"><span>Эмодзи</span><div class="emoji-grid">${emojiChoices}</div></div>
      </details>
      <div class="form-error" role="alert"></div>
    </div>
    <div class="modal-foot">
      <button type="button" class="btn btn-ghost" data-action="close-modal">Отмена</button>
      <button type="submit" class="btn btn-primary">${existing ? "Сохранить" : "Создать привычку"}</button>
    </div>
  </form>`;
}

function identityFormHTML(id) {
  const existing = id ? state.identities.find((identity) => identity.id === id) : null;
  const identity = existing || { title: "", statement: "", why: "", emoji: "🌿", color: COLOR_CHOICES[0] };
  const colorChoices = COLOR_CHOICES.map((color) => `<label class="color-choice" style="--c:${color}"><input type="radio" name="color" value="${color}" ${color === identity.color ? "checked" : ""}><span></span></label>`).join("");
  const emojiChoices = EMOJI_CHOICES.map((emoji) => `<label class="emoji-choice"><input type="radio" name="emoji" value="${emoji}" ${emoji === identity.emoji ? "checked" : ""}><span>${emoji}</span></label>`).join("");
  return `<form data-form="identity" data-id="${esc(existing?.id || "")}">
    ${modalHead(existing ? "Изменить идентичность" : "Новая идентичность", "Глава 2 · кем я становлюсь")}
    <div class="modal-body">
      <label class="field"><span>Кем вы хотите стать?</span><input type="text" name="title" maxlength="90" required placeholder="Человек, который..." value="${esc(identity.title)}" autofocus></label>
      <label class="field"><span>Утверждение от первого лица</span><textarea name="statement" rows="2" maxlength="180" placeholder="Я двигаюсь каждый день и отношусь к телу как к союзнику.">${esc(identity.statement)}</textarea></label>
      <label class="field"><span>Почему это важно? <small>необязательно</small></span><textarea name="why" rows="2" maxlength="220" placeholder="Тело — единственный инструмент, который у меня есть на всю жизнь.">${esc(identity.why)}</textarea></label>
      <div class="field"><span>Эмодзи</span><div class="emoji-grid emoji-grid-sm">${emojiChoices}</div></div>
      <div class="field"><span>Цвет</span><div class="color-grid">${colorChoices}</div></div>
      <div class="form-error" role="alert"></div>
    </div>
    <div class="modal-foot">
      <button type="button" class="btn btn-ghost" data-action="close-modal">Отмена</button>
      <button type="submit" class="btn btn-primary">${existing ? "Сохранить" : "Создать"}</button>
    </div>
  </form>`;
}

function libraryHTML() {
  const existingKeys = new Set(state.identities.map((identity) => identity.key));
  const available = IDENTITY_LIBRARY.filter((identity) => !existingKeys.has(identity.key));
  return `${modalHead("Библиотека идентичностей", `${available.length} доступно · всего ${IDENTITY_LIBRARY.length}`)}
    <div class="modal-body">
      <p class="modal-text">Выберите идентичность — добавятся она сама и три привычки-доказательства. Их можно сразу отредактировать или удалить.</p>
      ${available.length
        ? `<div class="library-list">${available.map((identity) => `<article class="library-card" style="--id:${identity.color}">
          <div class="library-card-head">
            <span class="library-emoji">${identity.emoji}</span>
            <div class="library-title">
              <h3>${esc(identity.title)}</h3>
              <p>${esc(identity.statement)}</p>
            </div>
            <button class="btn btn-soft btn-sm" data-action="add-library" data-key="${esc(identity.key)}">${icon("plus", 14)} Добавить</button>
          </div>
          <div class="library-habits">${identity.habits.map((habit) => `<span>${habit.emoji} ${esc(habit.title)}</span>`).join("")}</div>
        </article>`).join("")}</div>`
        : `<div class="empty" style="padding:24px"><h3>Все шаблоны уже здесь</h3><p>В библиотеке не осталось идентичностей, которых нет в вашем трекере.</p></div>`}
    </div>
    <div class="modal-foot"><button class="btn btn-ghost" data-action="close-modal">Закрыть</button></div>`;
}

function addLibraryIdentity(key) {
  const template = IDENTITY_LIBRARY.find((identity) => identity.key === key);
  if (!template) return;
  if (state.identities.some((identity) => identity.key === key)) {
    toast("Эта идентичность уже добавлена.", "info");
    return;
  }
  const identity = {
    id: uid("id"),
    key: template.key,
    title: template.title,
    short: template.short,
    statement: template.statement,
    why: template.why,
    emoji: template.emoji,
    color: template.color
  };
  state.identities.push(identity);
  const habits = template.habits.map((habit) => ({
    id: uid("h"),
    title: habit.title,
    emoji: habit.emoji,
    identityId: identity.id,
    anchor: habit.anchor,
    time: habit.time,
    place: habit.place,
    minVersion: habit.minVersion,
    reward: habit.reward,
    environment: habit.environment,
    partner: "",
    stake: "",
    days: [...habit.days],
    createdAt: dateKey(),
    archived: false
  }));
  state.habits.push(...habits);
  if (!state.profile.focusIdentityId) state.profile.focusIdentityId = identity.id;
  saveState();
  closeModal();
  render();
  toast(`«${identity.title}» и ${habits.length} ${plural(habits.length, "привычка", "привычки", "привычек")} добавлены.`, "identity");
}

function openLibrary() {
  modalState = { type: "library" };
  lastFocused = document.activeElement;
  renderModal();
}

function habitDetailHTML(id) {
  const habit = state.habits.find((item) => item.id === id);
  if (!habit) return `<div class="modal-body"><p>Привычка не найдена.</p></div>`;
  const identity = identityById(habit.identityId);
  const stats = habitStats(habit);
  return `${modalHead(esc(habit.title), identity ? esc(identity.title) : "Без идентичности")}
    <div class="modal-body">
      <div class="detail-hero" style="--hc:${identityColor(habit.identityId)}">
        <span class="detail-emoji">${esc(habit.emoji)}</span>
        <div><p class="cue">${cueLine(habit)}</p><p class="detail-days">${habit.days.map((d) => WEEKDAYS_SHORT[d - 1]).join(" · ")}</p></div>
      </div>
      <div class="detail-stats">
        <div><strong>${stats.streak}</strong><span>серия</span></div>
        <div><strong>${stats.opportunities ? Math.round(stats.rate * 100) : 0}%</strong><span>30 дней</span></div>
        <div><strong>${stats.total}</strong><span>всего</span></div>
      </div>
      <dl class="detail-list">
        <div><dt>Правило двух минут</dt><dd>${esc(habit.minVersion || "—")}</dd></div>
        ${habit.reward ? `<div><dt>Награда</dt><dd>${esc(habit.reward)}</dd></div>` : ""}
        ${habit.environment ? `<div><dt>Среда</dt><dd>${esc(habit.environment)}</dd></div>` : ""}
        ${habit.partner ? `<div><dt>Партнёр</dt><dd>${esc(habit.partner)}</dd></div>` : ""}
        ${habit.stake ? `<div><dt>Ставка</dt><dd>${esc(habit.stake)}</dd></div>` : ""}
      </dl>
      <p class="detail-hint">${icon("spark", 14)} ${habitMissRun(habit) >= 2 ? "Два пропуска подряд. Вернитесь через двухминутную версию — это важнее идеального возвращения." : "Одна галочка — один голос. Не идеальность, а присутствие."}</p>
    </div>
    <div class="modal-foot modal-foot-split">
      <div>
        <button class="btn btn-ghost btn-sm" data-action="edit-habit" data-id="${esc(habit.id)}">${icon("edit", 14)} Изменить</button>
        <button class="btn btn-ghost btn-sm" data-action="archive-habit" data-id="${esc(habit.id)}">${icon("archive", 14)} В архив</button>
      </div>
      <button class="btn btn-danger btn-sm" data-action="delete-habit" data-id="${esc(habit.id)}">${icon("trash", 14)} Удалить</button>
    </div>`;
}

function confirmHTML() {
  return `${modalHead(modalState.title || "Вы уверены?")}
    <div class="modal-body"><p class="modal-text">${modalState.text || ""}</p></div>
    <div class="modal-foot">
      <button class="btn btn-ghost" data-action="close-modal">Отмена</button>
      <button class="btn ${modalState.danger ? "btn-danger" : "btn-primary"}" data-action="confirm-run">${modalState.confirmLabel || "Подтвердить"}</button>
    </div>`;
}

function settingsHTML() {
  const name = state.profile.name;
  const theme = state.settings.theme;
  return `<form data-form="settings">
    ${modalHead("Настройки", "Данные хранятся только в этом браузере")}
    <div class="modal-body">
      <label class="field"><span>Имя</span><input type="text" name="name" maxlength="40" value="${esc(name)}" placeholder="Как к вам обращаться" autofocus></label>
      <div class="field"><span>Тема</span>
        <div class="segmented theme-seg">
          <label><input type="radio" name="theme" value="light" ${theme === "light" ? "checked" : ""}><span>${icon("sun", 15)} Светлая</span></label>
          <label><input type="radio" name="theme" value="dark" ${theme === "dark" ? "checked" : ""}><span>${icon("moon", 15)} Тёмная</span></label>
        </div>
      </div>
      <div class="settings-block">
        <h3>Данные</h3>
        <div class="settings-actions">
          <button type="button" class="btn btn-soft btn-sm" data-action="export">${icon("download", 15)} Скачать JSON</button>
          <label class="btn btn-soft btn-sm file-btn">${icon("restore", 15)} Загрузить JSON<input type="file" id="import-file" accept="application/json,.json"></label>
          <button type="button" class="btn btn-ghost btn-sm" data-action="load-demo">${icon("spark", 15)} Демо-данные</button>
          <button type="button" class="btn btn-danger btn-sm" data-action="reset-all">${icon("trash", 15)} Сбросить всё</button>
        </div>
        <p class="field-hint">Экспорт полезен как резервная копия. Импорт заменит текущие данные.</p>
      </div>
      <div class="settings-about">
        <span>${atomMark(30)}</span>
        <p><b>АТОМ</b> · трекер привычек по книге Джеймса Клира «Атомные привычки». Версия ${APP_VERSION}.<br>Не заменяет книгу — помогает применить её каждый день.</p>
      </div>
    </div>
    <div class="modal-foot">
      <button type="button" class="btn btn-ghost" data-action="close-modal">Закрыть</button>
      <button type="submit" class="btn btn-primary">Сохранить</button>
    </div>
  </form>`;
}

/* ------------------------------------------------------------
   Действия
   ------------------------------------------------------------ */

function openHabit(id = null, identityId = null) {
  if (!state.identities.length) {
    toast("Сначала создайте идентичность", "error");
    openModal("identity");
    return;
  }
  modalState = { type: "habit", id, identityId };
  lastFocused = document.activeElement;
  renderModal();
}

function openIdentity(id = null) {
  modalState = { type: "identity", id };
  lastFocused = document.activeElement;
  renderModal();
}

function openConfirm(options) {
  modalState = { type: "confirm", ...options };
  renderModal();
}

function closeModalAndRender() {
  closeModal();
  render();
}

function checkHabit(habitId, mode) {
  const habit = state.habits.find((item) => item.id === habitId);
  if (!habit) return;
  const key = dateKey();
  const current = getEntry(key, habitId);
  let next = mode;
  if (current === mode) next = null;
  if (current === "min" && mode === "full") next = "full";
  if (current === "full" && mode === "min") return;
  const wasDone = Boolean(current);
  const upgraded = current === "min" && next === "full";
  const anchorButton = Array.from(document.querySelectorAll('[data-action="check-full"]')).find((button) => button.dataset.id === habitId);
  const rect = anchorButton?.getBoundingClientRect();
  setEntry(key, habitId, next);
  saveState();
  const identity = identityById(habit.identityId);
  const after = todayStats();
  const allDone = after.list.length > 0 && after.done === after.total;
  render();
  if (rect) {
    const label = next ? (wasDone ? "✓" : "+1") : "−1";
    spawnVote(rect.left + rect.width / 2, rect.top + rect.height / 2, identityColor(habit.identityId), label);
  }
  if (next) {
    const streak = habitStreak(habit);
    if (allDone) {
      toast("Идеальный день. Все голоса собраны.", "spark");
      celebrate();
    } else if (upgraded) {
      toast("Полная версия засчитана. Голос уже был — теперь он весомее.", "check");
    } else if (next === "min") {
      toast(`Минимум засчитан. Цепочка «${habit.title}» жива.`, "clock");
    } else if (streak > 1) {
      toast(`+1 голос за «${identity?.short || "идентичность"}». Серия: ${streak} ${plural(streak, "день", "дня", "дней")}.`, "check");
    } else {
      toast(`+1 голос за «${identity?.short || "идентичность"}». Начало положено.`, "check");
    }
  }
}

function saveHabitForm(form) {
  const data = new FormData(form);
  const title = String(data.get("title") || "").trim();
  const identityId = String(data.get("identityId") || "");
  const days = $$('input[name="days"]:checked', form).map((input) => Number(input.value));
  const errorBox = $(".form-error", form);
  const setError = (text) => {
    if (errorBox) errorBox.textContent = text;
    toast(text, "error");
  };
  if (!title) return setError("Дайте привычке название.");
  if (!state.identities.some((identity) => identity.id === identityId)) return setError("Выберите идентичность.");
  if (!days.length) return setError("Выберите хотя бы один день недели.");
  const id = form.dataset.id;
  const existing = id ? state.habits.find((habit) => habit.id === id) : null;
  const habit = {
    id: existing?.id || uid("h"),
    title,
    emoji: String(data.get("emoji") || "🌿"),
    identityId,
    anchor: String(data.get("anchor") || "").trim(),
    time: String(data.get("time") || ""),
    place: String(data.get("place") || "").trim(),
    minVersion: String(data.get("minVersion") || "").trim() || "сделать один маленький шаг",
    reward: String(data.get("reward") || "").trim(),
    environment: String(data.get("environment") || "").trim(),
    partner: String(data.get("partner") || "").trim(),
    stake: String(data.get("stake") || "").trim(),
    days,
    createdAt: existing?.createdAt || dateKey(),
    archived: existing?.archived || false
  };
  if (existing) Object.assign(existing, habit);
  else state.habits.push(habit);
  saveState();
  closeModal();
  render();
  toast(existing ? "Привычка обновлена." : "Привычка создана. Первый голос — за вами.", "check");
}

function saveIdentityForm(form) {
  const data = new FormData(form);
  const title = String(data.get("title") || "").trim();
  if (!title) {
    toast("Опишите, кем хотите стать.", "error");
    return;
  }
  const id = form.dataset.id;
  const existing = id ? state.identities.find((identity) => identity.id === id) : null;
  const derivedShort = title.replace(/^Человек,\s*который\s*/i, "").trim();
  const generatedShort = (derivedShort.charAt(0).toUpperCase() + derivedShort.slice(1)).slice(0, 42) || title;
  const short = existing && existing.title === title ? existing.short : generatedShort;
  const identity = {
    id: existing?.id || uid("id"),
    key: existing?.key || "custom",
    title,
    short,
    statement: String(data.get("statement") || "").trim() || `Я — ${title.toLowerCase()}.`,
    why: String(data.get("why") || "").trim(),
    emoji: String(data.get("emoji") || "🌿"),
    color: safeColor(String(data.get("color") || COLOR_CHOICES[0]))
  };
  if (existing) Object.assign(existing, identity);
  else state.identities.push(identity);
  if (!state.profile.focusIdentityId) state.profile.focusIdentityId = identity.id;
  saveState();
  closeModal();
  render();
  toast(existing ? "Идентичность обновлена." : "Идентичность создана. Теперь — доказательства.", "identity");
}

function saveSettings(form) {
  const data = new FormData(form);
  state.profile.name = String(data.get("name") || "").trim();
  state.settings.theme = safeTheme(String(data.get("theme") || "light"));
  saveState();
  closeModal();
  applyTheme();
  render();
  toast("Настройки сохранены.", "check");
}

function applyTheme() {
  document.documentElement.dataset.theme = safeTheme(state?.settings?.theme);
}

function updateHabitPreview(form) {
  const preview = $("#habit-preview", form);
  if (!preview) return;
  const title = form.querySelector('[name="title"]')?.value.trim() || "новая привычка";
  const anchor = form.querySelector('[name="anchor"]')?.value.trim();
  const time = form.querySelector('[name="time"]')?.value;
  const place = form.querySelector('[name="place"]')?.value.trim();
  const min = form.querySelector('[name="minVersion"]')?.value.trim() || "один маленький шаг";
  const identityId = form.querySelector('[name="identityId"]')?.value;
  const identity = identityById(identityId);
  preview.style.setProperty("--hc", identityColor(identityId));
  preview.innerHTML = `
    <div class="preview-main">
      <span class="preview-emoji">${esc(form.querySelector('[name="emoji"]:checked')?.value || "🌿")}</span>
      <div>
        <strong>${esc(title)}</strong>
        <p>${anchor ? `После: ${esc(anchor)}` : "Без якоря"}${time ? ` · ${esc(time)}` : ""}${place ? ` · ${esc(place)}` : ""}</p>
      </div>
    </div>
    <div class="preview-min">2 мин: ${esc(min)}</div>
    <div class="preview-id">${identity ? `${esc(identity.emoji)} голос за «${esc(identity.short)}»` : "Выберите идентичность"}</div>`;
}

function updateHabitFormControls(form) {
  const identityId = form.querySelector('[name="identityId"]')?.value;
  form.style.setProperty("--hc", identityColor(identityId));
  $$(".day-chip", form).forEach((chip) => {
    const input = chip.querySelector("input");
    chip.classList.toggle("is-on", Boolean(input?.checked));
  });
  $$(".emoji-choice", form).forEach((choice) => {
    const input = choice.querySelector("input");
    choice.classList.toggle("is-on", Boolean(input?.checked));
  });
  updateHabitPreview(form);
}

function updateOnboardStep1UI() {
  $$(".id-tile").forEach((tile) => {
    const selected = draft.selected.includes(tile.dataset.key);
    tile.classList.toggle("is-selected", selected);
    tile.setAttribute("aria-pressed", String(selected));
  });
  const count = $("[data-selected-count]");
  if (count) count.textContent = String(draft.selected.length);
  const next = $('[data-action="onboard-next"]');
  if (next) next.disabled = draft.selected.length === 0;
}

function updateOnboardStep2UI() {
  $$(".habit-option").forEach((option) => {
    const input = option.querySelector("input");
    option.classList.toggle("is-on", Boolean(input?.checked));
  });
  const next = $('[data-action="onboard-next"]');
  if (next) next.disabled = draft.habits.length === 0;
}

function toggleIdentity(key) {
  const index = draft.selected.indexOf(key);
  if (index >= 0) {
    draft.selected.splice(index, 1);
    draft.habits = draft.habits.filter((habitKey) => !habitKey.startsWith(`${key}::`));
  } else {
    if (draft.selected.length >= 3) {
      toast("Можно выбрать не больше трёх идентичностей. Начните с главного.", "info");
      return;
    }
    draft.selected.push(key);
    const template = IDENTITY_LIBRARY.find((identity) => identity.key === key);
    template?.habits.slice(0, 2).forEach((habit) => {
      const habitKey = `${key}::${habit.key}`;
      if (!draft.habits.includes(habitKey)) draft.habits.push(habitKey);
    });
  }
  updateOnboardStep1UI();
  const picker = $(".identity-picker");
  if (picker) picker.classList.toggle("has-three", draft.selected.length >= 3);
}

function finishOnboarding() {
  const identities = draft.selected.map((key) => {
    const template = IDENTITY_LIBRARY.find((identity) => identity.key === key);
    return {
      id: uid("id"),
      key: template.key,
      title: template.title,
      short: template.short,
      statement: template.statement,
      why: template.why,
      emoji: template.emoji,
      color: template.color
    };
  });
  const habits = draft.habits.map((habitKey) => {
    const [identityKey, key] = habitKey.split("::");
    const identity = identities.find((item) => item.key === identityKey);
    const template = IDENTITY_LIBRARY.find((item) => item.key === identityKey)?.habits.find((item) => item.key === key);
    if (!identity || !template) return null;
    return {
      id: uid("h"),
      title: template.title,
      emoji: template.emoji,
      identityId: identity.id,
      anchor: template.anchor,
      time: template.time,
      place: template.place,
      minVersion: template.minVersion,
      reward: template.reward,
      environment: template.environment,
      partner: "",
      stake: "",
      days: [...template.days],
      createdAt: dateKey(),
      archived: false
    };
  }).filter(Boolean);
  state = {
    version: APP_VERSION,
    onboarded: true,
    isDemo: false,
    createdAt: dateKey(),
    profile: { name: draft.name.trim(), focusIdentityId: identities[0]?.id || null },
    identities,
    habits,
    logs: {},
    audit: {},
    settings: { theme: "light", hideDemoBanner: false }
  };
  saveState();
  draft = null;
  currentRoute = "today";
  if (location.hash !== "#today") location.hash = "#today";
  render();
  toast("Добро пожаловать. Один голос уже возможен — просто сделайте первый шаг.", "spark");
  celebrate();
}

function loadDemo() {
  state = buildDemoState();
  saveState();
  draft = null;
  currentRoute = "today";
  if (location.hash !== "#today") location.hash = "#today";
  closeModal();
  render();
  toast("Демо загружено: 50 дней истории. Осмотритесь и начните своё.", "spark");
}

function startFresh() {
  openConfirm({
    title: "Начать с чистого листа?",
    text: "Демо-данные и все отметки будут удалены. Это действие нельзя отменить.",
    confirmLabel: "Удалить и начать",
    danger: true,
    action: "reset-all"
  });
}

function resetAll() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (error) {
    console.warn(error);
  }
  state = blankState();
  draft = newDraft();
  modalState = null;
  currentRoute = "today";
  try {
    if (location.hash) history.replaceState(null, "", location.pathname + location.search);
  } catch (error) {
    console.warn("Не удалось очистить адрес:", error);
  }
  applyTheme();
  render();
  toast("Чистый лист. Выберите идентичность — и начнём.", "spark");
}

function deleteHabit(id) {
  openConfirm({
    title: "Удалить привычку?",
    text: "Вместе с ней удалится история отметок. Если хотите сохранить историю, используйте архив.",
    confirmLabel: "Удалить",
    danger: true,
    action: "delete-habit",
    id
  });
}

function runConfirm() {
  const action = modalState?.action;
  const id = modalState?.id;
  if (action === "reset-all") {
    modalState = null;
    renderModal();
    resetAll();
    return;
  }
  if (action === "delete-habit") {
    state.habits = state.habits.filter((habit) => habit.id !== id);
    delete state.audit[id];
    Object.keys(state.logs).forEach((key) => {
      if (state.logs[key]?.[id]) {
        delete state.logs[key][id];
        if (!Object.keys(state.logs[key]).length) delete state.logs[key];
      }
    });
    saveState();
    closeModal();
    render();
    toast("Привычка удалена.", "trash");
    return;
  }
  if (action === "delete-identity") {
    state.identities = state.identities.filter((identity) => identity.id !== id);
    if (state.profile.focusIdentityId === id) state.profile.focusIdentityId = state.identities[0]?.id || null;
    saveState();
    closeModal();
    render();
    toast("Идентичность удалена.", "trash");
    return;
  }
  if (action === "load-demo") {
    loadDemo();
  }
}

function archiveHabit(id) {
  const habit = state.habits.find((item) => item.id === id);
  if (!habit) return;
  habit.archived = true;
  saveState();
  closeModal();
  render();
  toast("Привычка в архиве. История сохранена.", "archive");
}

function restoreHabit(id) {
  const habit = state.habits.find((item) => item.id === id);
  if (!habit) return;
  habit.archived = false;
  saveState();
  render();
  toast("Привычка возвращена.", "restore");
}

function deleteIdentity(id) {
  const linked = state.habits.filter((habit) => habit.identityId === id);
  if (linked.length) {
    toast(`Сначала перенесите или удалите ${linked.length} ${plural(linked.length, "привычку", "привычки", "привычек")} этой идентичности.`, "error");
    return;
  }
  openConfirm({
    title: "Удалить идентичность?",
    text: "Она исчезнет из трекера. Связанных привычек нет, так что история не пострадает.",
    confirmLabel: "Удалить",
    danger: true,
    action: "delete-identity",
    id
  });
}

function setAudit(id, value) {
  if (state.audit[id] === value) delete state.audit[id];
  else state.audit[id] = value;
  saveState();
  render();
}

/* ------------------------------------------------------------
   Тосты, голоса, конфетти
   ------------------------------------------------------------ */

function toast(message, type = "info") {
  const root = $("#toast-root");
  if (!root) return;
  const iconName = type === "check" ? "check" : type === "spark" ? "spark" : type === "error" ? "close" : type === "clock" ? "clock" : type === "identity" ? "identity" : type === "trash" ? "trash" : type === "archive" ? "archive" : type === "restore" ? "restore" : "spark";
  root.innerHTML = `<div class="toast toast-${type}">${icon(iconName, 17)}<span>${esc(message)}</span></div>`;
  root.classList.add("is-visible");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => root.classList.remove("is-visible"), 3200);
}

function spawnVote(x, y, color, label) {
  const el = document.createElement("span");
  el.className = "vote-pop";
  el.textContent = label;
  el.style.left = `${x}px`;
  el.style.top = `${y}px`;
  el.style.color = color;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 900);
}

function celebrate() {
  const root = $("#confetti-root");
  if (!root) return;
  const colors = ["#C94B27", "#3F6B57", "#3E4E86", "#B8892F", "#9E4353"];
  for (let i = 0; i < 28; i += 1) {
    const span = document.createElement("span");
    span.className = "confetti";
    span.style.left = `${45 + Math.random() * 10}%`;
    span.style.background = colors[i % colors.length];
    span.style.setProperty("--dx", `${(Math.random() - 0.5) * 420}px`);
    span.style.setProperty("--dy", `${120 + Math.random() * 320}px`);
    span.style.setProperty("--rot", `${Math.random() * 720 - 360}deg`);
    span.style.animationDelay = `${Math.random() * 120}ms`;
    root.appendChild(span);
    setTimeout(() => span.remove(), 1600);
  }
}

/* ------------------------------------------------------------
   Демо-данные
   ------------------------------------------------------------ */

function buildDemoState() {
  const today = new Date();
  const createdAt = dateKey(addDays(today, -50));
  const identities = [];
  const demoHabits = [];

  const chosen = [
    { key: "healthy", habits: ["walk", "workout", "sleep"] },
    { key: "learner", habits: ["read", "english"] },
    { key: "calm", habits: ["meditate", "gratitude"] }
  ];

  chosen.forEach(({ key, habits }) => {
    const template = IDENTITY_LIBRARY.find((identity) => identity.key === key);
    const identity = {
      id: uid("id"),
      key: template.key,
      title: template.title,
      short: template.short,
      statement: template.statement,
      why: template.why,
      emoji: template.emoji,
      color: template.color
    };
    identities.push(identity);
    habits.forEach((habitKey) => {
      const habitTemplate = template.habits.find((item) => item.key === habitKey);
      demoHabits.push({
        id: uid("h"),
        title: habitTemplate.title,
        emoji: habitTemplate.emoji,
        identityId: identity.id,
        anchor: habitTemplate.anchor,
        time: habitTemplate.time,
        place: habitTemplate.place,
        minVersion: habitTemplate.minVersion,
        reward: habitTemplate.reward,
        environment: habitTemplate.environment,
        partner: habitKey === "walk" ? "Аня" : "",
        stake: habitKey === "english" ? "100 ₽ в копилку «прогулов»" : "",
        days: [...habitTemplate.days],
        createdAt,
        archived: false
      });
    });
  });

  const probabilities = { walk: 0.82, workout: 0.55, sleep: 0.7, read: 0.8, english: 0.62, meditate: 0.64, gratitude: 0.52 };
  const rng = mulberry32(DEMO_LOG_SEED);
  const logs = {};

  for (let i = 50; i >= 1; i -= 1) {
    const date = addDays(today, -i);
    const key = dateKey(date);
    demoHabits.forEach((habit) => {
      if (!scheduledOn(habit, date)) return;
      const templateKey = habit.title;
      const base = probabilities[
        templateKey.includes("прогул") ? "walk" :
        templateKey.includes("Тренировка") ? "workout" :
        templateKey.includes("Сон") ? "sleep" :
        templateKey.includes("Читать") ? "read" :
        templateKey.includes("английского") ? "english" :
        templateKey.includes("Медитация") ? "meditate" : "gratitude"
      ] ?? 0.6;

      if (templateKey.includes("английского") && i <= 4) return;
      if (templateKey.includes("Медитация") && i === 1) return;
      if (templateKey.includes("Тренировка") && (i === 12 || i === 13)) return;

      const roll = rng();
      if (roll < base) {
        logs[key] = logs[key] || {};
        logs[key][habit.id] = "full";
      } else if (roll < base + 0.1) {
        logs[key] = logs[key] || {};
        logs[key][habit.id] = "min";
      }
    });
  }

  const todayKey = dateKey(today);
  logs[todayKey] = logs[todayKey] || {};
  demoHabits.forEach((habit) => {
    if (habit.title.includes("прогул") || habit.title.includes("Читать")) {
      logs[todayKey][habit.id] = "full";
    }
  });

  return {
    version: APP_VERSION,
    onboarded: true,
    isDemo: true,
    createdAt,
    profile: { name: "Алекс", focusIdentityId: identities[0].id },
    identities,
    habits: demoHabits,
    logs,
    audit: {
      [demoHabits[0].id]: "plus",
      [demoHabits[3].id]: "plus",
      [demoHabits[4].id]: "equal"
    },
    settings: { theme: "light", hideDemoBanner: false }
  };
}

/* ------------------------------------------------------------
   Роутинг и рендер
   ------------------------------------------------------------ */

function routeFromHash() {
  const hash = location.hash.replace("#", "");
  return ["today", "habits", "identity", "progress", "book"].includes(hash) ? hash : "today";
}

function renderView() {
  const view = $("#view");
  if (!view) return;
  const map = { today: viewToday, habits: viewHabits, identity: viewIdentity, progress: viewProgress, book: viewBook };
  view.innerHTML = demoBanner() + (map[currentRoute] || viewToday)();
}

function render() {
  const app = $("#app");
  if (!app) return;
  applyTheme();
  if (!state || !state.onboarded) {
    app.className = "app app-onboarding";
    app.innerHTML = onboardingHTML();
    const nameInput = $("[data-onboard-name]");
    if (nameInput && document.activeElement !== nameInput) {
      // не перехватываем фокус при каждом рендере
    }
    return;
  }
  app.className = "app";
  app.innerHTML = shellHTML();
  renderView();
}

/* ------------------------------------------------------------
   События
   ------------------------------------------------------------ */

function handleAction(action, target, event) {
  switch (action) {
    case "backdrop-close":
      if (event.target === target) closeModal();
      break;
    case "close-modal":
      closeModal();
      break;
    case "open-habit":
      openHabit(null, target.dataset.identity || null);
      break;
    case "edit-habit":
      closeModal();
      openHabit(target.dataset.id);
      break;
    case "habit-more":
      openModal("detail", target.dataset.id);
      break;
    case "check-full":
      checkHabit(target.dataset.id, "full");
      break;
    case "check-min":
      checkHabit(target.dataset.id, "min");
      break;
    case "open-identity":
      closeModal();
      openIdentity();
      break;
    case "open-library":
      openLibrary();
      break;
    case "add-library":
      addLibraryIdentity(target.dataset.key);
      break;
    case "edit-identity":
      openIdentity(target.dataset.id);
      break;
    case "focus-identity":
      state.profile.focusIdentityId = target.dataset.id;
      saveState();
      render();
      toast("Фокусная идентичность обновлена.", "identity");
      break;
    case "delete-identity":
      deleteIdentity(target.dataset.id);
      break;
    case "delete-habit":
      deleteHabit(target.dataset.id);
      break;
    case "archive-habit":
      archiveHabit(target.dataset.id);
      break;
    case "restore-habit":
      restoreHabit(target.dataset.id);
      break;
    case "open-settings":
      openModal("settings");
      break;
    case "toggle-theme":
      state.settings.theme = state.settings.theme === "dark" ? "light" : "dark";
      saveState();
      render();
      break;
    case "export":
      exportData();
      break;
    case "load-demo":
      openConfirm({
        title: "Загрузить демо?",
        text: "Текущие данные будут заменены демонстрационными. Сначала можно скачать резервную копию.",
        confirmLabel: "Загрузить демо",
        action: "load-demo"
      });
      break;
    case "reset-all":
      startFresh();
      break;
    case "confirm-run":
      runConfirm();
      break;
    case "start-fresh":
      startFresh();
      break;
    case "dismiss-demo":
      state.settings.hideDemoBanner = true;
      saveState();
      render();
      break;
    case "audit":
      setAudit(target.dataset.id, target.dataset.value);
      break;
    case "onboard-toggle-id":
      toggleIdentity(target.dataset.key);
      break;
    case "onboard-next":
      if (draft.step === 1 && !draft.selected.length) return;
      if (draft.step === 2 && !draft.habits.length) return;
      draft.step += 1;
      render();
      break;
    case "onboard-back":
      draft.step = Math.max(1, draft.step - 1);
      render();
      break;
    case "onboard-start":
      finishOnboarding();
      break;
    case "onboard-demo":
      loadDemo();
      break;
    default:
      break;
  }
}

function handleClick(event) {
  const target = event.target.closest("[data-action]");
  if (!target) return;
  const action = target.dataset.action;
  if (action === "onboard-next" && target.disabled) return;
  if (action === "onboard-start" && target.disabled) return;
  handleAction(action, target, event);
}

function handleInput(event) {
  const el = event.target;
  if (el.matches("[data-onboard-name]")) {
    draft.name = el.value;
    return;
  }
  if (el.matches("[data-onboard-habit]")) {
    const key = el.value;
    if (el.checked) {
      if (!draft.habits.includes(key)) draft.habits.push(key);
    } else {
      draft.habits = draft.habits.filter((item) => item !== key);
    }
    updateOnboardStep2UI();
    return;
  }
  if (el.closest('[data-form="habit"]')) {
    const form = el.closest('[data-form="habit"]');
    if (el.type === "checkbox" || el.type === "radio") {
      updateHabitFormControls(form);
    } else {
      updateHabitPreview(form);
    }
  }
}

function handleSubmit(event) {
  const form = event.target.closest("[data-form]");
  if (!form) return;
  event.preventDefault();
  if (form.dataset.form === "habit") saveHabitForm(form);
  if (form.dataset.form === "identity") saveIdentityForm(form);
  if (form.dataset.form === "settings") saveSettings(form);
}

function handleChange(event) {
  const el = event.target;
  if (el.matches("[data-onboard-habit]")) {
    const key = el.value;
    if (el.checked) {
      if (!draft.habits.includes(key)) draft.habits.push(key);
    } else {
      draft.habits = draft.habits.filter((item) => item !== key);
    }
    el.closest(".habit-option")?.classList.toggle("is-on", el.checked);
    updateOnboardStep2UI();
  }
  if (el.id === "import-file" && el.files?.[0]) {
    importFile(el.files[0]);
  }
}

function handleKeydown(event) {
  if (event.key === "Escape" && modalState) {
    closeModal();
  }
}

function exportData() {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `atom-habits-${dateKey()}.json`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  toast("Файл с данными скачан.", "download");
}

function importFile(file) {
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const parsed = JSON.parse(String(reader.result || ""));
      const next = normalizeState(parsed);
      if (!next) throw new Error("Неверный формат");
      state = next;
      saveState();
      closeModal();
      currentRoute = "today";
      if (location.hash !== "#today") location.hash = "#today";
      render();
      toast("Данные загружены.", "check");
    } catch (error) {
      console.error(error);
      toast("Не удалось прочитать файл. Нужен JSON, созданный этим трекером.", "error");
    }
  };
  reader.readAsText(file);
}

/* ------------------------------------------------------------
   Инициализация
   ------------------------------------------------------------ */

function init() {
  state = loadState();
  if (!state) {
    const params = new URLSearchParams(location.search);
    if (params.get("demo") === "1") {
      state = buildDemoState();
      saveState();
    }
  }
  if (!state || !state.onboarded) {
    state = state || blankState();
    draft = newDraft();
    currentRoute = "today";
  } else {
    currentRoute = routeFromHash();
  }
  applyTheme();
  render();
  document.addEventListener("click", handleClick);
  document.addEventListener("input", handleInput);
  document.addEventListener("change", handleChange);
  document.addEventListener("submit", handleSubmit);
  document.addEventListener("keydown", handleKeydown);
  window.addEventListener("hashchange", () => {
    if (modalState) {
      modalState = null;
      renderModal();
    }
    currentRoute = routeFromHash();
    render();
    window.scrollTo({ top: 0, behavior: "instant" });
  });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
