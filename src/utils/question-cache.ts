import {normalizeText} from './text';

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
 * запись сразу добавляется в пустой кеш. В рамках одной темы ключом служит текст
 * вопроса без учёта регистра, повторяющихся пробелов и пробелов по краям.
 */
export class QuestionCache {
	private readonly _cache = new Map<string, ICachedQuestionModel>();
	private _topic: string | null = null;

	/** Возвращает сохранённый вопрос или `null`, если записи нет. */
	public get(topic: string, question: string): ICachedQuestionModel | null {
		if (!this.isCurrentTopic(topic)) return null;

		const entry = this._cache.get(normalizeText(question));
		return entry ? cloneEntry(entry) : null;
	}

	/** Проверяет наличие вопроса в кеше текущей темы. */
	public has(topic: string, question: string): boolean {
		return this.isCurrentTopic(topic) && this._cache.has(normalizeText(question));
	}

	/**
	 * Сохраняет вопрос. При смене темы очищает весь предыдущий кеш.
	 * Повторная запись того же вопроса заменяет варианты и выбранные ответы.
	 */
	public set(
		topic: string,
		question: string,
		variants: readonly string[],
		selectedVariants: readonly string[],
	): ICachedQuestionModel {
		if (!this.isCurrentTopic(topic)) {
			this._cache.clear();
			this._topic = topic.trim();
		}

		const entry: ICachedQuestionModel = {
			variants: [...variants],
			selectedVariants: [...selectedVariants],
		};

		this._cache.set(normalizeText(question), entry);
		return cloneEntry(entry);
	}

	private isCurrentTopic(topic: string): boolean {
		return this._topic !== null && normalizeText(this._topic) === normalizeText(topic);
	}
}

/** Общий экземпляр кеша для компонентов расширения. */
export const questionCache = new QuestionCache();

function cloneEntry(entry: ICachedQuestionModel): ICachedQuestionModel {
	return {
		variants: [...entry.variants],
		selectedVariants: [...entry.selectedVariants],
	};
}
