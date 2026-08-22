import {afterEach, describe, expect, it, vi} from 'vitest';
import {formatReportMode, gateStatus, getBrowserInfo, resolveBugReportContext, resultStatus} from './utils';

afterEach(() => {
	vi.unstubAllGlobals();
});

describe('gateStatus', () => {
	it('разрешает отправку при успешной проверке', () => {
		expect(gateStatus({ok: true})).toBeNull();
	});

	it('преобразует причины запрета в статусы формы', () => {
		expect(gateStatus({ok: false, reason: 'duplicate'})).toBe('DUPLICATE');
		expect(gateStatus({ok: false, reason: 'cooldown', retryAfterMs: 1})).toBe('COOLDOWN');
		expect(gateStatus({ok: false, reason: 'daily_cap'})).toBe('DAILY_CAP');
	});
});

describe('resultStatus', () => {
	it('возвращает статус успешной отправки', () => {
		expect(resultStatus({ok: true})).toBe('SENT');
	});

	it.each([
		['duplicate', 'DUPLICATE'],
		['cooldown', 'COOLDOWN'],
		['daily_cap', 'DAILY_CAP'],
		['outdated', 'OUTDATED'],
		['payload_too_large', 'PAYLOAD_LARGE'],
		['network', 'NETWORK'],
		['server', 'SERVER'],
	] as const)('преобразует ошибку %s в статус %s', (error, status) => {
		expect(resultStatus({ok: false, error})).toBe(status);
	});
});

describe('resolveBugReportContext', () => {
	it('возвращает режим и URL активного раздела', () => {
		expect(resolveBugReportContext(
			{mode: 'sites:url', url: 'https://example.com/answers'},
			'sites',
			'free',
		)).toEqual({
			mode: 'sites:url',
			url: 'https://example.com/answers',
		});
	});

	it('сбрасывает URL чужого раздела и выбирает режим по умолчанию', () => {
		expect(resolveBugReportContext(
			{mode: 'auto', url: 'https://example.com/answers'},
			'sites',
			'free',
		)).toEqual({
			mode: 'sites:search',
			url: '',
		});
	});

	it('использует текущего AI-провайдера', () => {
		expect(resolveBugReportContext(
			{mode: 'ai:custom', url: ''},
			'ai',
			'proxy',
		)).toEqual({
			mode: 'ai:proxy',
			url: '',
		});
	});
});

describe('formatReportMode', () => {
	it.each([
		['auto', 'Авто'],
		['sites:search', 'Сайты / поиск'],
		['sites:url', 'Сайты / URL'],
		['ai:free', 'AI / бесплатно'],
		['ai:custom', 'AI / свой endpoint'],
		['ai:proxy', 'AI / ProxyAPI'],
		['pdf', 'PDF'],
	] as const)('форматирует %s как %s', (mode, expected) => {
		expect(formatReportMode(mode)).toBe(expected);
	});

	it('использует исходные значения для неизвестного режима', () => {
		expect(formatReportMode('unknown:custom')).toBe('unknown:custom');
		expect(formatReportMode('')).toBe('—');
	});
});

describe('getBrowserInfo', () => {
	it.each([
		['Firefox/128.0', 'Firefox 128.0'],
		['Edg/127.0', 'Edge 127.0'],
		['OPR/112.0', 'Opera 112.0'],
		['Chrome/127.0', 'Chrome 127.0'],
		['Safari/17.5', 'Safari 17.5'],
	] as const)('определяет браузер из %s', (userAgent, expected) => {
		vi.stubGlobal('navigator', {userAgent});

		expect(getBrowserInfo()).toBe(expected);
	});

	it('возвращает заглушку для неизвестного браузера', () => {
		vi.stubGlobal('navigator', {userAgent: 'UnknownBrowser/1.0'});

		expect(getBrowserInfo()).toBe('неизвестно');
	});

	it('работает без navigator', () => {
		vi.stubGlobal('navigator', undefined);

		expect(getBrowserInfo()).toBe('неизвестно');
	});
});
