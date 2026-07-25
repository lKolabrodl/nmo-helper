import type {BugReportGate, BugReportResult} from '../../api/bug-report';
import type {IBugReportContextSnapshot} from '../../contexts/BugReportContext';
import type {UiMode} from '../../contexts/PanelUiContext';
import type {AiProvider, BugReportMode} from '../../types';
import type {BugReportStatus} from './status';

export function gateStatus(gate: BugReportGate): BugReportStatus | null {
	if (gate.ok) return null;
	if (gate.reason === 'duplicate') return 'DUPLICATE';
	if (gate.reason === 'cooldown') return 'COOLDOWN';
	return 'DAILY_CAP';
}

export function resultStatus(res: BugReportResult): BugReportStatus {
	if (res.ok) return 'SENT';
	if (res.error === 'duplicate') return 'DUPLICATE';
	if (res.error === 'cooldown') return 'COOLDOWN';
	if (res.error === 'daily_cap') return 'DAILY_CAP';
	if (res.error === 'outdated') return 'OUTDATED';
	if (res.error === 'payload_too_large') return 'PAYLOAD_LARGE';
	if (res.error === 'network') return 'NETWORK';
	return 'SERVER';
}

function isReportModeForPanel(reportMode: string, panelMode: string): boolean {
	return reportMode === panelMode || reportMode.startsWith(`${panelMode}:`);
}

function getDefaultReportMode(panelMode: UiMode, aiProvider: AiProvider): BugReportMode {
	if (panelMode === 'sites') return 'sites:search';
	if (panelMode === 'ai') return `ai:${aiProvider}`;
	return panelMode;
}

export function resolveBugReportContext(reportContext: IBugReportContextSnapshot, panelMode: UiMode, aiProvider: AiProvider): {mode: BugReportMode; url: string} {
	const defaultMode = getDefaultReportMode(panelMode, aiProvider);

	if (!isReportModeForPanel(reportContext.mode, panelMode)) return {mode: defaultMode, url: ''};

	return {
		mode: panelMode === 'ai' ? defaultMode : reportContext.mode || defaultMode,
		url: reportContext.url,
	};
}

export function formatReportMode(mode: string): string {
	if (mode === 'auto') return 'Авто';
	if (mode === 'sites:search') return 'Сайты / поиск';
	if (mode === 'sites:url') return 'Сайты / URL';
	if (mode === 'ai:free') return 'AI / бесплатно';
	if (mode === 'ai:custom') return 'AI / свой endpoint';
	if (mode === 'ai:proxy') return 'AI / ProxyAPI';
	if (mode === 'pdf') return 'PDF';
	return mode || '—';
}

export function getBrowserInfo(): string {
	const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
	const match = ua.match(/(Firefox|Edg|OPR|Chrome|Safari)\/(\d+(?:\.\d+)?)/);
	if (!match) return 'неизвестно';
	const name = match[1] === 'Edg' ? 'Edge' : match[1] === 'OPR' ? 'Opera' : match[1];
	return `${name} ${match[2]}`;
}
