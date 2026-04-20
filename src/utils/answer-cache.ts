/**
 * Глобальный кеш ответов.
 *
 * Структура: тема → вопрос → кешированный ответ.
 * Общий для всех режимов (AI, авто, ручной).
 * Если один режим уже нашёл ответ — другие используют кеш.
 *
 * @example
 * ```ts
 * answerCache.set('Хирургия', 'Какой метод...', {
 *   variants: [
 *     { title: 'Лапароскопия', answer: true },
 *     { title: 'Лапаротомия', answer: false },
 *     { title: 'Торакотомия', answer: true },
 *   ],
 *   source: 'ai',
 * });
 *
 * const cached = answerCache.get('Хирургия', 'Какой метод...');
 * ```
 */

export interface ICachedVariant {
	readonly title: string;
	readonly answer: boolean;
}

export interface ICachedAnswer {
	readonly variants: ICachedVariant[];
	readonly source: 'ai' | 'rosmed' | '24forcare';
}

/** Ключ в chrome.storage.local для персистентного хранения кеша */
const STORAGE_KEY = 'answerCacheData';

/** Сериализуемый формат кеша для chrome.storage.local */
type SerializedCache = Record<string, Record<string, ICachedAnswer>>;

export class AnswerCache {
	private readonly _cache = new Map<string, Map<string, ICachedAnswer>>();
	private readonly _fresh = new Set<string>();
	private readonly _maxTopics: number;

	/**
	 * @param maxTopics — максимальное количество тем в кеше.
	 *   При превышении самая старая тема удаляется (LRU).
	 */
	public constructor(maxTopics: number) {
		this._maxTopics = maxTopics;
	}

	/**
	 * Загрузить кеш из chrome.storage.local.
	 * Вызывается один раз при инициализации content script.
	 */
	public async load(): Promise<void> {
		return new Promise<void>(resolve => {
			chrome.storage.local.get(STORAGE_KEY, (result: Record<string, unknown>) => {
				const data = result[STORAGE_KEY] as SerializedCache | undefined;
				if (!data) return resolve();

				for (const [topic, questions] of Object.entries(data)) {
					if (this._cache.size >= this._maxTopics) break;
					const map = new Map<string, ICachedAnswer>();
					for (const [question, cached] of Object.entries(questions)) {
						map.set(question, cached);
					}
					this._cache.set(topic, map);
				}
				resolve();
			});
		});
	}

	/** Сохранить текущий кеш в chrome.storage.local */
	private _persist(): void {
		const data: SerializedCache = {};
		for (const [topic, questions] of this._cache) {
			data[topic] = Object.fromEntries(questions);
		}
		chrome.storage.local.set({ [STORAGE_KEY]: data });
	}

	/**
	 * Получить кешированный ответ.
	 * @param topic — название темы теста
	 * @param question — текст вопроса
	 * @returns кешированный ответ или `null`, если не найден
	 */
	public get(topic: string, question: string): ICachedAnswer | null {
		return this._cache.get(topic)?.get(question) ?? null;
	}

	/**
	 * Сохранить ответ в кеш.
	 * Реализует LRU-вытеснение по темам: при превышении `maxTopics`
	 * удаляется самая давно используемая тема.
	 * @param topic — название темы теста
	 * @param question — текст вопроса
	 * @param answer — кешируемый ответ с вариантами и источником
	 */
	public set(topic: string, question: string, answer: ICachedAnswer): void {
		if (!this._cache.has(topic) && this._cache.size >= this._maxTopics) {
			const oldest = this._cache.keys().next().value!;
			this._cache.delete(oldest);
		}

		if (!this._cache.has(topic)) this._cache.set(topic, new Map());
		this._cache.get(topic)!.set(question, answer);
		this._fresh.add(`${topic}::${question}`);

		// освежаем тему — перемещаем в конец Map (LRU)
		const topicData = this._cache.get(topic)!;
		this._cache.delete(topic);
		this._cache.set(topic, topicData);

		this._persist();
	}

