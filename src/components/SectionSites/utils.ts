/**
 * Вспомогательные функции секции поиска по сайтам.
 *
 * @module components/SectionSites/utils
 */

import {Status, type ISourceKey} from '../../types';
import {ALTERNATIVE_ANSWER_SOURCE_HOST, NMO_API_HOST} from '../../utils/constants';
import type {IToast} from '../ui/InlineToast';

const DISPLAY_URL_PREFIX = 'nmo-helper/id/';
const FNV_OFFSET_BASIS_64 = 0xcbf29ce484222325n;
const FNV_PRIME_64 = 0x100000001b3n;
const DISPLAY_ID_LENGTH = 10;

export const SOURCE_DETAILS: Record<ISourceKey, {
	readonly label: string;
	readonly className: string;
	readonly priority: number;
}> = {
	'primary': {label: 'rosmed', className: 'primary', priority: 0},
	'secondary': {label: '24fc', className: 'secondary', priority: 1},
	'nmo-helper': {label: 'nmo-helper', className: 'secondary', priority: 2},
	'foo': {label: 'foo', className: 'secondary', priority: 3},
};

/**
 * Создаёт стабильный псевдослучайный идентификатор из строки-семени.
 * 64-битный FNV-1a позволяет вычислять его синхронно прямо при рендере.
 */
function createSeededId(seed: string): string {
	let hash = FNV_OFFSET_BASIS_64;

	for (let i = 0; i < seed.length; i++) {
		hash ^= BigInt(seed.charCodeAt(i));
		hash = BigInt.asUintN(64, hash * FNV_PRIME_64);
	}

	return hash.toString(36).padStart(DISPLAY_ID_LENGTH, '0').slice(-DISPLAY_ID_LENGTH);
}

/**
 * Преобразую URL в поле ввода, сохраняя стабильный ID.
 * Остальные URL и незавершённый пользовательский ввод не изменяет.
 *
 * Настоящая ссылка остаётся в состоянии SectionSites и передаётся загрузчику;
 * эта функция отвечает только за отображаемое значение.
 */
export function formatUrlForDisplay(value: string): string {
	let url: URL;

	try {
		url = new URL(value.trim());
	} catch {
		return value;
	}

	const hostname = url.hostname.toLowerCase();
	if (
		url.protocol !== 'https:'
		|| (hostname !== ALTERNATIVE_ANSWER_SOURCE_HOST && hostname !== NMO_API_HOST)
	) return value;

	return `${DISPLAY_URL_PREFIX}${createSeededId(url.href)}`;
}

/**
 * Преобразует статус панели в модель встроенного toast-уведомления.
 *
 * Успешный статус становится `success`, ошибка — `danger`, остальные
 * состояния отображаются как предупреждение.
 *
 * @param title Текст уведомления.
 * @param status Текущий статус панели.
 * @returns Модель уведомления для компонента `InlineToast`.
 */
export function statusToToast(title: string, status: typeof Status[keyof typeof Status]): IToast {
	if (status === Status.OK)   return {kind: 'success', title};
	if (status === Status.ERR)  return {kind: 'danger',  title};
	return {kind: 'warning', title};
}
