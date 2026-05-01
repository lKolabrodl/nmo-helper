import './content.scss';
import type { IExtensionState } from './types';
import { storageGet } from './utils';
import { createPanel, initPanelBehavior } from './Panel';

/** Слушает сообщения от popup для экспорта кеша */
function initExportListener() {
	chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
		// if (msg?.type === 'EXPORT_JSON') sendResponse(answerCache.exportAll());
		// else if (msg?.type === 'EXPORT_CSV') sendResponse(answerCache.exportCsv());
	});
}

(async function () {
	'use strict';

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
	};

	const panel = createPanel(state);

	// Drag needs DOM to be rendered first
	requestAnimationFrame(() => initPanelBehavior(panel));
})();
