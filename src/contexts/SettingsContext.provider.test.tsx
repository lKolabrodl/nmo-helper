import type {PropsWithChildren} from 'react';
import {act, renderHook} from '@testing-library/react';
import {describe, expect, it} from 'vitest';
import type {IExtensionState} from '../types';
import {storageGet} from '../utils';
import {SettingsProvider, useSettings} from './SettingsContext';

function createInitialState(overrides: Partial<IExtensionState> = {}): IExtensionState {
	return {
		savedUrl: '',
		savedCollapsed: false,
		savedRight: null,
		savedTop: null,
		savedMode: 'ai',
		savedAiProvider: 'free',
		savedApiKey: '',
		savedModel: '',
		savedCustomAiUrl: '',
		savedCustomAiToken: '',
		savedCustomAiModel: '',
		savedAutoSolveEnabled: false,
		savedAutoSolveDelayMinSeconds: 5,
		savedAutoSolveDelayMaxSeconds: 12,
		...overrides,
	};
}

function createWrapper(initialState: IExtensionState) {
	return ({children}: PropsWithChildren) => (
		<SettingsProvider initialState={initialState}>
			{children}
		</SettingsProvider>
	);
}

describe('SettingsProvider nested API', () => {
	it('выдаёт сохранённые настройки по смысловым группам', () => {
		const initialState = createInitialState({
			savedAiProvider: 'custom',
			savedApiKey: 'proxy-key',
			savedModel: 'proxy-model',
			savedCustomAiUrl: 'https://ai.example/v1',
			savedCustomAiToken: 'custom-token',
			savedCustomAiModel: 'custom-model',
			savedAutoSolveEnabled: true,
			savedAutoSolveDelayMinSeconds: 8,
			savedAutoSolveDelayMaxSeconds: 15,
		});
		const {result} = renderHook(useSettings, {wrapper: createWrapper(initialState)});

		expect(result.current.ai).toMatchObject({
			provider: 'custom',
			proxy: {apiKey: 'proxy-key', model: 'proxy-model'},
			custom: {
				url: 'https://ai.example/v1',
				token: 'custom-token',
				model: 'custom-model',
			},
		});
		expect(result.current.autoSolve).toMatchObject({
			enabled: true,
			delayMinSeconds: 8,
			delayMaxSeconds: 15,
		});
	});

	it('сохраняет изменения по прежним плоским storage-ключам', async () => {
		const {result} = renderHook(useSettings, {wrapper: createWrapper(createInitialState())});

		act(() => {
			result.current.ai.setProvider('proxy');
			result.current.ai.proxy.setApiKey('next-proxy-key');
			result.current.ai.proxy.setModel('next-proxy-model');
			result.current.ai.custom.setUrl('https://custom.example/v1');
			result.current.ai.custom.setToken('next-custom-token');
			result.current.ai.custom.setModel('next-custom-model');
			result.current.autoSolve.setEnabled(true);
		});

		expect(result.current.ai).toMatchObject({
			provider: 'proxy',
			proxy: {apiKey: 'next-proxy-key', model: 'next-proxy-model'},
			custom: {
				url: 'https://custom.example/v1',
				token: 'next-custom-token',
				model: 'next-custom-model',
			},
		});
		expect(result.current.autoSolve.enabled).toBe(true);

		await expect(storageGet('aiProvider', '')).resolves.toBe('proxy');
		await expect(storageGet('apiKey', '')).resolves.toBe('next-proxy-key');
		await expect(storageGet('aiModel', '')).resolves.toBe('next-proxy-model');
		await expect(storageGet('customAiUrl', '')).resolves.toBe('https://custom.example/v1');
		await expect(storageGet('customAiToken', '')).resolves.toBe('next-custom-token');
		await expect(storageGet('customAiModel', '')).resolves.toBe('next-custom-model');
		await expect(storageGet('autoSolveTests', false)).resolves.toBe(true);
	});

	it('сохраняет максимальную задержку не меньше минимальной', async () => {
		const initialState = createInitialState({
			savedAutoSolveDelayMinSeconds: 10,
			savedAutoSolveDelayMaxSeconds: 12,
		});
		const {result} = renderHook(useSettings, {wrapper: createWrapper(initialState)});

		act(() => result.current.autoSolve.setDelayMinSeconds(20));

		expect(result.current.autoSolve.delayMinSeconds).toBe(20);
		expect(result.current.autoSolve.delayMaxSeconds).toBe(20);
		await expect(storageGet('autoSolveDelayMinSeconds', 0)).resolves.toBe(20);
		await expect(storageGet('autoSolveDelayMaxSeconds', 0)).resolves.toBe(20);

		act(() => result.current.autoSolve.setDelayMaxSeconds(7));

		expect(result.current.autoSolve.delayMaxSeconds).toBe(20);
		await expect(storageGet('autoSolveDelayMaxSeconds', 0)).resolves.toBe(20);
	});
});
