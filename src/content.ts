import type { ExtensionState } from './types';
import { storageGet } from './utils';
import { createPanel, initPanelBehavior } from './panel';
import { initSearch } from './search';
import { initSitesMode } from './sites';
import { initAiMode } from './ai';
import { initAutoMode } from './auto';

(async function () {
  'use strict';

  const state: ExtensionState = {
    savedUrl: await storageGet('customUrl', ''),
    savedCollapsed: await storageGet('panelCollapsed', false),
    savedLeft: await storageGet('panelLeft', null),
    savedTop: await storageGet('panelTop', null),
    savedAiMode: await storageGet('aiMode', false),
    savedAutoMode: await storageGet('autoMode', true),
    savedApiKey: await storageGet('apiKey', ''),
    savedModel: await storageGet('aiModel', 'gpt-4o-mini'),
  };

  const panel = createPanel(state);
  initPanelBehavior(panel);
  initSearch();
  initSitesMode();
  initAiMode();
  initAutoMode();
})();
