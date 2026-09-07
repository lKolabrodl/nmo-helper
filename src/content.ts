import './content.scss';
import type { IExtensionState } from './types';
import { storageGet, storageSet } from './utils';
import { createPanel, initPanelBehavior } from './Panel';
import { unlockPageInteractions } from './api/page-interaction-unlock';
import {DEFAULT_AI_MODEL, normalizeAiModel} from './utils/constants';
import {
	AI_PROVIDER_STORAGE_KEY,
	AUTO_SOLVE_DELAY_MAX_STORAGE_KEY,
	AUTO_SOLVE_DELAY_MIN_STORAGE_KEY,
	AUTO_SOLVE_STORAGE_KEY,
	DEFAULT_AUTO_SOLVE_DELAY_MAX_SECONDS,
	DEFAULT_AUTO_SOLVE_DELAY_MIN_SECONDS,
	DEFAULT_TEST_DATA_SHARING_ENABLED,
	TEST_DATA_SHARING_STORAGE_KEY,
	normalizeAiProvider,
} from './contexts/SettingsContext';

function waitForBody(): Promise<void> {
	if (document.body) return Promise.resolve();

	return new Promise(resolve => {
		let observer: MutationObserver | null = null;

		const finish = (): void => {
			if (!document.body) return;

			observer?.disconnect();
			document.removeEventListener('DOMContentLoaded', finish);
			resolve();
		};

		observer = new MutationObserver(finish);
		observer.observe(document.documentElement, {childList: true, subtree: true});
		document.addEventListener('DOMContentLoaded', finish);
	});
}

unlockPageInteractions();

(async function () {
	'use strict';

	await waitForBody();
	const storedModel = await storageGet('aiModel', DEFAULT_AI_MODEL);
	const savedModel = normalizeAiModel(storedModel);
	if (savedModel !== storedModel) storageSet('aiModel', savedModel);
	const storedMode = await storageGet('mode', 'auto');
	const storedAiProvider = await storageGet<unknown>(AI_PROVIDER_STORAGE_KEY, null);
	const savedMode = storedMode === 'ai-pro' ? 'ai' : storedMode;
	const savedAiProvider = normalizeAiProvider(storedAiProvider, storedMode);
	if (savedMode !== storedMode) storageSet('mode', savedMode);
	if (savedAiProvider !== storedAiProvider) storageSet(AI_PROVIDER_STORAGE_KEY, savedAiProvider);

	const state: IExtensionState = {
		savedUrl: await storageGet('customUrl', ''),
		savedCollapsed: await storageGet('panelCollapsed', true),
		savedRight: await storageGet('panelRight', null),
		savedTop: await storageGet('panelTop', null),
		savedMode,
		savedAiProvider,
		savedApiKey: await storageGet('apiKey', ''),
		savedModel,
		savedCustomAiUrl: await storageGet('customAiUrl', ''),
		savedCustomAiToken: await storageGet('customAiToken', ''),
		savedCustomAiModel: await storageGet('customAiModel', ''),
		savedAutoSolveEnabled: await storageGet(AUTO_SOLVE_STORAGE_KEY, false),
		savedAutoSolveDelayMinSeconds: await storageGet(AUTO_SOLVE_DELAY_MIN_STORAGE_KEY, DEFAULT_AUTO_SOLVE_DELAY_MIN_SECONDS),
		savedAutoSolveDelayMaxSeconds: await storageGet(AUTO_SOLVE_DELAY_MAX_STORAGE_KEY, DEFAULT_AUTO_SOLVE_DELAY_MAX_SECONDS),
		savedTestDataSharingEnabled: await storageGet(TEST_DATA_SHARING_STORAGE_KEY, DEFAULT_TEST_DATA_SHARING_ENABLED),
	};

	const panel = createPanel(state);

	// Drag needs DOM to be rendered first
	requestAnimationFrame(() => initPanelBehavior(panel));
})();
