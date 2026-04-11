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

class AnswerCache {
	private readonly cache = new Map<string, Map<string, ICachedAnswer>>();
	private readonly fresh = new Set<string>();

	/** Получить кешированный ответ */
	public get(topic: string, question: string): ICachedAnswer | null {
		return this.cache.get(topic)?.get(question) ?? null;
	}

	/** Сохранить ответ в кеш */
	public set(topic: string, question: string, answer: ICachedAnswer): void {
		if (!this.cache.has(topic)) this.cache.set(topic, new Map());
		this.cache.get(topic)!.set(question, answer);
		this.fresh.add(`${topic}::${question}`);
	}

	/** Проверяет и снимает метку "только что записан" */
	public isFresh(topic: string, question: string): boolean {
		const key = `${topic}::${question}`;
		if (!this.fresh.has(key)) return false;
		this.fresh.delete(key);
		return true;
	}

	/**
	 * Индексы правильных вариантов для текущего порядка на странице.
	 * Сопоставляет кешированные ответы с currentVariants по тексту,
	 * чтобы корректно работать при перемешивании вариантов.
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

	/** Очистить кеш для темы (при смене темы в авто-режиме) */
	public clearTopic(topic: string): void {
		this.cache.delete(topic);
	}

	/** Полная очистка кеша */
	public clear(): void {
		this.cache.clear();
	}
}

export const answerCache = new AnswerCache();
