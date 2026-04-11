import React from "react";
import './styles.scss';
import { usePanelUi } from '../../contexts/PanelUiContext';
import { usePanelStatus } from '../../contexts/PanelStatusContext';

const Header: React.FC<unknown> = () => {
	const {collapsed, setCollapsed} = usePanelUi();
	const {status} = usePanelStatus();

	return (
		<div className="nmo-header">
			<span className={`nmo-indicator ${status.status}`}/>
			<span className="nmo-header-title">NMO Helper</span>
			<span className={`nmo-header-status ${status.status}`}>{status.title}</span>

			<button
				className="nmo-toggle-btn"
				title={collapsed ? 'Развернуть' : 'Свернуть'}
				onClick={() => setCollapsed(!collapsed)}>
				{collapsed ? '+' : '\u2013'}
			</button>

		</div>
	);
};

export default Header;
