import React from 'react';
import './ui.scss';
import {IconCheck, IconClose, IconWarn} from '../icons';

export type ToastKind = 'success' | 'warning' | 'danger';

export interface IToast {
	readonly kind: ToastKind;
	readonly title: string;
	readonly sub?: string;
}

interface IProps {
	readonly toast: IToast;
	readonly onClose?: () => void;
}

const ICONS: Record<ToastKind, React.ReactNode> = {
	success: <IconCheck size={13}/>,
	warning: <IconWarn size={13}/>,
	danger:  <IconClose size={13}/>,
};

const InlineToast: React.FC<IProps> = ({toast, onClose}) => (
	<div className={`nmo-banner nmo-banner-${toast.kind} nmo-fade-up nmo-toast`}>
		<div className="nmo-banner-icon">{ICONS[toast.kind]}</div>

		<div className="nmo-banner-body">
			<div className="nmo-banner-title">{toast.title}</div>
			{toast.sub && <div className="nmo-banner-sub">{toast.sub}</div>}
		</div>

		{onClose && (
			<button type="button" className="nmo-icon-btn nmo-toast-close" onClick={onClose}>
				<IconClose size={12}/>
			</button>
		)}

	</div>
);

export default InlineToast;
