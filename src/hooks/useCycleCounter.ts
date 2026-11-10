import {useEffect, useState} from 'react';

const MOUSE_IDLE_MS = 1500;

/**
 * Увеличивает count после каждого случайного интервала min–max секунд.
 * Движение мыши прерывает интервал: новый начинается после 1,5 с покоя.
 * При выключении счётчик сохраняется, таймеры и подписка удаляются.
 */
export function useCycleCounter(enabled: boolean, min: number, max: number): number {
	const [count, setCount] = useState(0);

	useEffect(() => {
		if (!enabled) return;

		let cycleTimer = 0;
		let idleTimer = 0;

		const scheduleCycle = (): void => {
			const delay = Math.round((min + Math.random() * (max - min)) * 1000);
			cycleTimer = window.setTimeout(() => {
				setCount(value => value + 1);
				scheduleCycle();
			}, delay);
		};

		const onMouseMove = (): void => {
			window.clearTimeout(cycleTimer);
			window.clearTimeout(idleTimer);
			idleTimer = window.setTimeout(scheduleCycle, MOUSE_IDLE_MS);
		};

		scheduleCycle();
		document.addEventListener('mousemove', onMouseMove);

		return () => {
			window.clearTimeout(cycleTimer);
			window.clearTimeout(idleTimer);
			document.removeEventListener('mousemove', onMouseMove);
		};
	}, [enabled, min, max]);

	return count;
}
