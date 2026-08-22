import {act, fireEvent, render, screen, waitFor} from '@testing-library/react';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import type {IVersionInfo} from '../../api/version-check';
import VersionCheck from './index';

const mocks = vi.hoisted(() => ({
	checkVersion: vi.fn(),
	isOutdated: vi.fn(),
}));

vi.mock('../../api/version-check', () => ({
	checkVersion: mocks.checkVersion,
	isOutdated: mocks.isOutdated,
}));

const CURRENT: IVersionInfo = {current: '4.3.0', latest: '4.3.0'};
const OUTDATED: IVersionInfo = {current: '4.3.0', latest: '4.4.0'};

describe('VersionCheck', () => {
	beforeEach(() => {
		vi.useRealTimers();
		mocks.checkVersion.mockReset().mockResolvedValue(CURRENT);
		mocks.isOutdated.mockReset().mockImplementation(
			(info: IVersionInfo) => info.current !== info.latest,
		);
	});

	afterEach(() => vi.useRealTimers());

	it('тихо выполняет автоматическую проверку при монтировании', async () => {
		const onOutdated = vi.fn();
		render(<VersionCheck onOutdated={onOutdated}/>);

		await waitFor(() => expect(mocks.checkVersion).toHaveBeenCalledWith(false));
		expect(onOutdated).not.toHaveBeenCalled();

		const button = screen.getByRole('button');
		expect(button).toHaveClass('idle');
		fireEvent.mouseEnter(button.parentElement!);
		expect(screen.getByText('Проверить обновления')).toBeInTheDocument();
	});

	it('сообщает родителю о найденном обновлении', async () => {
		mocks.checkVersion.mockResolvedValue(OUTDATED);
		const onOutdated = vi.fn();
		render(<VersionCheck onOutdated={onOutdated}/>);

		await waitFor(() => expect(onOutdated).toHaveBeenCalledWith(OUTDATED));

		const button = screen.getByRole('button');
		expect(button).toHaveClass('outdated');
		fireEvent.mouseEnter(button.parentElement!);
		expect(screen.getByText('Доступна новая версия')).toBeInTheDocument();
	});

	it('принудительно проверяет обновление по клику', async () => {
		const onOutdated = vi.fn();
		render(<VersionCheck onOutdated={onOutdated}/>);
		await waitFor(() => expect(mocks.checkVersion).toHaveBeenCalledWith(false));

		mocks.checkVersion.mockResolvedValueOnce(OUTDATED);
		fireEvent.click(screen.getByRole('button'));

		await waitFor(() => {
			expect(mocks.checkVersion).toHaveBeenCalledWith(true);
			expect(onOutdated).toHaveBeenCalledWith(OUTDATED);
		});
		expect(screen.getByRole('button')).toHaveClass('outdated');
	});

	it('блокирует повторный клик, пока ручная проверка не завершилась', async () => {
		let resolveCheck!: (info: IVersionInfo) => void;
		const pendingCheck = new Promise<IVersionInfo>(resolve => { resolveCheck = resolve; });
		render(<VersionCheck/>);
		await waitFor(() => expect(mocks.checkVersion).toHaveBeenCalledWith(false));

		mocks.checkVersion.mockReturnValueOnce(pendingCheck);
		const button = screen.getByRole('button');
		fireEvent.click(button);

		expect(button).toBeDisabled();
		expect(button).toHaveClass('checking');
		expect(screen.queryByText('Проверяю на сервере…')).not.toBeInTheDocument();
		fireEvent.click(button);
		expect(mocks.checkVersion).toHaveBeenCalledTimes(2);

		await act(async () => resolveCheck(CURRENT));
		expect(button).toBeEnabled();
		expect(button).toHaveClass('uptodate');
	});

	it('через 2,5 секунды возвращает успешную проверку в исходное состояние', async () => {
		vi.useFakeTimers();
		render(<VersionCheck/>);
		await act(async () => undefined);

		fireEvent.click(screen.getByRole('button'));
		await act(async () => undefined);
		expect(screen.getByRole('button')).toHaveClass('uptodate');

		act(() => vi.advanceTimersByTime(2499));
		expect(screen.getByRole('button')).toHaveClass('uptodate');
		act(() => vi.advanceTimersByTime(1));
		expect(screen.getByRole('button')).toHaveClass('idle');
	});

	it('возвращается в исходное состояние после ошибки ручной проверки', async () => {
		render(<VersionCheck/>);
		await waitFor(() => expect(mocks.checkVersion).toHaveBeenCalledWith(false));

		mocks.checkVersion.mockRejectedValueOnce(new Error('сеть недоступна'));
		fireEvent.click(screen.getByRole('button'));

		await waitFor(() => expect(screen.getByRole('button')).toHaveClass('idle'));
		expect(screen.getByRole('button')).toBeEnabled();
	});

	it('не обновляет состояние и не вызывает callback после размонтирования', async () => {
		let resolveCheck!: (info: IVersionInfo) => void;
		const pendingCheck = new Promise<IVersionInfo>(resolve => { resolveCheck = resolve; });
		mocks.checkVersion.mockReturnValueOnce(pendingCheck);
		const onOutdated = vi.fn();
		const {unmount} = render(<VersionCheck onOutdated={onOutdated}/>);
		await waitFor(() => expect(mocks.checkVersion).toHaveBeenCalledWith(false));

		unmount();
		await act(async () => resolveCheck(OUTDATED));

		expect(onOutdated).not.toHaveBeenCalled();
	});
});
