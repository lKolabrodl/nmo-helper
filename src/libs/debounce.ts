/**
 * Локальная замена `lodash-es/debounce`.
 *
 * Причина: `lodash-es` внутри использует `Function("return this")()` для получения
 * глобального объекта. В Firefox MV3 content-scripts этот вызов блокируется CSP
 * (`call to Function() blocked by CSP`), и весь бандл падает при загрузке.
 * Свой debounce не тянет `_root`/`_freeGlobal` и работает в любом контексте.
 *
 * Задерживает вызов `fn` на `wait` мс с момента ПОСЛЕДНЕГО вызова обёртки.
 * Метод `.cancel()` снимает отложенный вызов без исполнения.
 */
export function debounce<T extends (...args: never[]) => unknown>(fn: T, wait: number) {
	let timer: ReturnType<typeof setTimeout> | undefined;

	const debounced = ((...args: Parameters<T>) => {
		if (timer) clearTimeout(timer);
		timer = setTimeout(() => fn(...args), wait);
	}) as T & { cancel: () => void };

	debounced.cancel = () => {
		if (timer) {
			clearTimeout(timer);
			timer = undefined;
		}
	};

	return debounced;
}
