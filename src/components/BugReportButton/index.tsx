import React, {useEffect, useState} from 'react';
import './styles.scss';
import {STATUSES, type BugReportStatus} from './status';
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

const EXT_VERSION = (typeof chrome !== 'undefined' && chrome.runtime?.getManifest?.()?.version) || '';



interface IProps {
	readonly activeUrl?: string;
	/** Контролируемый режим: открыт ли диалог. Если undefined — компонент управляет сам через свой trigger-pill */
	readonly isOpen?: boolean;
	/** Запрос на закрытие (controlled режим) */
	readonly onClose?: () => void;
	/** Не рендерить pill-trigger (когда trigger где-то снаружи, например, в title-bar) */
	readonly hideTrigger?: boolean;
}

const BugReportButton: React.FC<IProps> = ({activeUrl = '', isOpen: openProp, onClose, hideTrigger}) => {
	const {rawTopic, question, variants} = useQuestionFinder();
	const source = detectSource(activeUrl) ?? '';

	const controlled = openProp !== undefined;
	const [openLocal, setOpenLocal] = useState(false);
	const isOpen = controlled ? !!openProp : openLocal;

	const closeForm = () => (controlled ? onClose?.() : setOpenLocal(false));

	const [sending, setSending] = useState(false);
	const [status, setStatus] = useState<BugReportStatus | null>(null);
	const [message, setMessage] = useState('');

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
			closeForm();
			setStatus(null);
		}, 1500);
		return () => clearTimeout(id);
	}, [status]);

	const canSubmit = status === null;

	const handleSend = async () => {
		if (!canSubmit) return;
		setSending(true);

		const res = await submitBugReport({
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
				<button type="button" className="nmo-icon-btn nmo-bug-close" onClick={closeForm}>
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
					<div>• Источник: <span>{source || '—'}</span></div>
					<div>• Версия: <span>{EXT_VERSION} · {getBrowserInfo()}</span></div>
				</div>
			</div>

			{status && (
				<div className="nmo-bug-rate nmo-fade-up">
					<div className="nmo-bug-rate-icon"><IconWarn size={12}/></div>
					<div className="nmo-bug-rate-body">
						<div className="nmo-bug-rate-title">{STATUSES[status].text}</div>
						<div className="nmo-bug-rate-sub">Лимит: 5 отчётов / сутки · 1 раз / 5 мин</div>
					</div>
				</div>
			)}

			<div className="nmo-bug-form-foot">
				<button type="button"
					className="nmo-bug-btn-cancel"
					disabled={sending}
					onClick={closeForm}>
					Отмена
				</button>
				<button type="button"
					className="nmo-btn nmo-btn-warning nmo-bug-btn-send"
					disabled={!canSubmit || sending}
					onClick={handleSend}>
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

function getBrowserInfo(): string {
	const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
	const m = ua.match(/(Firefox|Edg|OPR|Chrome|Safari)\/(\d+(?:\.\d+)?)/);
	if (!m) return 'неизвестно';
	const name = m[1] === 'Edg' ? 'Edge' : m[1] === 'OPR' ? 'Opera' : m[1];
	return `${name} ${m[2]}`;
}