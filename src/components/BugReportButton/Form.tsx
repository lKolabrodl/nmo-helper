import React from 'react';
import Button from './Button';

export interface IFormParam {
	readonly key: string;
	readonly title: string;
	readonly value: string;
}

interface IProps {
	readonly params: IFormParam[];
	readonly onSend: () => void;
	readonly onCancel: () => void;
	readonly sending: boolean;
}

const EXT_VERSION =
	(typeof chrome !== 'undefined' && chrome.runtime?.getManifest?.()?.version) || '—';

function getBrowserInfo(): string {
	const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
	// Порядок важен: Edg → до Chrome (Edge содержит оба токена)
	const m = ua.match(/(Firefox|Edg|OPR|Chrome|Safari)\/(\d+(?:\.\d+)?)/);
	if (!m) return 'неизвестно';
	const name = m[1] === 'Edg' ? 'Edge' : m[1] === 'OPR' ? 'Opera' : m[1];
	return `${name} ${m[2]}`;
}

const Form: React.FC<IProps> = ({ params, onSend, onCancel, sending }) => (
	<div className="nmo-bug-form">
		<div className="nmo-bug-preview-title">Будет отправлено разработчику:</div>

		<dl className="nmo-bug-preview-data">
			{params.map(({ key, title, value }) => (
				<React.Fragment key={key}>
					<dt>{title}</dt>
					<dd>{value || '—'}</dd>
				</React.Fragment>
			))}
		</dl>

		<div className="nmo-bug-preview-note">
			<div>Версия расширения: {EXT_VERSION}</div>
			<div>Версия браузера: {getBrowserInfo()}</div>
		</div>

		<div className="nmo-btn-row">
			<Button status="CANCEL" onClick={onCancel} disabled={sending} />
			<Button status={sending ? 'SENDING' : 'SEND'} onClick={onSend} disabled={sending} />
		</div>
	</div>
);

export default Form;
