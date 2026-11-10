import {act, cleanup, fireEvent, renderHook} from '@testing-library/react';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {useCycleCounter} from './useCycleCounter';

beforeEach(() => vi.useFakeTimers());

afterEach(() => {
	cleanup();
	vi.useRealTimers();
	vi.restoreAllMocks();
});

function advanceTime(ms: number): void {
	act(() => vi.advanceTimersByTime(ms));
}

describe('useCycleCounter', () => {
	it('возвращает число завершённых циклов, начиная с нуля', () => {
		const {result} = renderHook(() => useCycleCounter(true, 2, 2));
		expect(result.current).toBe(0);
		advanceTime(1999);
		expect(result.current).toBe(0);
		advanceTime(1);
		expect(result.current).toBe(1);
		advanceTime(2000);
		expect(result.current).toBe(2);
	});

	it('выбирает новый случайный интервал для каждого цикла', () => {
		vi.spyOn(Math, 'random').mockReturnValueOnce(0).mockReturnValueOnce(1).mockReturnValue(0.5);
		const {result} = renderHook(() => useCycleCounter(true, 2, 4));
		advanceTime(2000);
		expect(result.current).toBe(1);
		advanceTime(3999);
		expect(result.current).toBe(1);
		advanceTime(1);
		expect(result.current).toBe(2);
		advanceTime(2999);
		expect(result.current).toBe(2);
		advanceTime(1);
		expect(result.current).toBe(3);
	});

	it('останавливается при enabled=false и продолжает счёт после включения', () => {
		const {result, rerender} = renderHook(({enabled}) => useCycleCounter(enabled, 2, 2), {
			initialProps: {enabled: false},
		});
		advanceTime(10000);
		expect(result.current).toBe(0);
		rerender({enabled: true});
		advanceTime(2000);
		expect(result.current).toBe(1);
		rerender({enabled: false});
		advanceTime(10000);
		expect(result.current).toBe(1);
		rerender({enabled: true});
		advanceTime(2000);
		expect(result.current).toBe(2);
	});

	it('не меняет count при движении мыши и начинает новый цикл после покоя', () => {
		const {result} = renderHook(() => useCycleCounter(true, 2, 2));
		advanceTime(1800);
		fireEvent.mouseMove(document);
		advanceTime(1000);
		fireEvent.mouseMove(document);
		advanceTime(1499);
		expect(result.current).toBe(0);
		advanceTime(1);
		advanceTime(1999);
		expect(result.current).toBe(0);
		advanceTime(1);
		expect(result.current).toBe(1);
	});

	it('меняет интервал только при изменении входных параметров', () => {
		const {result, rerender} = renderHook(({min, max}) => useCycleCounter(true, min, max), {
			initialProps: {min: 2, max: 2},
		});
		advanceTime(1500);
		rerender({min: 2, max: 2});
		advanceTime(500);
		expect(result.current).toBe(1);
		rerender({min: 5, max: 5});
		advanceTime(4999);
		expect(result.current).toBe(1);
		advanceTime(1);
		expect(result.current).toBe(2);
	});

	it.each([false, true])('удаляет таймеры и подписку при размонтировании (мышь активна: %s)', mouseActive => {
		const {unmount} = renderHook(() => useCycleCounter(true, 2, 2));
		if (mouseActive) fireEvent.mouseMove(document);
		unmount();
		expect(vi.getTimerCount()).toBe(0);
		fireEvent.mouseMove(document);
		expect(vi.getTimerCount()).toBe(0);
	});
});
