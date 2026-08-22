import {describe, expect, it} from 'vitest';
import {Status} from '../../types';
import {FIRST_ANSWER_SOURCE_HOST, NMO_API_HOST, THIRD_ANSWER_SOURCE_HOST} from '../../utils/constants';
import {formatUrlForDisplay, statusToToast} from './utils';

const NMO_BASE_URL = `https://${THIRD_ANSWER_SOURCE_HOST}`;

describe('formatUrlForDisplay', () => {
	it('заменяет альтерантивный URL стабильным 10-символьным ID', () => {
		const url = `${NMO_BASE_URL}/test-medik/nmo/678270b4b100db787f87d662.html`;
		const displayed = formatUrlForDisplay(url);

		expect(displayed).toBe('nmo-helper/id/6o61ct5wqo');
		expect(formatUrlForDisplay(url)).toBe(displayed);
	});

	it('создаёт разные ID для разных настоящих ссылок', () => {
		expect(formatUrlForDisplay(`${NMO_BASE_URL}/test-one`))
			.not.toBe(formatUrlForDisplay(`${NMO_BASE_URL}/test-two`));
	});

	it('скрывает внутренний endpoint серверного NMO API', () => {
		const displayed = formatUrlForDisplay(`https://${NMO_API_HOST}/api/nmo/topic/short-lived.uid`);

		expect(displayed).toMatch(/^nmo-helper\/id\/[a-z0-9]{10}$/);
	});

	it.each([
		`https://${FIRST_ANSWER_SOURCE_HOST}/answers`,
		`https://not-${THIRD_ANSWER_SOURCE_HOST}/test`,
		'nmo-helper/id/already-set',
		'незавершённый ввод',
	])('не изменяет %s', value => {
		expect(formatUrlForDisplay(value)).toBe(value);
	});
});

describe('statusToToast', () => {
	it.each([
		[Status.OK, 'success'],
		[Status.ERR, 'danger'],
		[Status.WARN, 'warning'],
		[Status.IDLE, 'warning'],
		[Status.LOADING, 'warning'],
	] as const)('преобразует статус %s в toast %s', (status, kind) => {
		expect(statusToToast('Сообщение', status)).toEqual({kind, title: 'Сообщение'});
	});
});
