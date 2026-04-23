import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('./fetch', () => ({
	fetchViaBackground: vi.fn(),
}));

import { fetchViaBackground } from './fetch';
import { BUG_REPORT_STORAGE_KEY } from '../utils/constants';
import {
	computeFingerprint,
	canSubmitBugReport,
	submitBugReport,
	type IBugReportPayload,
} from './bug-report';

const mockFetch = fetchViaBackground as unknown as ReturnType<typeof vi.fn>;

function resetStorage(state: unknown = { sent: {}, history: [], lastSentAt: 0 }) {
	return new Promise<void>(resolve => {
		chrome.storage.local.set({ [BUG_REPORT_STORAGE_KEY]: state }, () => resolve());
	});
}

function makePayload(overrides: Partial<IBugReportPayload> = {}): IBugReportPayload {
	return {
		activeUrl: 'https://example.com/test',
		source: 'rosmedicinfo',
		topic: 'Кардиология - 2024',
		question: 'Какой диагноз?',
		questionHtml: '<p>Какой диагноз?</p>',
		variants: ['A', 'B', 'C'],
		extVersion: '3.1.3',
		userAgent: 'Test/1.0',
		...overrides,
	};
}

beforeEach(async () => {
	mockFetch.mockReset();
	await resetStorage();
});

describe('computeFingerprint', () => {
	it('одинаковые входы → одинаковый отпечаток', () => {
		const fp1 = computeFingerprint({ topic: 'T', question: 'Q', activeUrl: 'U' });
		const fp2 = computeFingerprint({ topic: 'T', question: 'Q', activeUrl: 'U' });
		expect(fp1).toBe(fp2);
	});

	it('разный question → разный отпечаток', () => {
		const fp1 = computeFingerprint({ topic: 'T', question: 'Q1', activeUrl: 'U' });
		const fp2 = computeFingerprint({ topic: 'T', question: 'Q2', activeUrl: 'U' });
		expect(fp1).not.toBe(fp2);
	});

	it('разный topic → разный отпечаток', () => {
		const fp1 = computeFingerprint({ topic: 'T1', question: 'Q', activeUrl: 'U' });
		const fp2 = computeFingerprint({ topic: 'T2', question: 'Q', activeUrl: 'U' });
		expect(fp1).not.toBe(fp2);
	});

	it('разный activeUrl → разный отпечаток', () => {
		const fp1 = computeFingerprint({ topic: 'T', question: 'Q', activeUrl: 'U1' });
		const fp2 = computeFingerprint({ topic: 'T', question: 'Q', activeUrl: 'U2' });
		expect(fp1).not.toBe(fp2);
	});
});

describe('canSubmitBugReport', () => {
	it('пустое состояние → ok', async () => {
		const gate = await canSubmitBugReport('fp1');
		expect(gate).toEqual({ ok: true });
	});

	it('отпечаток уже в sent → duplicate', async () => {
		await resetStorage({ sent: { fp1: Date.now() }, history: [], lastSentAt: 0 });
		const gate = await canSubmitBugReport('fp1');
		expect(gate).toEqual({ ok: false, reason: 'duplicate' });
	});

	it('другой отпечаток → ok даже если есть отправки', async () => {
		await resetStorage({ sent: { fp_other: Date.now() }, history: [], lastSentAt: 0 });
		const gate = await canSubmitBugReport('fp1');
		expect(gate).toEqual({ ok: true });
	});

	it('lastSentAt < 5 мин → cooldown с retryAfterMs', async () => {
		const now = Date.now();
		await resetStorage({ sent: {}, history: [], lastSentAt: now - 60_000 });
		const gate = await canSubmitBugReport('fp1');
		expect(gate.ok).toBe(false);
		if (!gate.ok && gate.reason === 'cooldown') {
			expect(gate.retryAfterMs).toBeGreaterThan(0);
			expect(gate.retryAfterMs).toBeLessThanOrEqual(5 * 60 * 1000);
		} else {
			throw new Error('Expected cooldown');
		}
	});

	it('lastSentAt > 5 мин → ok', async () => {
		const now = Date.now();
		await resetStorage({ sent: {}, history: [], lastSentAt: now - 6 * 60_000 });
		const gate = await canSubmitBugReport('fp1');
		expect(gate).toEqual({ ok: true });
	});

	it('history.length >= 5 за 24ч → daily_cap', async () => {
		const now = Date.now();
		// пять недавних отправок + старый lastSentAt (чтобы не триггерить cooldown)
		await resetStorage({
			sent: {},
			history: [now - 1000, now - 2000, now - 3000, now - 4000, now - 5000],
			lastSentAt: now - 10 * 60_000,
		});
		const gate = await canSubmitBugReport('fp1');
		expect(gate).toEqual({ ok: false, reason: 'daily_cap' });
	});

	it('history отбрасывает записи старше 24ч', async () => {
		const now = Date.now();
		const dayMs = 24 * 60 * 60 * 1000;
		await resetStorage({
			sent: {},
			history: [now - dayMs - 1000, now - dayMs - 2000, now - dayMs - 3000, now - dayMs - 4000, now - dayMs - 5000],
			lastSentAt: now - 10 * 60_000,
		});
		const gate = await canSubmitBugReport('fp1');
		expect(gate).toEqual({ ok: true });
	});

	it('sent отбрасывает отпечатки старше 7 дней', async () => {
		const now = Date.now();
		const weekMs = 7 * 24 * 60 * 60 * 1000;
		await resetStorage({
			sent: { fp1: now - weekMs - 1000 },
			history: [],
			lastSentAt: 0,
		});
		const gate = await canSubmitBugReport('fp1');
		expect(gate).toEqual({ ok: true });
	});
});

