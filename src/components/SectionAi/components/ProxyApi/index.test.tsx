import {act, fireEvent, screen, waitFor, within} from '@testing-library/react';
import {beforeEach, describe, expect, it, vi} from 'vitest';
import type {IAiModel} from '../../../../types';
import {storageGet} from '../../../../api/storage';
import {fetchModels, getCachedModels, type IModelsResult} from '../../../../api/fetch/fetch-models';
import {validateApiKey} from '../../../../api/fetch/fetch-ai';
import {renderWithProviders} from '../../../../tests-helpers';
import SectionAi from '../../index';
import ProxyApi from './index';

vi.mock('../../../../api/fetch/fetch-models', () => ({fetchModels: vi.fn(), getCachedModels: vi.fn()}));
vi.mock('../../../../api/fetch/fetch-ai', () => ({validateApiKey: vi.fn().mockResolvedValue(true)}));
vi.mock('../../../Loader/AIProxyLoader', () => ({default: () => null}));

const fast: IAiModel = {id: 'vendor/fast', name: 'Fast', vendor: 'vendor', inputPrice: 100, outputPrice: 300, tier: 'medium', tag: 'rec'};
const premium: IAiModel = {id: 'other/premium', name: 'Premium', vendor: 'other', inputPrice: 1000, outputPrice: 8000, tier: 'ultra', tag: 'pricey'};

function deferred<T>() {
	let resolve!: (value: T) => void;
	const promise = new Promise<T>(done => { resolve = done; });
	return {promise, resolve};
}

beforeEach(() => {
	vi.clearAllMocks();
	vi.mocked(getCachedModels).mockResolvedValue([]);
	vi.mocked(fetchModels).mockResolvedValue({models: [fast, premium]});
	vi.mocked(validateApiKey).mockResolvedValue(true);
});

