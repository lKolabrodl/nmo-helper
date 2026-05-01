import React from 'react';
import './styles.scss';
import {usePanelUi} from '../../contexts/PanelUiContext';
import {usePanelStatus} from '../../contexts/PanelStatusContext';
import {Status} from '../../types';
import {IconCheck, IconExpand, IconWarn} from '../icons';

const CollapsedPill: React.FC = () => {
	const {setCollapsed} = usePanelUi();
	const {status} = usePanelStatus();

	const isLoading = status.status === Status.LOADING;
	const isWarning = status.status === Status.WARN;
	const isError = status.status === Status.ERR;
	const isOk = status.status === Status.OK;

	const title = status.title || (isLoading ? 'AI думает…' : 'NMO Helper');

	return (
		<div className="nmo-pill nmo-fade-up">
			<div className="nmo-pill-head">

				<div className={`nmo-pill-icon ${status.status}`}>
					{isLoading && <span className="nmo-spinner" style={{width: 14, height: 14}}/>}
					{!isLoading && (isWarning || isError) && <IconWarn size={13}/>}
					{!isLoading && !isWarning && !isError && isOk && <IconCheck size={13}/>}
					{!isLoading && !isWarning && !isError && !isOk && (<span className="nmo-pill-dot"/>)}
				</div>

				<div className="nmo-pill-body">
					<div className="nmo-pill-title">{title}</div>
				</div>

				<button type="button"
					className="nmo-icon-btn"
					title="Развернуть"
					onClick={() => setCollapsed(false)}>
					<IconExpand size={12}/>
				</button>

			</div>
		</div>
	);
};

export default CollapsedPill;
