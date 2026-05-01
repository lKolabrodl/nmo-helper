/**
 * Клиентская логика отправки баг-репорта на {@link BUG_REPORT_ENDPOINT}.
 *
 * Кулдаун, дневной лимит и дедупликация зеркалируются на сервере — клиентские
 * проверки нужны только для UX (показать подсказку вместо кнопки), истина на
 * сервере. Значения лимитов подобраны под серверные: 5 мин между отправками,
 * 5 отчётов в сутки, дедуп на 7 дней.
 *
 * @module api/bug-report
 */

import { storageGet, storageSet } from './storage';
import { fetchViaBackground } from './fetch';
import { BUG_REPORT_ENDPOINT, BUG_REPORT_STORAGE_KEY } from '../utils/constants';

/** Минимальный интервал между двумя отправками с одного устройства (мс) */
const COOLDOWN_MS = 5 * 60 * 1000;
/** Максимум отчётов за скользящие 24 часа */
const DAILY_CAP = 5;
/** Окно «сегодня» для дневного лимита */
const DAY_MS = 24 * 60 * 60 * 1000;
/** Время жизни отпечатка в `sent` — сколько дедуп помнит отправленные отчёты */
const DEDUP_TTL_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Тело POST-запроса на сервер.
 * Повторяет контракт с `/opt/nmo-feedback/server.py::_handle_bug_report`.
 */
export interface IBugReportPayload {
	/** URL страницы-источника ответов (rosmedicinfo.ru / 24forcare.com) */
	readonly activeUrl: string;
	/** Ключ источника: `rosmedicinfo` / `24forcare` / '' если не определён */
	readonly source: string;
	/** Тема теста как отображается у пользователя */
	readonly topic: string;
	/** Текст текущего вопроса (plain-text) */
	readonly question: string;
	/** innerHTML блока вопроса — для диагностики парсинга спец-символов/разметки */
	readonly questionHtml: string;
	/** Тексты всех вариантов ответа на странице НМО */
	readonly variants: string[];
	/** Версия расширения из manifest.json */
	readonly extVersion: string;
	/** `navigator.userAgent` — для повторения бага в том же браузере */
	readonly userAgent: string;
	/** Свободный текст от пользователя (необязательно). Лимит на сервере — 2000 символов. */
	readonly message?: string;
}

/**
 * Состояние клиентских лимитов в chrome.storage.local по ключу {@link BUG_REPORT_STORAGE_KEY}.
 * Используется только для UX — сервер повторно проверяет всё у себя.
 */
interface IBugReportState {
	/** `fingerprint → ts отправки`. TTL = {@link DEDUP_TTL_MS}, старые чистятся в {@link prune} */
	readonly sent: Record<string, number>;
	/** Таймстемпы успешных отправок за последние 24 часа — для {@link DAILY_CAP} */
	readonly history: number[];
	/** Время последней отправки — для кулдауна {@link COOLDOWN_MS} */
	readonly lastSentAt: number;
}

const EMPTY_STATE: IBugReportState = { sent: {}, history: [], lastSentAt: 0 };

/**
 * Чистит состояние от устаревших записей.
 * - Отпечатки старше {@link DEDUP_TTL_MS} выкидываются из `sent`
 * - Таймстемпы старше {@link DAY_MS} выкидываются из `history`
 *
 * Вызывается на чтении: lazy-cleanup, отдельного джоба не требуется.
 */
function prune(state: IBugReportState): IBugReportState {
	const now = Date.now();
	const sent: Record<string, number> = {};
	for (const [fp, ts] of Object.entries(state.sent)) {
		if (now - ts < DEDUP_TTL_MS) sent[fp] = ts;
	}
	const history = state.history.filter(ts => now - ts < DAY_MS);
	return { sent, history, lastSentAt: state.lastSentAt };
}

/**
 * Читает состояние из chrome.storage.local с нормализацией полей
 * (на случай если storage содержит частичные данные от старой версии).
 */
async function readState(): Promise<IBugReportState> {
	const raw = await storageGet<IBugReportState>(BUG_REPORT_STORAGE_KEY, EMPTY_STATE);
	return {
		sent: raw.sent ?? {},
		history: Array.isArray(raw.history) ? raw.history : [],
		lastSentAt: raw.lastSentAt ?? 0,
	};
}

/**
 * djb2 — детерминированный короткий хеш для отпечатка.
 * Не криптостойкий и не обязан быть таким: коллизии на реальных данных
 * (topic + question + url) пренебрежимы, цель — идентифицировать уже
 * отправленный отчёт.
 */
function hash(input: string): string {
	let h = 5381;
	for (let i = 0; i < input.length; i++) {
		h = ((h << 5) + h) ^ input.charCodeAt(i);
	}
	// биты могут стать отрицательными в js-битовых операциях — нормализуем
	return (h >>> 0).toString(16);
}

/**
 * Вычисляет отпечаток отчёта по тройке `topic + question + activeUrl`.
 * Два вызова с идентичными полями всегда возвращают одинаковую строку,
 * любое изменение любого поля даёт другой хеш.
 *
 * Используется и на клиенте (дедуп перед отправкой), и на сервере (по тем же
 * полям, но SHA-256) — клиентский хеш нужен только как локальный ключ.
 *
 * @example
 * computeFingerprint({ topic: 'Кардиология', question: 'Что это?', activeUrl: 'https://...' })
 * // → '4a2c1f9b'
 */
