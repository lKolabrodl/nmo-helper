import {fireEvent, render, screen} from '@testing-library/react';
import {beforeEach, describe, expect, it, vi} from 'vitest';
import TabBar from './index';

const testState = vi.hoisted(() => ({
	setMode: vi.fn(),
	setStatus: vi.fn(),
}));

vi.mock('../../contexts/PanelUiContext', () => ({
	usePanelUi: () => ({mode: 'sites', setMode: testState.setMode}),
}));

vi.mock('../../contexts/PanelStatusContext', () => ({
	usePanelStatus: () => ({setStatus: testState.setStatus}),
}));

describe('TabBar', () => {
	beforeEach(() => vi.clearAllMocks());

	it('сбрасывает статус перед переключением режима', () => {
		fireEvent.click(render(<TabBar/>).getByRole('button', {name: 'Авто'}));

		expect(testState.setStatus).toHaveBeenCalledWith({title: '', status: 'idle'});
		expect(testState.setMode).toHaveBeenCalledWith('auto');
		expect(testState.setStatus.mock.invocationCallOrder[0])
			.toBeLessThan(testState.setMode.mock.invocationCallOrder[0]);
	});

	it('не сбрасывает статус при клике по активному режиму', () => {
		render(<TabBar/>);
		fireEvent.click(screen.getByRole('button', {name: 'Сайты'}));

		expect(testState.setStatus).not.toHaveBeenCalled();
		expect(testState.setMode).not.toHaveBeenCalled();
	});
});
