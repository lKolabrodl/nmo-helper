/**
 * Вспомогательные функции секции поиска по сайтам.
 *
 * @module components/SectionSites/utils
 */

import {Status} from '../../types';
import {NMO_URL_VARIANT} from '../../utils/constants';
import type {IToast} from '../ui/InlineToast';

const DISPLAY_URL_PREFIX = 'nmo-helper/id/';
const FNV_OFFSET_BASIS_64 = 0xcbf29ce484222325n;
const FNV_PRIME_64 = 0x100000001b3n;
const DISPLAY_ID_LENGTH = 10;

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

	if (url.protocol !== 'https:' || url.hostname.toLowerCase() !== NMO_URL_VARIANT) return value;

	return `${DISPLAY_URL_PREFIX}${createSeededId(url.href)}`;
}

/**
 * Выбирает форму слова «тест» для отображения количества результатов.
 *
 * @param n Количество найденных тестов.
 * @returns Подходящая форма: «тест», «теста» или «тестов».
 */
export function plural(n: number): string {
	if (n === 1) return 'тест';
	if (n < 5) return 'теста';
	return 'тестов';
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
