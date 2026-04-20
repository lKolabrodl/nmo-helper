import React, { useEffect, useState } from 'react';
import './styles.scss';
import Form, { type IFormParam } from './Form';
import Button from './Button';
import { type BugReportStatus } from './status';
import { useQuestionFinder } from '../../contexts/QuestionFinderContext';
import { getQuestionHtml } from '../../utils';
import { detectSource } from '../../utils/parsers';
import {
	canSubmitBugReport,
	computeFingerprint,
	submitBugReport,
	type BugReportGate,
	type BugReportResult
} from '../../utils/bug-report';

const EXT_VERSION = (typeof chrome !== 'undefined' && chrome.runtime?.getManifest?.()?.version) || '';

interface IBugReportButtonProps {
	readonly activeUrl: string;
}

const BugReportButton: React.FC<IBugReportButtonProps> = ({ activeUrl }) => {
	const { rawTopic, question, variants } = useQuestionFinder();
	const source = detectSource(activeUrl) ?? '';

	const [isOpen, setIsOpen] = useState(false);
	const [sending, setSending] = useState(false);
	const [status, setStatus] = useState<BugReportStatus | null>(null);

	// Пересчёт статуса при смене вопроса/темы/URL: читаем клиентские лимиты
	// из storage и понимаем, можно ли отправить отчёт.
	useEffect(() => {
		let cancelled = false;
		const fp = computeFingerprint({topic: rawTopic ?? '', question: question ?? '', activeUrl});
		canSubmitBugReport(fp).then(gate => {
			if (!cancelled) setStatus(gateStatus(gate));
		});
		return () => { cancelled = true; };
	}, [rawTopic, question, activeUrl]);

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
		});
		setSending(false);
		setIsOpen(false);
		setStatus(resultStatus(res));
	};

	// Нечего репортить — вопроса нет
	if (!question) return null;

	// Форма открыта
	if (isOpen) {
		const params: IFormParam[] = [
			{ key: 'topic',    title: 'Тема',             value: rawTopic ?? '' },
			{ key: 'source',   title: 'Источник',         value: source },
			{ key: 'url',      title: 'Страница ответов', value: activeUrl },
			{ key: 'question', title: 'Вопрос',           value: question },
			{ key: 'variants', title: 'Варианты',         value: `${variants.length} шт.` },
		];
		return (
			<div className="nmo-bug-preview">
				<Form
					params={params}
					onSend={handleSend}
					onCancel={() => setIsOpen(false)}
					sending={sending}
				/>
			</div>
		);
	}

	// Есть статус → показываем его как disabled-кнопку
	if (status) return <Button status={status} disabled/>;

	return <Button status="TRIGGER" onClick={() => setIsOpen(true)} />;
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
	if (res.error === 'payload_too_large') return 'PAYLOAD_LARGE';
	if (res.error === 'network')           return 'NETWORK';
	return 'SERVER';
}