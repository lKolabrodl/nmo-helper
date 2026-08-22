import {fireEvent, render, screen} from '@testing-library/react';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import type {IVersionInfo} from '../../api/version-check';
import {Status, type IStatusInfo} from '../../types';
import {UPDATE_URL} from '../../utils/constants';
import Header from './index';

interface IQuestionState {
	topic: string | null;
	rawTopic: string | null;
	question: string | null;
	variants: string[];
	isSingle: boolean;
}

const context = vi.hoisted(() => ({
	setCollapsed: vi.fn(),
	status: {title: '', status: 'idle'} as IStatusInfo,
	question: {
		topic: null,
		rawTopic: null,
		question: null,
		variants: [],
		isSingle: false,
	} as IQuestionState,
}));

vi.mock('../../contexts/PanelUiContext', () => ({
	usePanelUi: () => ({setCollapsed: context.setCollapsed}),
}));

vi.mock('../../contexts/PanelStatusContext', () => ({
	usePanelStatus: () => ({status: context.status}),
}));

vi.mock('../../contexts/QuestionFinderContext', () => ({
	useQuestionFinder: () => context.question,
}));

vi.mock('../VersionCheck', () => ({
	default: ({onOutdated}: {readonly onOutdated?: (info: IVersionInfo) => void}) => (
		<button
			type="button"
			onClick={() => onOutdated?.({current: '4.3.0', latest: '4.4.0'})}>
			Имитировать обновление
		</button>
	),
}));

vi.mock('../Settings', () => ({
	default: ({onOpen}: {readonly onOpen?: () => void}) => (
		<button type="button" onClick={onOpen}>Настройки</button>
	),
}));

vi.mock('../BugReportButton', () => ({
	default: ({isOpen, onClose}: {readonly isOpen?: boolean; readonly onClose?: () => void}) => (
		<div data-testid="bug-report" data-open={String(!!isOpen)}>
			{isOpen && <button type="button" onClick={onClose}>Закрыть отчёт</button>}
		</div>
	),
}));

describe('Header', () => {
	beforeEach(() => {
		context.setCollapsed.mockReset();
		context.status = {title: '', status: Status.IDLE};
		context.question = {
			topic: null,
			rawTopic: null,
			question: null,
			variants: [],
			isSingle: false,
		};
	});

	afterEach(() => vi.restoreAllMocks());

	it('показывает нейтральную подсказку, когда тест не найден', () => {
		const {container} = render(<Header/>);

		expect(screen.getByText('NMO Helper')).toBeInTheDocument();
		expect(screen.getByText('Тест не определён')).toBeInTheDocument();
		expect(screen.getByText('Откройте страницу с вопросами НМО')).toBeInTheDocument();
		expect(container.querySelector('.nmo-brand-dot')).toHaveClass(Status.IDLE);
		expect(screen.queryByTitle('Сообщить о проблеме')).not.toBeInTheDocument();
		expect(screen.queryByTestId('bug-report')).not.toBeInTheDocument();
	});

	it('открывает и закрывает отчёт только для вопроса с вариантами', () => {
		context.question = {
			topic: 'Кардиология',
			rawTopic: 'Кардиология - 2026 - Итоговое тестирование',
			question: 'Какой ответ верный?',
			variants: ['Первый', 'Второй'],
			isSingle: true,
		};
		render(<Header/>);

		const report = screen.getByTestId('bug-report');
		expect(report).toHaveAttribute('data-open', 'false');
		fireEvent.click(screen.getByTitle('Сообщить о проблеме'));
		expect(report).toHaveAttribute('data-open', 'true');

		fireEvent.click(screen.getByRole('button', {name: 'Закрыть отчёт'}));
		expect(report).toHaveAttribute('data-open', 'false');
	});

	it('закрывает отчёт при открытии настроек', () => {
		context.question = {
			topic: 'Тема',
			rawTopic: 'Тема',
			question: 'Вопрос',
			variants: ['Ответ'],
			isSingle: true,
		};
		render(<Header/>);
		fireEvent.click(screen.getByTitle('Сообщить о проблеме'));
		expect(screen.getByTestId('bug-report')).toHaveAttribute('data-open', 'true');

		fireEvent.click(screen.getByRole('button', {name: 'Настройки'}));

		expect(screen.getByTestId('bug-report')).toHaveAttribute('data-open', 'false');
	});

	it('сворачивает панель из titlebar', () => {
		render(<Header/>);

		fireEvent.click(screen.getByRole('button', {name: 'Свернуть'}));

		expect(context.setCollapsed).toHaveBeenCalledWith(true);
	});

	it('показывает и закрывает баннер обновления', () => {
		render(<Header/>);

		fireEvent.click(screen.getByRole('button', {name: 'Имитировать обновление'}));

		expect(screen.getByText('Доступна v4.4.0')).toBeInTheDocument();
		expect(screen.getByText('у вас v4.3.0 — обновите расширение')).toBeInTheDocument();
		expect(screen.getByRole('link', {name: 'Обновить'})).toHaveAttribute('href', UPDATE_URL);
		expect(screen.getByRole('link', {name: 'Обновить'})).toHaveAttribute('target', '_blank');

		fireEvent.click(document.querySelector<HTMLButtonElement>('.nmo-update-close')!);
		expect(screen.queryByText('Доступна v4.4.0')).not.toBeInTheDocument();
	});

	it('оставляет короткое название теста без переключателя', () => {
		context.question.topic = 'Короткая тема';
		const {container} = render(<Header/>);

		const title = screen.getByText('Короткая тема');
		expect(title).not.toHaveAttribute('title');
		expect(container.querySelector('.nmo-topic-toggle')).not.toBeInTheDocument();
	});

	it('раскрывает длинную тему и сворачивает её при смене теста', () => {
		vi.spyOn(HTMLElement.prototype, 'scrollHeight', 'get').mockReturnValue(80);
		vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(20);
		context.question.topic = 'Очень длинное название теста';
		const {rerender} = render(<Header/>);

		const title = screen.getByText('Очень длинное название теста');
		expect(title).toHaveAttribute('title', 'Очень длинное название теста');
		fireEvent.click(screen.getByRole('button', {name: 'показать полностью →'}));
		expect(title).toHaveClass('expanded');
		expect(screen.getByRole('button', {name: 'свернуть ←'})).toBeInTheDocument();

		context.question.topic = 'Другая длинная тема';
		rerender(<Header/>);

		expect(screen.getByText('Другая длинная тема')).not.toHaveClass('expanded');
		expect(screen.getByRole('button', {name: 'показать полностью →'})).toBeInTheDocument();
	});
});
