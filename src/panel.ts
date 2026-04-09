import type { ExtensionState } from './types';
import { storageSet } from './utils';
import { AI_MODELS, POLL_INTERVAL } from './constants';

export function createPanel(state: ExtensionState): HTMLElement {
  const { savedUrl, savedCollapsed, savedLeft, savedTop, savedAiMode, savedAutoMode, savedApiKey, savedModel } = state;

  const panel = document.createElement('div');
  panel.id = 'nmo-panel';
  if (savedCollapsed) panel.classList.add('collapsed');
  panel.innerHTML = `
    <div class="nmo-header">
      <span class="nmo-poo" id="nmo-poo">
        <svg viewBox="0 0 64 64" width="35" height="35" xmlns="http://www.w3.org/2000/svg">
          <!-- body -->
          <path d="M32 4c-3 0-5 2-5 4 0 1 .5 2.5 1 3-4 1-7 4-7 7 0 1 .3 2 .8 3C16 23 12 28 12 34c0 9 9 16 20 16s20-7 20-16c0-6-4-11-9.8-13 .5-1 .8-2 .8-3 0-3-3-6-7-7 .5-.5 1-2 1-3 0-2-2-4-5-4z" fill="#8B6914"/>
          <path d="M32 6c-2 0-3.5 1.2-3.5 2.5 0 .8.4 1.8.8 2.2-3.5 1-6.3 3.5-6.3 6.3 0 .8.3 1.7.7 2.5C18.5 21.2 14 26 14 32c0 8 8.1 14.5 18 14.5S50 40 50 32c0-6-4.5-10.8-9.7-12.5.4-.8.7-1.7.7-2.5 0-2.8-2.8-5.3-6.3-6.3.4-.4.8-1.4.8-2.2C35.5 7.2 34 6 32 6z" fill="#A67C00"/>
          <ellipse cx="32" cy="34" rx="16" ry="11" fill="#BF9B30" opacity="0.25"/>
          <!-- happy face -->
          <g class="nmo-poo-face nmo-poo-face-happy">
            <circle cx="25" cy="30" r="2.5" fill="#1a1a2e"/><ellipse cx="25.8" cy="29.2" rx="0.8" ry="0.8" fill="#fff"/>
            <circle cx="39" cy="30" r="2.5" fill="#1a1a2e"/><ellipse cx="39.8" cy="29.2" rx="0.8" ry="0.8" fill="#fff"/>
            <ellipse cx="32" cy="37" rx="4" ry="2.5" fill="#1a1a2e"/>
            <ellipse cx="32" cy="36" rx="3" ry="1.2" fill="#e94560"/>
            <circle cx="21" cy="34" r="2.5" fill="#e94560" opacity="0.25"/>
            <circle cx="43" cy="34" r="2.5" fill="#e94560" opacity="0.25"/>
          </g>
          <!-- sad face -->
          <g class="nmo-poo-face nmo-poo-face-sad">
            <line x1="22" y1="26" x2="28" y2="28" stroke="#1a1a2e" stroke-width="2" stroke-linecap="round"/>
            <line x1="42" y1="26" x2="36" y2="28" stroke="#1a1a2e" stroke-width="2" stroke-linecap="round"/>
            <circle cx="25" cy="31" r="2.5" fill="#1a1a2e"/><ellipse cx="25.8" cy="30.2" rx="0.8" ry="0.8" fill="#fff"/>
            <circle cx="39" cy="31" r="2.5" fill="#1a1a2e"/><ellipse cx="39.8" cy="30.2" rx="0.8" ry="0.8" fill="#fff"/>
            <path d="M27 39 Q32 35 37 39" fill="none" stroke="#1a1a2e" stroke-width="2" stroke-linecap="round"/>
          </g>
          <!-- sleep face -->
          <g class="nmo-poo-face nmo-poo-face-sleep">
            <path d="M22 30 Q25 28 28 30" fill="none" stroke="#1a1a2e" stroke-width="2" stroke-linecap="round"/>
            <path d="M36 30 Q39 28 42 30" fill="none" stroke="#1a1a2e" stroke-width="2" stroke-linecap="round"/>
            <ellipse cx="32" cy="37" rx="2" ry="1.5" fill="#1a1a2e"/>
            <text class="nmo-poo-zzz" x="44" y="22" fill="#f0c040" font-size="8" font-weight="bold" font-family="sans-serif">z</text>
            <text class="nmo-poo-zzz nmo-poo-zzz-2" x="48" y="16" fill="#f0c040" font-size="10" font-weight="bold" font-family="sans-serif">z</text>
            <text class="nmo-poo-zzz nmo-poo-zzz-3" x="53" y="9" fill="#f0c040" font-size="12" font-weight="bold" font-family="sans-serif">Z</text>
          </g>
        </svg>
      </span>
      <span class="nmo-header-title">NMO Helper</span>
      <span class="nmo-header-status" id="nmo-header-status"></span>
      <button class="nmo-toggle-btn" id="nmo-collapse" title="Свернуть">${savedCollapsed ? '+' : '\u2014'}</button>
    </div>
    <div class="nmo-body">
      <label class="nmo-ai-toggle">
        <input type="checkbox" id="nmo-ai-mode" ${savedAiMode ? 'checked' : ''} />
        <span>Решать с помощью AI</span>
      </label>
      <label class="nmo-ai-toggle">
        <input type="checkbox" id="nmo-auto-mode" ${savedAutoMode ? 'checked' : ''} />
        <span>Авто-поиск rosmed & 24forcare</span>
      </label>

      <div class="nmo-auto-section" ${savedAutoMode ? '' : 'style="display:none"'}>
        <div class="nmo-status" id="nmo-auto-status">выключено</div>
      </div>

      <div class="nmo-sites-section" ${savedAiMode || savedAutoMode ? 'style="display:none"' : ''}>
        <div class="nmo-field">
          <label>Поиск</label>
          <input type="text" id="nmo-search-query" placeholder="Название теста..." />
        </div>
        <button class="nmo-btn nmo-btn-search" id="nmo-search-btn">\uD83D\uDD0D Найти ответы</button>
        <div class="nmo-status" id="nmo-search-status"></div>
        <div class="nmo-search-results" id="nmo-search-results" style="display:none"></div>

        <hr class="nmo-separator">

        <div class="nmo-field">
          <label>URL страницы с ответами</label>
          <input type="text" id="nmo-url" placeholder="https://..." value="${savedUrl.replace(/"/g, '&quot;')}" />
        </div>
        <div class="nmo-btn-row">
          <button class="nmo-btn nmo-btn-run" id="nmo-run">\u25B6 Запуск</button>
          <button class="nmo-btn nmo-btn-stop" id="nmo-stop" style="display:none">\u25A0 Стоп</button>
        </div>
        <div class="nmo-status" id="nmo-status">готов к работе</div>
      </div>

      <div class="nmo-ai-section" ${savedAiMode ? '' : 'style="display:none"'}>
        <div class="nmo-field">
          <label>API-ключ ProxyAPI</label>
          <input type="password" id="nmo-api-key" placeholder="вставьте ключ..." value="${savedApiKey.replace(/"/g, '&quot;')}" />
          <a class="nmo-key-hint" id="nmo-key-hint" href="https://console.proxyapi.ru/keys" target="_blank" ${savedApiKey ? 'style="display:none"' : ''}>Получить ключ API</a>
        </div>
        <div class="nmo-field">
          <label>Модель</label>
          <input type="hidden" id="nmo-ai-model" value="${savedModel}" />
          <div class="nmo-dropdown" id="nmo-model-dropdown">
            <div class="nmo-dropdown-selected" id="nmo-model-selected"></div>
            <div class="nmo-dropdown-list" id="nmo-model-list">
              ${AI_MODELS.map(m => `<div class="nmo-dropdown-item" data-value="${m.id}" data-tier="${m.tier}" ${m.tag ? 'data-tag="' + m.tag + '"' : ''}><span class="nmo-di-name">${m.name}</span>${m.tag === 'rec' ? '<span class="nmo-di-tag nmo-di-tag-rec">\u2605</span>' : m.tag === 'pricey' ? '<span class="nmo-di-tag nmo-di-tag-pricey">$$$</span>' : ''}<span class="nmo-di-tier nmo-di-tier-${m.tier}">${m.tier}</span></div>`).join('')}
            </div>
          </div>
        </div>
        <div class="nmo-btn-row">
          <button class="nmo-btn nmo-btn-ai" id="nmo-ai-run">\u25B6 Запуск AI</button>
          <button class="nmo-btn nmo-btn-stop" id="nmo-ai-stop" style="display:none">\u25A0 Стоп</button>
        </div>
        <div class="nmo-status" id="nmo-ai-status">готов к работе</div>
      </div>
    </div>
  `;
  document.body.appendChild(panel);

  if (savedLeft !== null && savedTop !== null) {
    panel.style.left = savedLeft + 'px';
    panel.style.top = savedTop + 'px';
    panel.style.right = 'auto';
  }

  return panel;
}

