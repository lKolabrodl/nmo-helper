/**
 * Кеш ответов v2.
 *
 * Ключ — тройка (topic, question, variants[]).
 * Варианты нормализуются (trim + lower) и сортируются, так что перемешивание
 * на стороне портала не ломает поиск.
 *
 * Модель:
 *  - `id`     — стабильный уникальный ключ от тройки (topic, question, variants)
 *  - `answers` — тексты правильных вариантов как их передали в `set`
 *  - `idx`     — индексы правильных вариантов внутри `variants` на момент `set`
 */

export interface ICachedAnswerModel {
	readonly id: string;
	readonly answers: string[];
	readonly idx: number[];
}

export class AnswerCache {
	private readonly _cache = new Map<string, ICachedAnswerModel>();
	private readonly _fresh = new Set<string>();

	/** Найти запись по тройке (topic, question, variants). */
	public get(topic: string, question: string, variants: string[]): ICachedAnswerModel | null {
		const id = makeId(topic, question, variants);
		return this._cache.get(id) ?? null;
	}

	/** Есть ли запись по тройке (topic, question, variants). */
	public has(topic: string | null, question: string | null, variants: string[]): boolean {
		const id = makeId(topic ?? '', question ?? '', variants ?? []);
		return this._cache.has(id);
	}

	/** Сохранить запись. `idx` считается автоматически из variants + answers. */
	public set(topic: string, question: string, variants: string[], answers: string[]): ICachedAnswerModel {
		const id = makeId(topic, question, variants);
		const idx = computeIdx(variants, answers);
		const entry: ICachedAnswerModel = {id, answers: [...answers], idx: [...idx]};
		this._cache.set(id, entry);
		this._fresh.add(id);
		return entry;
	}

	/** Одноразовая метка «только что записан» — после проверки сбрасывается. */
	public fresh(topic: string, question: string, variants: string[]): boolean {
		const id = makeId(topic, question, variants);
		if (!this._fresh.has(id)) return false;
		this._fresh.delete(id);
		return true;
	}
}

export const answerCache2 = new AnswerCache();



const norm = (s: string): string => s.trim().toLowerCase();

function makeId(topic: string, question: string, variants: string[]): string {
	const v = [...variants].map(norm).sort().join('|');
	return `${norm(topic)}::${norm(question)}::${v}`;
}

function computeIdx(variants: string[], answers: string[]): number[] {
	const normAnswers = new Set(answers.map(norm));
	const idx: number[] = [];
	variants.forEach((v, i) => {
		if (normAnswers.has(norm(v))) idx.push(i);
	});
	return idx;
}