/** Сохранённые данные одного вопроса. */
export interface ICachedQuestionModel {
	/** Все варианты ответа в порядке, полученном от страницы. */
	readonly variants: readonly string[];
	/** Варианты, выбранные пользователем. */
	readonly selectedVariants: readonly string[];
}

/**
 * Хранит вопросы только для одной текущей темы.
 *
 * При первой записи с новой темой старые вопросы удаляются, после чего новая
 * запись сразу добавляется в пустой кеш. В рамках одной темы вопрос определяется
 * набором вариантов без учёта их порядка, регистра и пробелов по краям.
 */
export class QuestionCache {
	private readonly _cache = new Map<string, ICachedQuestionModel>();
	private _topic: string | null = null;

	/** Возвращает сохранённый вопрос или `null`, если записи нет. */
	public get(topic: string, variants: readonly string[]): ICachedQuestionModel | null {
		if (!this.isCurrentTopic(topic)) return null;

		const entry = this._cache.get(makeId(variants));
		return entry ? cloneEntry(entry) : null;
	}

	/** Проверяет наличие вопроса в кеше текущей темы. */
	public has(topic: string, variants: readonly string[]): boolean {
		return this.isCurrentTopic(topic) && this._cache.has(makeId(variants));
	}

	/**
	 * Сохраняет вопрос. При смене темы очищает весь предыдущий кеш.
	 * Повторная запись того же набора вариантов заменяет выбранные варианты.
	 */
	public set(topic: string, variants: readonly string[], selectedVariants: readonly string[]): ICachedQuestionModel {
		if (!this.isCurrentTopic(topic)) {
			this._cache.clear();
			this._topic = topic.trim();
		}

		const entry: ICachedQuestionModel = {
			variants: [...variants],
			selectedVariants: [...selectedVariants],
		};

		this._cache.set(makeId(variants), entry);
		return cloneEntry(entry);
	}

	/** Возвращает копии всех вопросов текущей темы в порядке записи. */
	public getAll(): ICachedQuestionModel[] {
		return [...this._cache.values()].map(cloneEntry);
	}

	private isCurrentTopic(topic: string): boolean {
		return this._topic !== null && normalize(this._topic) === normalize(topic);
	}
}

/** Общий экземпляр кеша для компонентов расширения. */
export const questionCache = new QuestionCache();

function makeId(variants: readonly string[]): string {
	return JSON.stringify([...variants].map(normalize).sort());
}

function normalize(value: string): string {
	return value.trim().toLowerCase();
}

function cloneEntry(entry: ICachedQuestionModel): ICachedQuestionModel {
	return {
		variants: [...entry.variants],
		selectedVariants: [...entry.selectedVariants],
	};
}