export function computeFingerprint(p: Pick<IBugReportPayload, 'topic' | 'question' | 'activeUrl'>): string {
	return hash(`${p.topic}\n${p.question}\n${p.activeUrl}`);
}

/**
 * Результат клиентской предпроверки лимитов.
 * - `ok: true` — можно открывать форму и отправлять
 * - `duplicate` — такой отчёт уже отправляли за последние 7 дней
 * - `cooldown` — меньше {@link COOLDOWN_MS} с прошлой отправки, `retryAfterMs` — остаток
 * - `daily_cap` — в сутках уже {@link DAILY_CAP} успешных отправок
 */
export type BugReportGate =
	| { ok: true }
	| { ok: false; reason: 'duplicate' }
	| { ok: false; reason: 'cooldown'; retryAfterMs: number }
	| { ok: false; reason: 'daily_cap' };

/**
 * Проверяет, можно ли сейчас отправить отчёт с данным отпечатком.
 * Читает состояние из chrome.storage.local и возвращает причину отказа,
 * если есть. Ничего не пишет — чистая проверка.
 *
 * Правила проверки (по приоритету): duplicate → cooldown → daily_cap → ok.
 * Порядок важен: duplicate — «отчёт уже отправлялся именно этот», мимо
 * него смысла проходить другие проверки нет.
 */
export async function canSubmitBugReport(fingerprint: string): Promise<BugReportGate> {
	const state = prune(await readState());
	if (state.sent[fingerprint]) return { ok: false, reason: 'duplicate' };
	const now = Date.now();
	if (state.lastSentAt && now - state.lastSentAt < COOLDOWN_MS) {
		return { ok: false, reason: 'cooldown', retryAfterMs: COOLDOWN_MS - (now - state.lastSentAt) };
	}
	if (state.history.length >= DAILY_CAP) return { ok: false, reason: 'daily_cap' };
	return { ok: true };
}

/**
 * Результат попытки отправки отчёта.
 * - `ok: true` — сервер принял и отправил в Telegram
 * - `'duplicate'` — сервер сказал «такой уже был» (или клиент отбил на gate)
 * - `'cooldown'` / `'daily_cap'` — серверный лимит
 * - `'payload_too_large'` — превысили {@link BUG_REPORT_ENDPOINT} лимит тела
 * - `'network'` — background-fetch не дошёл до сервера
 * - `'server'` — всё остальное (5xx / невалидный ответ / неизвестный статус)
 */
export type BugReportResult =
	| { ok: true }
	| { ok: false; error: 'duplicate' | 'cooldown' | 'daily_cap' | 'network' | 'server' | 'payload_too_large' | 'outdated' };

/**
 * Отправляет баг-репорт на сервер через background service worker
 * (обход CORS из content-скрипта).
 *
 * Порядок действий:
 * 1. Локальная предпроверка через {@link canSubmitBugReport}. Если лимит —
 *    возвращаем ошибку без сетевого запроса.
 * 2. POST на {@link BUG_REPORT_ENDPOINT} с JSON-телом.
 * 3. Интерпретация ответа по статус-коду и обновление локального состояния
 *    (дедуп-запись, кулдаун, дневной счётчик).
 *
 * Клиентское состояние — это «тень» серверного, истина на сервере.
 * При расхождении (например, user почистил storage) сервер всё равно отобьёт.
 */
export async function submitBugReport(payload: IBugReportPayload): Promise<BugReportResult> {
	const fingerprint = computeFingerprint(payload);

	const gate = await canSubmitBugReport(fingerprint);
	if (!gate.ok) {
		return { ok: false, error: gate.reason };
	}

	const res = await fetchViaBackground(BUG_REPORT_ENDPOINT, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(payload),
	});

	if (res.error) return { ok: false, error: 'network' };

	// Сервер вернул 200/409/413/429/etc. Парсим.
	let body: { ok?: boolean; error?: string } = {};
	try { body = JSON.parse(res.text); } catch { /* noop */ }

	const state = prune(await readState());
	const now = Date.now();

	if (res.status === 200 && body.ok) {
		state.sent[fingerprint] = now;
		state.history.push(now);
		state.lastSentAt = now;
		storageSet(BUG_REPORT_STORAGE_KEY, state);
		return { ok: true };
	}

	if (res.status === 409) {
		state.sent[fingerprint] = now;
		storageSet(BUG_REPORT_STORAGE_KEY, state);
		return { ok: false, error: 'duplicate' };
	}

	if (res.status === 429) {
		const err = body.error === 'daily_cap' ? 'daily_cap' : 'cooldown';
		if (err === 'cooldown') {
			state.lastSentAt = now - 1; // зафиксируем кулдаун локально
			storageSet(BUG_REPORT_STORAGE_KEY, state);
		}
		return { ok: false, error: err };
	}

	if (res.status === 413) return { ok: false, error: 'payload_too_large' };
	if (res.status === 426) return { ok: false, error: 'outdated' };

	return { ok: false, error: 'server' };
}