	/**
	 * Проверяет и снимает метку «только что записан».
	 * Используется AnswerHighlighter для одноразовой подсветки новых ответов.
	 * @param topic — название темы теста
	 * @param question — текст вопроса
	 * @returns `true` при первом вызове после `set`, далее `false`
	 */
	public isFresh(topic: string, question: string): boolean {
		const key = `${topic}::${question}`;
		if (!this._fresh.has(key)) return false;
		this._fresh.delete(key);
		return true;
	}

	/**
	 * Индексы правильных вариантов для текущего порядка на странице.
	 * Сопоставляет кешированные ответы с `currentVariants` по тексту,
	 * чтобы корректно работать при перемешивании вариантов порталом.
	 * @param topic — название темы теста
	 * @param question — текст вопроса
	 * @param currentVariants — массив текстов вариантов в текущем порядке на странице
	 * @returns массив индексов правильных вариантов или `null`
	 */
	public getCorrectIndexes(topic: string, question: string, currentVariants: string[]): number[] | null {
		const cached = this.get(topic, question);
		if (!cached) return null;

		const correctTitles = cached.variants.filter(v => v.answer).map(v => v.title);
		if (!correctTitles.length) return null;

		const indexes: number[] = [];
		currentVariants.forEach((variant, i) => {
			const nv = variant.trim().toLowerCase();
			for (const title of correctTitles) {
				if (title.trim().toLowerCase() === nv) {
					indexes.push(i);
					break;
				}
			}
		});

		return indexes.length ? indexes : null;
	}

	/**
	 * Очистить кеш для конкретной темы.
	 * @param topic — название темы для удаления
	 */
	public clearTopic(topic: string): void {
		this._cache.delete(topic);
		this._persist();
	}

	/**
	 * Экспортировать весь кеш как сериализуемый объект.
	 * Ключ — тема, значение — массив вопросов со всеми вариантами и пометкой правильных.
	 * @returns объект со всеми темами или `null` если кеш пуст
	 */
	public exportAll(): Record<string, { question: string; variants: { title: string; answer: boolean }[]; source: string }[]> | null {
		if (this._cache.size === 0) return null;

		const result: Record<string, { question: string; variants: { title: string; answer: boolean }[]; source: string }[]> = {};

		for (const [topic, questions] of this._cache) {
			const items: { question: string; variants: { title: string; answer: boolean }[]; source: string }[] = [];
			for (const [question, cached] of questions) {
				items.push({
					question,
					variants: cached.variants.map(v => ({ title: v.title, answer: v.answer })),
					source: cached.source,
				});
			}
			if (items.length) result[topic] = items;
		}

		return Object.keys(result).length ? result : null;
	}

	/**
	 * Экспортировать весь кеш как CSV-строку.
	 * Колонки: Тема, Вопрос, Правильные ответы, Все варианты, Источник.
	 * @returns CSV-строка или `null` если кеш пуст
	 */
	public exportCsv(): string | null {
		if (this._cache.size === 0) return null;

		const esc = (s: string) => '"' + s.replace(/"/g, '""') + '"';
		const rows: string[] = ['Тема;Вопрос;Правильные ответы;Все варианты;Источник'];

		for (const [topic, questions] of this._cache) {
			for (const [question, cached] of questions) {
				const correct = cached.variants.filter(v => v.answer).map(v => v.title).join(', ');
				const all = cached.variants.map(v => v.title).join(', ');
				rows.push([esc(topic), esc(question), esc(correct), esc(all), cached.source].join(';'));
			}
		}

		return rows.length > 1 ? rows.join('\n') : null;
	}

	/** Полная очистка кеша и меток свежести */
	public clear(): void {
		this._cache.clear();
		this._persist();
	}
}

import { CACHE_MAX_TOPICS } from './constants';

export const answerCache = new AnswerCache(CACHE_MAX_TOPICS);