export function initPanelBehavior(panel: HTMLElement): void {
  const header = panel.querySelector('.nmo-header') as HTMLElement;
  let isDragging = false, dx = 0, dy = 0;

  header.addEventListener('mousedown', (e: MouseEvent) => {
    e.preventDefault();
    isDragging = true;
    const rect = panel.getBoundingClientRect();
    dx = e.clientX - rect.left;
    dy = e.clientY - rect.top;
    panel.style.willChange = 'left, top';
  });

  document.addEventListener('mousemove', (e: MouseEvent) => {
    if (!isDragging) return;
    e.preventDefault();
    requestAnimationFrame(() => {
      panel.style.left = (e.clientX - dx) + 'px';
      panel.style.top = (e.clientY - dy) + 'px';
      panel.style.right = 'auto';
    });
  });

  document.addEventListener('mouseup', () => {
    if (isDragging) {
      isDragging = false;
      panel.style.willChange = '';
      const rect = panel.getBoundingClientRect();
      storageSet('panelLeft', rect.left);
      storageSet('panelTop', rect.top);
    }
  });

  document.getElementById('nmo-collapse')!.addEventListener('click', () => {
    panel.classList.toggle('collapsed');
    const isCollapsed = panel.classList.contains('collapsed');
    document.getElementById('nmo-collapse')!.textContent = isCollapsed ? '+' : '\u2014';
    storageSet('panelCollapsed', isCollapsed);
  });

  const sitesSection = panel.querySelector('.nmo-sites-section') as HTMLElement;
  const aiSection = panel.querySelector('.nmo-ai-section') as HTMLElement;
  const autoSection = panel.querySelector('.nmo-auto-section') as HTMLElement;
  const aiCheckbox = document.getElementById('nmo-ai-mode') as HTMLInputElement;
  const autoCheckbox = document.getElementById('nmo-auto-mode') as HTMLInputElement;

  function updateSections() {
    const ai = aiCheckbox.checked;
    const auto = autoCheckbox.checked;
    sitesSection.style.display = (ai || auto) ? 'none' : '';
    aiSection.style.display = ai ? '' : 'none';
    autoSection.style.display = auto ? '' : 'none';
  }

  aiCheckbox.addEventListener('change', () => {
    if (aiCheckbox.checked) {
      autoCheckbox.checked = false;
      storageSet('autoMode', false);
      autoCheckbox.dispatchEvent(new Event('change'));
    }
    storageSet('aiMode', aiCheckbox.checked);
    updateSections();
  });

  autoCheckbox.addEventListener('change', () => {
    if (autoCheckbox.checked) {
      aiCheckbox.checked = false;
      storageSet('aiMode', false);
    }
    storageSet('autoMode', autoCheckbox.checked);
    updateSections();
  });

  const modelInput = document.getElementById('nmo-ai-model') as HTMLInputElement;
  const modelSelected = document.getElementById('nmo-model-selected')!;
  const modelList = document.getElementById('nmo-model-list')!;
  const modelDropdown = document.getElementById('nmo-model-dropdown')!;

  function updateModelDisplay(value: string) {
    const m = AI_MODELS.find(m => m.id === value);
    if (m) {
      const tagHtml = m.tag === 'rec' ? '<span class="nmo-tag nmo-tag-rec">\u2605</span>' : m.tag === 'pricey' ? '<span class="nmo-tag nmo-tag-pricey">$$$</span>' : '';
      modelSelected.innerHTML = `<span class="nmo-model-name">${m.name}</span>${tagHtml}<span class="nmo-tier nmo-tier-${m.tier}">${m.tier}</span>`;
    }
  }
  updateModelDisplay(modelInput.value);

  modelSelected.addEventListener('click', (e: Event) => {
    e.stopPropagation();
    const wasOpen = modelDropdown.classList.contains('open');
    modelDropdown.classList.toggle('open');
    if (!wasOpen) {
      const rect = modelSelected.getBoundingClientRect();
      (modelList as HTMLElement).style.left = rect.left + 'px';
      (modelList as HTMLElement).style.top = rect.bottom + 'px';
      (modelList as HTMLElement).style.width = rect.width + 'px';
    }
  });

  modelList.addEventListener('click', (e: Event) => {
    const item = (e.target as HTMLElement).closest('.nmo-dropdown-item') as HTMLElement | null;
    if (!item) return;
    modelInput.value = item.dataset.value!;
    storageSet('aiModel', item.dataset.value!);
    updateModelDisplay(item.dataset.value!);
    modelDropdown.classList.remove('open');
  });

  document.addEventListener('click', () => {
    modelDropdown.classList.remove('open');
  });

  document.getElementById('nmo-api-key')!.addEventListener('input', (e: Event) => {
    const val = (e.target as HTMLInputElement).value.trim();
    storageSet('apiKey', val);
    document.getElementById('nmo-key-hint')!.style.display = val ? 'none' : '';
  });

  document.getElementById('nmo-url')!.addEventListener('change', (e: Event) => storageSet('customUrl', (e.target as HTMLInputElement).value.trim()));

  const headerStatus = document.getElementById('nmo-header-status')!;
  const poo = document.getElementById('nmo-poo')!;
  poo.className = 'nmo-poo sleep';

  setInterval(() => {
    let activeId = 'nmo-status';
    if (aiCheckbox.checked) activeId = 'nmo-ai-status';
    else if (autoCheckbox.checked) activeId = 'nmo-auto-status';
    const el = document.getElementById(activeId);
    if (el) {
      headerStatus.textContent = el.textContent;
      const statusCls = el.className.replace('nmo-status', '').trim();
      headerStatus.className = 'nmo-header-status ' + statusCls;

      let pooState = 'sleep';
      if (statusCls === 'ok') pooState = 'happy';
      else if (statusCls === 'err' || statusCls === 'warn') pooState = 'sad';
      poo.className = 'nmo-poo ' + pooState;
    }
  }, POLL_INTERVAL);
}