describe('динамические модели ProxyAPI', () => {
	it('показывает кэш сразу, позволяет искать и выбирать модель во время обновления', async () => {
		const fresh = deferred<IModelsResult>();
		vi.mocked(getCachedModels).mockResolvedValue([fast, premium]);
		vi.mocked(fetchModels).mockReturnValue(fresh.promise);
		renderWithProviders(<ProxyApi onBusyChange={() => {}}/>, {initialAiProvider: 'proxy', initialApiKey: 'key', initialAiModel: fast.id});

		await waitFor(() => expect(screen.getByRole('combobox', {name: 'Модель'})).toBeEnabled());
		expect(screen.getByRole('combobox')).toHaveTextContent('Fast');
		expect(screen.getByText('обновляю модели и цены…')).toBeInTheDocument();
		fireEvent.click(screen.getByRole('combobox'));
		expect(within(screen.getByRole('option', {name: /Fast/})).getByTitle('Рекомендована по цене и возможностям')).toBeInTheDocument();
		expect(screen.getByTitle('Примерная цена вопроса более чем в 3 раза выше медианы списка')).toHaveTextContent('$$$');
		expect(screen.getByText('Примерная цена одного вопроса')).toBeInTheDocument();
		expect(screen.queryByText(/млн токенов|Контекст:|Чтение кэша|Запись кэша/)).not.toBeInTheDocument();
		fireEvent.change(screen.getByRole('searchbox', {name: 'Поиск модели'}), {target: {value: 'other/premium'}});
		expect(screen.getAllByRole('option')).toHaveLength(1);
		fireEvent.click(screen.getByRole('option', {name: /Premium/}));
		expect(screen.getByRole('combobox')).toHaveTextContent('Premium');

		await waitFor(() => expect(fetchModels).toHaveBeenCalledWith('key'));
		await act(async () => fresh.resolve({models: [fast, {...premium, outputPrice: 9000}]}));
		expect(screen.getByRole('combobox')).toHaveTextContent('Premium');
		expect(screen.getByText('≈0,34 ₽ за вопрос')).toBeInTheDocument();
		expect(await storageGet('aiModel', '')).toBe(premium.id);
		expect(screen.queryByText('обновляю модели и цены…')).not.toBeInTheDocument();
	});

	it('при каждом переходе на ProxyAPI читает кэш и запускает свежий запрос', async () => {
		renderWithProviders(<SectionAi/>, {initialMode: 'ai'});
		expect(fetchModels).not.toHaveBeenCalled();
		fireEvent.click(screen.getByRole('tab', {name: 'ProxyAPI'}));
		await waitFor(() => expect(fetchModels).toHaveBeenCalledTimes(1));

		fireEvent.click(screen.getByRole('tab', {name: 'Бесплатно'}));
		fireEvent.click(screen.getByRole('tab', {name: 'ProxyAPI'}));
		await waitFor(() => expect(fetchModels).toHaveBeenCalledTimes(2));
		expect(getCachedModels).toHaveBeenCalledTimes(2);
	});

	it('сохраняет выбор и работающий список при сбое обновления', async () => {
		vi.mocked(getCachedModels).mockResolvedValue([fast, premium]);
		vi.mocked(fetchModels).mockRejectedValue(new Error('ошибка сети'));
		renderWithProviders(<ProxyApi onBusyChange={() => {}}/>, {initialAiProvider: 'proxy', initialAiModel: premium.id});

		await screen.findByText('ошибка сети — показан сохранённый список');
		expect(screen.getByRole('combobox')).toHaveTextContent('Premium');
		expect(screen.getByRole('combobox')).toBeEnabled();
	});

	it('без кэша показывает ошибку и не запускает AI с невыбранной моделью', async () => {
		vi.mocked(fetchModels).mockRejectedValue(new Error('каталог недоступен'));
		renderWithProviders(<ProxyApi onBusyChange={() => {}}/>, {initialAiProvider: 'proxy'});

		await screen.findByText('каталог недоступен');
		expect(screen.getByRole('combobox')).toBeDisabled();
		expect(screen.getByRole('button', {name: 'Запустить AI'})).toBeDisabled();
	});

	it('при отказе выбранной модели показывает причину и позволяет выбрать другую для запуска', async () => {
		const message = 'модель не найдена или недоступна — выберите другую';
		vi.mocked(getCachedModels).mockResolvedValue([fast, premium]);
		vi.mocked(validateApiKey).mockRejectedValueOnce(new Error(message));
		const onBusyChange = vi.fn();
		renderWithProviders(<ProxyApi onBusyChange={onBusyChange}/>, {initialAiProvider: 'proxy', initialApiKey: 'key', initialAiModel: premium.id});

		await waitFor(() => expect(screen.getByRole('button', {name: 'Запустить AI'})).toBeEnabled());
		fireEvent.click(screen.getByRole('button', {name: 'Запустить AI'}));
		await screen.findByText(message);
		expect(onBusyChange).toHaveBeenLastCalledWith(false);
		expect(screen.queryByRole('button', {name: 'Остановить'})).not.toBeInTheDocument();
		expect(screen.getByRole('combobox')).toBeEnabled();

		fireEvent.click(screen.getByRole('combobox'));
		fireEvent.click(screen.getByRole('option', {name: /Fast/}));
		fireEvent.click(screen.getByRole('button', {name: 'Запустить AI'}));
		await screen.findByRole('button', {name: 'Остановить'});
		expect(validateApiKey).toHaveBeenLastCalledWith('key', fast.id);
	});

	it('заменяет исчезнувшую модель только после успешного свежего ответа', async () => {
		const fresh = deferred<IModelsResult>();
		vi.mocked(getCachedModels).mockResolvedValue([fast]);
		vi.mocked(fetchModels).mockReturnValue(fresh.promise);
		renderWithProviders(<ProxyApi onBusyChange={() => {}}/>, {initialAiProvider: 'proxy', initialAiModel: 'vendor/retired'});

		await waitFor(() => expect(screen.getByRole('combobox')).toBeEnabled());
		expect(screen.getByRole('combobox')).toHaveTextContent('vendor/retired');
		await waitFor(() => expect(fetchModels).toHaveBeenCalled());
		await act(async () => fresh.resolve({models: [fast]}));
		expect(screen.getByRole('combobox')).toHaveTextContent('Fast');
		expect(await storageGet('aiModel', '')).toBe(fast.id);
	});

	it('игнорирует поздний ответ после смены API-ключа', async () => {
		const oldRequest = deferred<IModelsResult>();
		vi.mocked(fetchModels).mockImplementation(key => key === 'old-key' ? oldRequest.promise : Promise.resolve({models: [premium]}));
		renderWithProviders(<ProxyApi onBusyChange={() => {}}/>, {initialAiProvider: 'proxy', initialApiKey: 'old-key'});
		await waitFor(() => expect(fetchModels).toHaveBeenCalledWith('old-key'));

		fireEvent.change(screen.getByLabelText('API-ключ ProxyAPI'), {target: {value: 'new-key'}});
		await waitFor(() => expect(screen.getByRole('combobox')).toHaveTextContent('Premium'));
		await act(async () => oldRequest.resolve({models: [fast]}));
		expect(screen.getByRole('combobox')).toHaveTextContent('Premium');
		expect(await storageGet('aiModel', '')).toBe(premium.id);
	});
});
