import './content.scss';
import type { IExtensionState } from './types';
import { storageGet } from './utils';
import { createPanel, initPanelBehavior } from './Panel';
import { unlockPageInteractions } from './api/page-interaction-unlock';
import {
	AUTO_SOLVE_DELAY_MAX_STORAGE_KEY,
	AUTO_SOLVE_DELAY_MIN_STORAGE_KEY,
	AUTO_SOLVE_STORAGE_KEY,
	DEFAULT_AUTO_SOLVE_DELAY_MAX_SECONDS,
	DEFAULT_AUTO_SOLVE_DELAY_MIN_SECONDS,
} from './contexts/SettingsContext';

/** Слушает сообщения от popup для экспорта кеша */
function initExportListener() {
	chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
		// if (msg?.type === 'EXPORT_JSON') sendResponse(answerCache.exportAll());
		// else if (msg?.type === 'EXPORT_CSV') sendResponse(answerCache.exportCsv());
	});
}

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

	const state: IExtensionState = {
		savedUrl: await storageGet('customUrl', ''),
		savedCollapsed: await storageGet('panelCollapsed', true),
		savedRight: await storageGet('panelRight', null),
		savedTop: await storageGet('panelTop', null),
		savedMode: await storageGet('mode', 'auto'),
		savedApiKey: await storageGet('apiKey', ''),
		savedModel: await storageGet('aiModel', 'gpt-4o-mini'),
		savedCustomAiUrl: await storageGet('customAiUrl', ''),
		savedCustomAiToken: await storageGet('customAiToken', ''),
		savedCustomAiModel: await storageGet('customAiModel', ''),
		savedAutoSolveEnabled: await storageGet(AUTO_SOLVE_STORAGE_KEY, false),
		savedAutoSolveDelayMinSeconds: await storageGet(
			AUTO_SOLVE_DELAY_MIN_STORAGE_KEY,
			DEFAULT_AUTO_SOLVE_DELAY_MIN_SECONDS
		),
		savedAutoSolveDelayMaxSeconds: await storageGet(
			AUTO_SOLVE_DELAY_MAX_STORAGE_KEY,
			DEFAULT_AUTO_SOLVE_DELAY_MAX_SECONDS
		),
	};

	const panel = createPanel(state);

	// Drag needs DOM to be rendered first
	requestAnimationFrame(() => initPanelBehavior(panel));
})();
