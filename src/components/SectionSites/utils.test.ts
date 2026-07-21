import {describe, expect, it} from 'vitest';
import {Status} from '../../types';
import {NMO_URL_ROSMED, NMO_URL_VARIANT} from '../../utils/constants';
import {formatUrlForDisplay, plural, statusToToast} from './utils';

const NMO_BASE_URL = `https://${NMO_URL_VARIANT}`;

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

	it.each([
		`https://${NMO_URL_ROSMED}/answers`,
		`https://not-${NMO_URL_VARIANT}/test`,
		'nmo-helper/id/already-set',
		'незавершённый ввод',
	])('не изменяет %s', value => {
		expect(formatUrlForDisplay(value)).toBe(value);
	});
});

describe('plural', () => {
	it.each([
		[1, 'тест'],
		[2, 'теста'],
		[4, 'теста'],
		[5, 'тестов'],
	] as const)('для количества %i возвращает «%s»', (count, expected) => {
		expect(plural(count)).toBe(expected);
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
