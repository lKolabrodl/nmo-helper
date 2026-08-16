import React, {useEffect, useState} from 'react';
import cn from 'classnames';
import './styles.scss';
import {STATUSES, type BugReportStatus} from './status';
import {usePanelUi} from '../../contexts/PanelUiContext';
import {useSettings} from '../../contexts/SettingsContext';
import {useBugReportContext} from '../../contexts/BugReportContext';
import {useQuestionFinder} from '../../contexts/QuestionFinderContext';
import {getQuestionHtml} from '../../utils';
import {detectSource} from '../../utils/matching';
import {canSubmitBugReport, computeFingerprint, submitBugReport} from '../../api/bug-report';
import {checkVersion, isOutdated} from '../../api/version-check';
import {IconBug, IconCheck, IconClose, IconWarn} from '../icons';
import {formatUrlForDisplay} from '../SectionSites/utils';
import {formatReportMode, gateStatus, getBrowserInfo, resolveBugReportContext, resultStatus} from './utils';

const EXT_VERSION = (typeof chrome !== 'undefined' && chrome.runtime?.getManifest?.()?.version) || '';

interface IBugReportButtonProps {
	/** Контролируемый режим: открыт ли диалог. Если undefined — компонент управляет сам через свой trigger-pill */
	readonly isOpen?: boolean;
	/** Запрос на закрытие (controlled режим) */
	readonly onClose?: () => void;
	/** Не рендерить pill-trigger (когда trigger где-то снаружи, например, в title-bar) */
	readonly hideTrigger?: boolean;
}

const BugReportButton: React.FC<IBugReportButtonProps> = ({isOpen: openProp, onClose, hideTrigger}) => {
	// context
	const {mode: panelMode} = usePanelUi();
	const {provider: aiProvider} = useSettings().ai;
	const reportContext = useBugReportContext();
	const {rawTopic, question, variants} = useQuestionFinder();

	// state
	const [sending, setSending] = useState<boolean>(false);
	const [status, setStatus] = useState<BugReportStatus | null>(null);
	const [message, setMessage] = useState<string>('');
	const [openLocal, setOpenLocal] = useState<boolean>(false);

	const {mode: reportMode, url} = resolveBugReportContext(reportContext, panelMode, aiProvider);

	const source = detectSource(url) ?? '';

	const controlled = openProp !== undefined;

	const isOpen = controlled ? !!openProp : openLocal;


	useEffect(() => {
		let cancelled = false;
		const fp = computeFingerprint({topic: rawTopic ?? '', question: question ?? '', url});

		// Сначала проверка версии (cached, обычно мгновенно), потом клиентский гейт.
		checkVersion(false).then(info => {
			if (cancelled) return;
			if (isOutdated(info)) { setStatus('OUTDATED'); return; }
			canSubmitBugReport(fp).then(gate => {
				if (!cancelled) setStatus(gateStatus(gate));
			});
		});

		return () => { cancelled = true; };
	}, [rawTopic, question, url]);

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
			mode: reportMode,
			url,
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
				className={cn('nmo-bug-pill', {disabled: status})}
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
					<div>• Таб: <span>{formatReportMode(reportMode)}</span></div>
					<div>• Источник: <span>{source || '—'}</span></div>
					<div>• Ссылка: <span>{formatUrlForDisplay(url || '—')}</span></div>
					<div>• Версия: <span>{EXT_VERSION} · {getBrowserInfo()}</span></div>
				</div>
			</div>

			{status && (
				<div className="nmo-bug-rate nmo-fade-up">
					<div className="nmo-bug-rate-icon"><IconWarn size={12}/></div>
					<div className="nmo-bug-rate-body">
						<div className="nmo-bug-rate-title">{STATUSES[status].text}</div>
						{['COOLDOWN', 'DAILY_CAP', 'DUPLICATE'].includes(status) &&	<div className="nmo-bug-rate-sub">Лимит: 1 отчёт / сутки</div>}
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
