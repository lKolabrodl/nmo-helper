import React from 'react';
import './ui.scss';
import {IconPlay} from '../icons';

interface IProps {
	readonly canRun: boolean;
	readonly onStart: () => void;
	readonly label?: string;
	readonly hint?: string;
}

const Footer: React.FC<IProps> = ({canRun, onStart, label = 'Запустить', hint}) => (
	<div className="nmo-footer">
		<button type="button"
			className="nmo-btn nmo-btn-primary nmo-btn-cta"
			disabled={!canRun}
			onClick={onStart}>
			<IconPlay size={14}/>{label}
		</button>
		{hint && <div className="nmo-footer-hint">{hint}</div>}
	</div>
);

export default Footer;
