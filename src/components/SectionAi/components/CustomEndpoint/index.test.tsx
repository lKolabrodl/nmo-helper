import {act, fireEvent, screen, waitFor} from '@testing-library/react';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {validateApiKey} from '../../../../api/fetch/fetch-ai';
import {renderWithProviders} from '../../../../tests-helpers';
import CustomEndpoint from './index';

vi.mock('../../../../api/fetch/fetch-ai', () => ({validateApiKey: vi.fn()}));
vi.mock('../../../Loader/AIProxyLoader', () => ({default: () => null}));

const onBusyChange = vi.fn();
const runtime = chrome.runtime as unknown as {
	sendMessage: (message: unknown, callback: (response: unknown) => void) => void;
};

beforeEach(() => {
	vi.clearAllMocks();
	vi.stubGlobal('__BUILD_TARGET__', 'chrome-store');
	vi.mocked(validateApiKey).mockResolvedValue(true);
});

afterEach(() => {
	vi.restoreAllMocks();
	vi.stubGlobal('__BUILD_TARGET__', 'chrome');
});

function fillEndpoint() {
	renderWithProviders(<CustomEndpoint onBusyChange={onBusyChange}/>, {initialMode: 'ai', initialAiProvider: 'custom'});
	fireEvent.change(screen.getByLabelText('API Endpoint'), {target: {value: 'https://api.example.com/v1/chat/completions'}});
	fireEvent.change(screen.getByLabelText('API Token'), {target: {value: 'secret-token'}});
	fireEvent.change(screen.getByLabelText('Модель'), {target: {value: 'custom-model'}});
}

describe('CustomEndpoint permissions', () => {
	it('ждёт согласия до проверки ключа и блокирует поля на время запроса', async () => {
		let respond: (response: unknown) => void = () => {};
		const sendMessage = vi.spyOn(runtime, 'sendMessage').mockImplementation((_message, callback) => { respond = callback; });
		fillEndpoint();

		fireEvent.click(screen.getByRole('button', {name: 'Запустить AI'}));

		expect(sendMessage).toHaveBeenCalledTimes(1);
		expect(validateApiKey).not.toHaveBeenCalled();
		expect(screen.getByRole('button', {name: 'Запустить AI'})).toBeDisabled();
		expect(screen.getByLabelText('API Endpoint')).toBeDisabled();
		expect(onBusyChange).toHaveBeenLastCalledWith(true);

		await act(async () => respond({granted: true}));

		expect(validateApiKey).toHaveBeenCalledWith('secret-token', 'custom-model', 'https://api.example.com/v1/chat/completions');
		expect(screen.getByRole('button', {name: 'Остановить'})).toBeEnabled();
	});

	it('при отказе не проверяет ключ и позволяет повторить запрос', async () => {
		const sendMessage = vi.spyOn(runtime, 'sendMessage').mockImplementation((_message, callback) => callback({granted: false}));
		fillEndpoint();
		fireEvent.click(screen.getByRole('button', {name: 'Запустить AI'}));

		await waitFor(() => expect(screen.getByRole('button', {name: 'Запустить AI'})).toBeEnabled());
		expect(screen.getByText('доступ к endpoint не разрешён; AI не запущен')).toBeInTheDocument();
		expect(validateApiKey).not.toHaveBeenCalled();
		expect(onBusyChange).toHaveBeenLastCalledWith(false);

		sendMessage.mockImplementation((_message, callback) => callback({granted: true}));
		fireEvent.click(screen.getByRole('button', {name: 'Запустить AI'}));
		await screen.findByRole('button', {name: 'Остановить'});
	});

	it('запрашивает доступ к новому адресу после смены endpoint', async () => {
		const sendMessage = vi.spyOn(runtime, 'sendMessage').mockImplementation((_message, callback) => callback({granted: true}));
		fillEndpoint();
		fireEvent.click(screen.getByRole('button', {name: 'Запустить AI'}));
		fireEvent.click(await screen.findByRole('button', {name: 'Остановить'}));
		fireEvent.change(screen.getByLabelText('API Endpoint'), {target: {value: 'https://other.example.com/v1'}});
		fireEvent.click(screen.getByRole('button', {name: 'Запустить AI'}));

		await screen.findByRole('button', {name: 'Остановить'});
		expect(sendMessage).toHaveBeenLastCalledWith({action: 'requestHostPermission', url: 'https://other.example.com/v1'}, expect.any(Function));
		expect(validateApiKey).toHaveBeenLastCalledWith('secret-token', 'custom-model', 'https://other.example.com/v1');
	});

	it('при ошибке браузера разблокирует запуск без обращения к endpoint', async () => {
		vi.spyOn(runtime, 'sendMessage').mockImplementation((_message, callback) => callback({granted: false, message: 'permission failed'}));
		fillEndpoint();
		fireEvent.click(screen.getByRole('button', {name: 'Запустить AI'}));

		await screen.findByText('permission failed');
		expect(validateApiKey).not.toHaveBeenCalled();
		expect(screen.getByLabelText('API Endpoint')).toBeEnabled();
		expect(onBusyChange).toHaveBeenLastCalledWith(false);
	});

	it('не отправляет запрос разрешения для неверного URL', async () => {
		const sendMessage = vi.spyOn(runtime, 'sendMessage');
		fillEndpoint();
		fireEvent.change(screen.getByLabelText('API Endpoint'), {target: {value: 'https://*/*'}});
		fireEvent.click(screen.getByRole('button', {name: 'Запустить AI'}));

		await waitFor(() => expect(screen.getByRole('button', {name: 'Запустить AI'})).toBeEnabled());
		expect(sendMessage).not.toHaveBeenCalled();
		expect(validateApiKey).not.toHaveBeenCalled();
	});
});
