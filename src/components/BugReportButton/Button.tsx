import React from 'react';
import { STATUSES, type BugReportStatus } from './status';

export type ButtonVariant =
	| 'primary'
	| 'ghost'
	| 'stop'
	| 'trigger'
	| 'success'
	| 'warning'
	| 'error';

interface IProps {
	readonly status: BugReportStatus;
	readonly onClick?: () => void;
	readonly disabled?: boolean;
	/** Необязательный override текста — для динамических значений вроде обратного отсчёта */
	readonly text?: string;
}

const CLASSES: Record<ButtonVariant, string> = {
	primary: 'nmo-btn nmo-btn-primary',
	ghost:   'nmo-btn nmo-btn-ghost',
	stop:    'nmo-btn nmo-btn-stop',
	trigger: 'nmo-bug-trigger',
	success: 'nmo-bug-status nmo-bug-status-success',
	warning: 'nmo-bug-status nmo-bug-status-warning',
	error:   'nmo-bug-status nmo-bug-status-error',
};

const Button: React.FC<IProps> = ({ status, onClick, disabled, text }) => {
	const def = STATUSES[status];
	return (
		<button
			type="button"
			className={CLASSES[def.variant]}
			onClick={onClick}
			disabled={disabled}
		>
			{text ?? def.text}
		</button>
	);
};

export default Button;
