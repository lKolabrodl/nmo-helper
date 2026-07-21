import React, {useEffect, useState} from 'react';
import './styles.scss';
import {STATUSES, type BugReportStatus} from './status';
import {usePanelUi} from '../../contexts/PanelUiContext';
import {useSettings} from '../../contexts/SettingsContext';
import {useBugReportContext} from '../../contexts/BugReportContext';
import {useQuestionFinder} from '../../contexts/QuestionFinderContext';
import {getQuestionHtml} from '../../utils';
import {detectSource} from '../../utils/matching';
import {
	canSubmitBugReport,
	computeFingerprint,
	submitBugReport,
	type BugReportGate,
	type BugReportResult,
} from '../../api/bug-report';
import {checkVersion, isOutdated} from '../../api/version-check';
import {IconBug, IconCheck, IconClose, IconWarn} from '../icons';
import {formatUrlForDisplay} from "../SectionSites/utils";

const EXT_VERSION = (typeof chrome !== 'undefined' && chrome.runtime?.getManifest?.()?.version) || '';



interface IBugReportButtonProps {
	readonly activeUrl?: string;
	/** Контролируемый режим: открыт ли диалог. Если undefined — компонент управляет сам через свой trigger-pill */
	readonly isOpen?: boolean;
	/** Запрос на закрытие (controlled режим) */
	readonly onClose?: () => void;
	/** Не рендерить pill-trigger (когда trigger где-то снаружи, например, в title-bar) */
	readonly hideTrigger?: boolean;
}

const BugReportButton: React.FC<IBugReportButtonProps> = ({activeUrl: activeUrlProp, isOpen: openProp, onClose, hideTrigger}) => {
	// context
	const {mode} = usePanelUi();
	const {aiProvider} = useSettings();
	const reportContext = useBugReportContext();
	const {rawTopic, question, variants} = useQuestionFinder();

	// state
	const [sending, setSending] = useState<boolean>(false);
	const [status, setStatus] = useState<BugReportStatus | null>(null);
	const [message, setMessage] = useState<string>('');
	const [openLocal, setOpenLocal] = useState<boolean>(false);


	const contextMatchesMode = reportContext.panelMode === mode;
	const activeUrl = activeUrlProp ?? (contextMatchesMode ? reportContext.activeUrl : '');

	const panelTab = mode === 'ai'
		? `ai:${aiProvider}`
		: contextMatchesMode ? reportContext.panelTab : mode;

	const source = detectSource(activeUrl) ?? '';

	const controlled = openProp !== undefined;

	const isOpen = controlled ? !!openProp : openLocal;


	useEffect(() => {
		let cancelled = false;
		const fp = computeFingerprint({topic: rawTopic ?? '', question: question ?? '', activeUrl});

		// Сначала проверка версии (cached, обычно мгновенно), потом клиентский гейт.
		checkVersion(false).then(info => {
			if (cancelled) return;
			if (isOutdated(info)) { setStatus('OUTDATED'); return; }
			canSubmitBugReport(fp).then(gate => {
				if (!cancelled) setStatus(gateStatus(gate));
			});
		});

		return () => { cancelled = true; };
	}, [rawTopic, question, activeUrl]);

	// после успешной отправки — авто-закрытие через 1.5с (закрываем форму И сбрасываем статус,
	// иначе success-banner остаётся видимым в hideTrigger-режиме)
	useEffect(() => {
		if (status !== 'SENT') return;
		const id = setTimeout(() => {
			_onCloseForm();
			setStatus(null);
		}, 1500);
		return () => clearTimeout(id);
	}, [status]);

	const canSubmit = status === null;

	const _onSendForm = async () => {
		if (!canSubmit) return;
		setSending(true);

		const res = await submitBugReport({
			panelMode: mode,
			panelTab,
			activeUrl,
			source,
			topic: rawTopic ?? '',
			question: question ?? '',
			questionHtml: getQuestionHtml() ?? '',
			variants,
			extVersion: EXT_VERSION,
			userAgent: navigator.userAgent,
			message: message.trim(),
		});

		setSending(false);
		setStatus(resultStatus(res));
	};

	const _onCloseForm = () => (controlled ? onClose?.() : setOpenLocal(false));

	if (!question) return null;

	if (status === 'SENT') {
		return (
			<div className="nmo-bug-banner success nmo-fade-up">
				<div className="nmo-bug-banner-icon"><IconCheck size={13}/></div>
				<div className="nmo-bug-banner-body">{STATUSES.SENT.text}</div>
			</div>
		);
	}

	if (!isOpen) {
		if (hideTrigger) return null;
		return (
			<button type="button"
				className={`nmo-bug-pill ${status ? 'disabled' : ''}`}
				disabled={!!status}
				onClick={() => canSubmit && setOpenLocal(true)}>
				<IconBug size={12}/>
				<span>{status ? STATUSES[status].text : 'Сообщить о проблеме'}</span>
			</button>
		);
	}

	return (
		<div className="nmo-bug-form nmo-fade-up">
			<div className="nmo-bug-form-head">
				<div className="nmo-bug-form-title">
					<IconBug size={12}/>Сообщить о проблеме
				</div>
				<button type="button" className="nmo-icon-btn nmo-bug-close" onClick={_onCloseForm}>
					<IconClose size={12}/>
				</button>
			</div>

			<textarea className="nmo-bug-textarea"
				rows={2}
				value={message}
				onChange={e => setMessage(e.target.value)}
				disabled={!!status || sending}
				placeholder="Что пошло не так? (необязательно)"/>

			<div className="nmo-bug-preview">
				<div className="nmo-bug-preview-title">Будет отправлено на сервер:</div>
				<div className="nmo-bug-preview-data">
					<div>• Тема: <span>{rawTopic || '—'}</span></div>
					<div>• Вопрос: <span>{question}</span></div>
					<div>• Вариантов: <span>{variants.length}</span></div>
					<div>• Таб: <span>{formatPanelTab(mode, panelTab)}</span></div>
					<div>• Источник: <span>{source || '—'}</span></div>
					<div>• Ссылка: <span>{formatUrlForDisplay(activeUrl || '—')}</span></div>
					<div>• Версия: <span>{EXT_VERSION} · {getBrowserInfo()}</span></div>
				</div>
			</div>

			{status && (
				<div className="nmo-bug-rate nmo-fade-up">
					<div className="nmo-bug-rate-icon"><IconWarn size={12}/></div>
					<div className="nmo-bug-rate-body">
						<div className="nmo-bug-rate-title">{STATUSES[status].text}</div>
						{['COOLDOWN', 'DAILY_CAP', 'DUPLICATE'].includes(status) &&
							<div className="nmo-bug-rate-sub">Лимит: 1 отчёт / сутки</div>
						}
					</div>
				</div>
			)}

			<div className="nmo-bug-form-foot">

				<button type="button" className="nmo-bug-btn-cancel" disabled={sending}	onClick={_onCloseForm}>
					Отмена
				</button>

				<button type="button" className="nmo-btn nmo-btn-warning nmo-bug-btn-send" disabled={!canSubmit || sending}	onClick={_onSendForm}>
					{sending ? 'Отправка…' : 'Отправить'}
				</button>

			</div>
		</div>
	);
};