describe('submitBugReport', () => {
	it('gate не пропускает — fetch не вызывается', async () => {
		const now = Date.now();
		await resetStorage({ sent: {}, history: [], lastSentAt: now });
		const res = await submitBugReport(makePayload());
		expect(res.ok).toBe(false);
		expect(mockFetch).not.toHaveBeenCalled();
	});

	it('успешная отправка (200) → ok, state обновлён', async () => {
		mockFetch.mockResolvedValue({ error: false, status: 200, text: '{"ok":true}' });
		const payload = makePayload();
		const res = await submitBugReport(payload);
		expect(res).toEqual({ ok: true });

		// следующий вызов должен упереться в duplicate для того же отпечатка
		const fp = computeFingerprint(payload);
		const gate = await canSubmitBugReport(fp);
		expect(gate.ok).toBe(false);
	});

	it('ошибка сети (res.error=true) → network', async () => {
		mockFetch.mockResolvedValue({ error: true, status: 0, text: '' });
		const res = await submitBugReport(makePayload());
		expect(res).toEqual({ ok: false, error: 'network' });
	});

	it('сервер вернул 409 → duplicate, отпечаток записан', async () => {
		mockFetch.mockResolvedValue({ error: false, status: 409, text: '{"ok":false,"error":"duplicate"}' });
		const payload = makePayload();
		const res = await submitBugReport(payload);
		expect(res).toEqual({ ok: false, error: 'duplicate' });

		// повторная попытка — gate сразу отобьёт как duplicate
		const fp = computeFingerprint(payload);
		const gate = await canSubmitBugReport(fp);
		expect(gate).toEqual({ ok: false, reason: 'duplicate' });
	});

	it('сервер вернул 429 cooldown → cooldown', async () => {
		mockFetch.mockResolvedValue({ error: false, status: 429, text: '{"ok":false,"error":"cooldown"}' });
		const res = await submitBugReport(makePayload());
		expect(res).toEqual({ ok: false, error: 'cooldown' });
	});

	it('сервер вернул 429 daily_cap → daily_cap', async () => {
		mockFetch.mockResolvedValue({ error: false, status: 429, text: '{"ok":false,"error":"daily_cap"}' });
		const res = await submitBugReport(makePayload());
		expect(res).toEqual({ ok: false, error: 'daily_cap' });
	});

	it('сервер вернул 413 → payload_too_large', async () => {
		mockFetch.mockResolvedValue({ error: false, status: 413, text: '{"ok":false,"error":"payload_too_large"}' });
		const res = await submitBugReport(makePayload());
		expect(res).toEqual({ ok: false, error: 'payload_too_large' });
	});

	it('сервер вернул 502 → server', async () => {
		mockFetch.mockResolvedValue({ error: false, status: 502, text: '{"ok":false}' });
		const res = await submitBugReport(makePayload());
		expect(res).toEqual({ ok: false, error: 'server' });
	});

	it('тело ответа — невалидный JSON → трактуется по статусу', async () => {
		mockFetch.mockResolvedValue({ error: false, status: 200, text: 'not json' });
		const res = await submitBugReport(makePayload());
		// body.ok будет undefined, status 200 но не ok в теле → попадёт в default branch
		expect(res).toEqual({ ok: false, error: 'server' });
	});

	it('fetch вызван с правильным URL, методом и телом', async () => {
		mockFetch.mockResolvedValue({ error: false, status: 200, text: '{"ok":true}' });
		const payload = makePayload();
		await submitBugReport(payload);
		expect(mockFetch).toHaveBeenCalledTimes(1);
		const [url, opts] = mockFetch.mock.calls[0];
		expect(url).toBe('https://nmo-helper.ru/api/bug-report');
		expect(opts.method).toBe('POST');
		expect(opts.headers).toEqual({ 'Content-Type': 'application/json' });
		expect(JSON.parse(opts.body)).toEqual(payload);
	});
});
