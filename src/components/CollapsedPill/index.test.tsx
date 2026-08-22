import {fireEvent, render, screen} from '@testing-library/react';
import {beforeEach, describe, expect, it, vi} from 'vitest';
import {Status, type IStatusInfo} from '../../types';
import CollapsedPill from './index';

const context = vi.hoisted(() => ({
	status: {title: '', status: 'idle'} as IStatusInfo,
	setCollapsed: vi.fn(),
}));

vi.mock('../../contexts/PanelUiContext', () => ({
	usePanelUi: () => ({setCollapsed: context.setCollapsed}),
}));

vi.mock('../../contexts/PanelStatusContext', () => ({
	usePanelStatus: () => ({status: context.status}),
}));

describe('CollapsedPill', () => {
	beforeEach(() => {
		context.status = {title: '', status: Status.IDLE};
		context.setCollapsed.mockReset();
	});

	it('разворачивает панель по кнопке', () => {
		render(<CollapsedPill/>);

		fireEvent.click(screen.getByRole('button', {name: 'Развернуть'}));

		expect(context.setCollapsed).toHaveBeenCalledWith(false);
	});

	it('показывает нейтральное состояние по умолчанию', () => {
		const {container} = render(<CollapsedPill/>);

		expect(screen.getByText('NMO Helper')).toBeInTheDocument();
		expect(container.querySelector('.nmo-pill-icon')).toHaveClass(Status.IDLE);
		expect(container.querySelector('.nmo-pill-dot')).toBeInTheDocument();
	});

	it.each([
		{status: Status.LOADING, fallback: 'AI думает…', marker: '.nmo-spinner'},
		{status: Status.WARN, fallback: 'NMO Helper', marker: 'svg'},
		{status: Status.ERR, fallback: 'NMO Helper', marker: 'svg'},
		{status: Status.OK, fallback: 'NMO Helper', marker: 'svg'},
	] as const)('отображает маркер состояния $status', ({status, fallback, marker}) => {
		context.status = {title: '', status};
		const {container} = render(<CollapsedPill/>);

		expect(screen.getByText(fallback)).toBeInTheDocument();
		expect(container.querySelector('.nmo-pill-icon')).toHaveClass(status);
		expect(container.querySelector(`.nmo-pill-icon ${marker}`)).toBeInTheDocument();
		expect(container.querySelector('.nmo-pill-dot')).not.toBeInTheDocument();
	});

	it('использует текст текущего статуса вместо стандартной подписи', () => {
		context.status = {title: 'найдено в памяти', status: Status.OK};
		render(<CollapsedPill/>);

		expect(screen.getByText('найдено в памяти')).toBeInTheDocument();
		expect(screen.queryByText('NMO Helper')).not.toBeInTheDocument();
	});
});
