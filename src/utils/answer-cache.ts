/**
 * Сохранённый ответ на один вопрос.
 *
 * @remarks
 * `answers` копируется из аргумента {@link AnswerCache.set}, а `idx` вычисляется
 * относительно порядка вариантов, переданного в тот же вызов `set`.
 * Объект хранится в кеше и возвращается по ссылке, поэтому вызывающему коду
 * следует считать его и вложенные массивы неизменяемыми.
 */
export interface ICachedAnswerModel {
	/** Нормализованный составной ключ темы, вопроса и набора вариантов. */
	readonly id: string;
	/** Тексты правильных ответов в том виде и порядке, в котором они были сохранены. */
	readonly answers: string[];
	/** 0-индексированные позиции правильных ответов в массиве `variants` из вызова `set`. */
	readonly idx: number[];
}

/**
 * Хранит найденные ответы в памяти на время жизни текущего контекста расширения.
 *
 * Запись идентифицируется тройкой `topic + question + variants`. При построении
 * ключа строки очищаются от пробелов по краям и приводятся к нижнему регистру,
 * а варианты сортируются. Поэтому регистр, краевые пробелы и порядок вариантов
 * не влияют на поиск записи.
 *
 * @remarks
 * Кеш не сохраняется в `storage`, не ограничивает число записей и не удаляет их
 * автоматически. Повторный {@link AnswerCache.set} с тем же ключом полностью заменяет запись.
 */
export class AnswerCache {
	/** Записи, индексированные нормализованным составным ключом. */
	private readonly _cache = new Map<string, ICachedAnswerModel>();
	/** Ключи записей, чья одноразовая метка свежести ещё не была прочитана. */
	private readonly _fresh = new Set<string>();

	/**
	 * Возвращает ранее сохранённый ответ для указанной темы, вопроса и набора вариантов.
	 *
	 * Порядок элементов `variants` не участвует в сравнении ключей. При этом `idx`
	 * в найденной записи остаётся привязан к порядку вариантов из исходного вызова
	 * {@link AnswerCache.set} и не пересчитывается относительно аргумента этого метода.
	 *
	 * @param topic Название темы теста.
	 * @param question Текст вопроса.
	 * @param variants Полный набор предложенных вариантов ответа.
	 * @returns Сохранённую запись или `null`, если совпадающего ключа в кеше нет.
	 *
	 * @remarks
	 * Метод возвращает хранящийся в кеше объект, а не его копию. Полученную запись
	 * и её массивы нельзя изменять, если она должна оставаться согласованной с кешем.
	 */
	public get(topic: string, question: string, variants: string[]): ICachedAnswerModel | null {
		const id = makeId(topic, question, variants);
		return this._cache.get(id) ?? null;
	}

	/**
	 * Проверяет наличие записи, не читая и не сбрасывая её метку свежести.
	 *
	 * @param topic Название темы; `null` трактуется как пустая строка.
	 * @param question Текст вопроса; `null` трактуется как пустая строка.
	 * @param variants Полный набор вариантов ответа. Если в обход типов передать
	 * `null` или `undefined`, значение будет трактоваться как пустой массив.
	 * @returns `true`, если запись с таким нормализованным ключом уже существует.
	 */
	public has(topic: string | null, question: string | null, variants: string[]): boolean {
		const id = makeId(topic ?? '', question ?? '', variants ?? []);
		return this._cache.has(id);
	}

	/**
	 * Сохраняет правильные ответы и вычисляет их позиции в исходном массиве вариантов.
	 *
	 * Сопоставление `answers` с `variants` игнорирует регистр и пробелы по краям.
	 * Индексы записываются в порядке `variants`; ответы, которых в нём нет, не дают
	 * индекса. Повторный вызов с тем же нормализованным ключом заменяет старую запись
	 * и заново устанавливает одноразовую метку для {@link AnswerCache.fresh}.
	 *
	 * @param topic Название темы теста.
	 * @param question Текст вопроса.
	 * @param variants Полный набор вариантов ответа в текущем порядке на странице.
	 * @param answers Тексты правильных ответов. Массив копируется перед сохранением.
	 * @returns Созданную и сохранённую запись. Это тот же объект, который вернёт
	 * {@link AnswerCache.get}.
	 */
	public set(topic: string, question: string, variants: string[], answers: string[]): ICachedAnswerModel {
		const id = makeId(topic, question, variants);
		const idx = computeIdx(variants, answers);
		const entry: ICachedAnswerModel = {id, answers: [...answers], idx: [...idx]};
		this._cache.set(id, entry);
		this._fresh.add(id);
		return entry;
	}

	/**
	 * Читает одноразовую метку «только что записан» для указанного ключа.
	 *
	 * Каждый вызов {@link AnswerCache.set} устанавливает метку. Первый последующий вызов `fresh`
	 * для той же нормализованной тройки вернёт `true` и удалит метку; следующие вызовы
	 * будут возвращать `false` до новой записи через `set`. Вызовы {@link AnswerCache.get}
	 * и {@link AnswerCache.has} на метку не влияют.
	 *
	 * @param topic Название темы теста.
	 * @param question Текст вопроса.
	 * @param variants Полный набор предложенных вариантов ответа.
	 * @returns `true`, если непрочитанная метка существовала; иначе `false`.
	 */
	public fresh(topic: string, question: string, variants: string[]): boolean {
		const id = makeId(topic, question, variants);
		if (!this._fresh.has(id)) return false;
		this._fresh.delete(id);
		return true;
	}
}

/** Общий экземпляр кеша, используемый компонентами расширения. */
export const answerCache = new AnswerCache();

/**
 * Нормализует отдельную часть ключа или значение для сравнения.
 *
 * Удаляются только пробельные символы по краям строки. Внутренние пробелы
 * не схлопываются, Unicode-нормализация не выполняется.
 *
 * @param s Исходная строка.
 * @returns Строку без краевых пробелов, приведённую к нижнему регистру.
 */
const norm = (s: string): string => s.trim().toLowerCase();

/**
 * Строит внутренний идентификатор записи из темы, вопроса и вариантов.
 *
 * Каждый компонент нормализуется через {@link norm}. Варианты предварительно
 * копируются и сортируются, поэтому исходный массив не мутируется, а его порядок
 * не влияет на результат. Повторяющиеся варианты при этом сохраняются.
 *
 * @param topic Название темы теста.
 * @param question Текст вопроса.
 * @param variants Полный набор предложенных вариантов ответа.
 * @returns Детерминированный составной ключ для внутреннего `Map`.
 */
function makeId(topic: string, question: string, variants: string[]): string {
	const v = [...variants].map(norm).sort().join('|');
	return `${norm(topic)}::${norm(question)}::${v}`;
}

/**
 * Находит позиции правильных ответов в массиве вариантов.
 *
 * Сравнение выполняется по нормализованным строкам. Результат следует порядку
 * `variants`: если одинаковый правильный вариант встречается несколько раз,
 * в массив попадут все его позиции. Ответы, отсутствующие среди вариантов,
 * игнорируются. Входные массивы не изменяются.
 *
 * @param variants Варианты ответа в том порядке, в котором они показаны пользователю.
 * @param answers Тексты правильных ответов.
 * @returns 0-индексированные позиции всех совпавших вариантов.
 */
function computeIdx(variants: string[], answers: string[]): number[] {
	const normAnswers = new Set(answers.map(norm));
	const idx: number[] = [];
	variants.forEach((v, i) => {
		if (normAnswers.has(norm(v))) idx.push(i);
	});
	return idx;
}
