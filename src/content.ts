import './content.scss';
import type { IExtensionState } from './types';
import { storageGet } from './utils';
import { createPanel, initPanelBehavior } from './Panel';

(async function () {
	'use strict';

	const state: IExtensionState = {
		savedUrl: await storageGet('customUrl', ''),
		savedCollapsed: await storageGet('panelCollapsed', true),
		savedLeft: await storageGet('panelLeft', null),
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
