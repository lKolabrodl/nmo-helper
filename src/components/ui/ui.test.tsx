import {act, fireEvent, render, screen} from '@testing-library/react';
import {afterEach, describe, expect, it, vi} from 'vitest';
import Footer from './Footer';
import InlineToast from './InlineToast';
import ThinkingStrip from './ThinkingStrip';

describe('Footer', () => {
	it('запускает действие и показывает переданные подписи', () => {
		const onStart = vi.fn();
		render(<Footer canRun onStart={onStart} label="Найти ответ" hint="Проверьте вопрос"/>);

		fireEvent.click(screen.getByRole('button', {name: 'Найти ответ'}));

		expect(onStart).toHaveBeenCalledOnce();
		expect(screen.getByText('Проверьте вопрос')).toBeInTheDocument();
	});

	it('не запускает действие, когда кнопка заблокирована', () => {
		const onStart = vi.fn();
		render(<Footer canRun={false} onStart={onStart}/>);

		const button = screen.getByRole('button', {name: 'Запустить'});
		expect(button).toBeDisabled();
		fireEvent.click(button);

		expect(onStart).not.toHaveBeenCalled();
		expect(document.querySelector('.nmo-footer-hint')).not.toBeInTheDocument();
	});
});

describe('InlineToast', () => {
	it.each([
		['success', 'nmo-banner-success'],
		['warning', 'nmo-banner-warning'],
		['danger', 'nmo-banner-danger'],
	] as const)('отображает состояние %s', (kind, className) => {
		const {container} = render(
			<InlineToast toast={{kind, title: `Статус: ${kind}`, sub: 'Подробности'}}/>,
		);

		expect(screen.getByText(`Статус: ${kind}`)).toBeInTheDocument();
		expect(screen.getByText('Подробности')).toBeInTheDocument();
		expect(container.firstElementChild).toHaveClass('nmo-toast', className);
	});

	it('вызывает закрытие только когда передан обработчик', () => {
		const onClose = vi.fn();
		const {rerender} = render(
			<InlineToast toast={{kind: 'warning', title: 'Предупреждение'}} onClose={onClose}/>,
		);

		fireEvent.click(screen.getByRole('button'));
		expect(onClose).toHaveBeenCalledOnce();

		rerender(<InlineToast toast={{kind: 'warning', title: 'Предупреждение'}}/>);
		expect(screen.queryByRole('button')).not.toBeInTheDocument();
		expect(document.querySelector('.nmo-banner-sub')).not.toBeInTheDocument();
	});
});

describe('ThinkingStrip', () => {
	afterEach(() => vi.useRealTimers());

	it('по кругу переключает стандартные этапы', () => {
		vi.useFakeTimers();
		render(<ThinkingStrip/>);

		expect(screen.getByText('AI думает…')).toBeInTheDocument();
		expect(screen.getByText('Читаю вопросы…')).toBeInTheDocument();

		act(() => vi.advanceTimersByTime(800));
		expect(screen.getByText('Сверяю с базой…')).toBeInTheDocument();

		act(() => vi.advanceTimersByTime(1600));
		expect(screen.getByText('Читаю вопросы…')).toBeInTheDocument();
	});

	it('не запускает таймер для единственного этапа', () => {
		vi.useFakeTimers();
		const {unmount} = render(<ThinkingStrip title="Анализ" steps={['Один этап']}/>);

		expect(screen.getByText('Анализ')).toBeInTheDocument();
		expect(screen.getByText('Один этап')).toBeInTheDocument();
		expect(vi.getTimerCount()).toBe(0);

		unmount();
		expect(vi.getTimerCount()).toBe(0);
	});

	it('не показывает подзаголовок для пустого списка этапов', () => {
		const {container} = render(<ThinkingStrip title="Подготовка" steps={[]}/>);

		expect(screen.getByText('Подготовка')).toBeInTheDocument();
		expect(container.querySelector('.nmo-strip-sub')).not.toBeInTheDocument();
	});

	it('очищает интервал при размонтировании', () => {
		vi.useFakeTimers();
		const {unmount} = render(<ThinkingStrip/>);
		expect(vi.getTimerCount()).toBe(1);

		unmount();
		expect(vi.getTimerCount()).toBe(0);
	});
});