export default BugReportButton;


function gateStatus(gate: BugReportGate): BugReportStatus | null {
	if (gate.ok) return null;
	if (gate.reason === 'duplicate') return 'DUPLICATE';
	if (gate.reason === 'cooldown')  return 'COOLDOWN';
	return 'DAILY_CAP';
}

function resultStatus(res: BugReportResult): BugReportStatus {
	if (res.ok) return 'SENT';
	if (res.error === 'duplicate')         return 'DUPLICATE';
	if (res.error === 'cooldown')          return 'COOLDOWN';
	if (res.error === 'daily_cap')         return 'DAILY_CAP';
	if (res.error === 'outdated')          return 'OUTDATED';
	if (res.error === 'payload_too_large') return 'PAYLOAD_LARGE';
	if (res.error === 'network')           return 'NETWORK';
	return 'SERVER';
}

function formatPanelTab(mode: string, panelTab: string): string {
	if (mode === 'auto') return 'Авто';
	if (mode === 'sites' && panelTab === 'sites:search') return 'Сайты / поиск';
	if (mode === 'sites') return 'Сайты / URL';
	if (mode === 'ai' && panelTab === 'ai:free') return 'AI / бесплатно';
	if (mode === 'ai' && panelTab === 'ai:custom') return 'AI / свой endpoint';
	if (mode === 'ai') return 'AI / ProxyAPI';
	if (mode === 'pdf') return 'PDF';
	return panelTab || mode || '—';
}

function getBrowserInfo(): string {
	const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
	const m = ua.match(/(Firefox|Edg|OPR|Chrome|Safari)\/(\d+(?:\.\d+)?)/);
	if (!m) return 'неизвестно';
	const name = m[1] === 'Edg' ? 'Edge' : m[1] === 'OPR' ? 'Opera' : m[1];
	return `${name} ${m[2]}`;
}
