import React from 'react';
import './styles.scss';
import {usePanelUi} from '../../contexts/PanelUiContext';
import {usePanelStatus} from '../../contexts/PanelStatusContext';
import {Status} from '../../types';
import {IconCheck, IconClose, IconExpand, IconWarn} from '../icons';

export interface IPillProgress {
	readonly current: number;
	readonly total: number;
	readonly found: number;
	readonly missed: number;
}

const ZERO: IPillProgress = {current: 0, total: 0, found: 0, missed: 0};

interface IProps {
	readonly progress?: IPillProgress;
	readonly onStop?: () => void;
}

const CollapsedPill: React.FC<IProps> = ({progress = ZERO, onStop}) => {
	const {setCollapsed} = usePanelUi();
	const {status} = usePanelStatus();

	const isLoading = status.status === Status.LOADING;
	const isWarning = status.status === Status.WARN;
	const isError = status.status === Status.ERR;
	const isOk = status.status === Status.OK;
	const isDone = isOk && progress.total > 0 && progress.current >= progress.total;
	const inFlight = isLoading || (progress.total > 0 && !isDone);

	const pct = progress.total ? (progress.current / progress.total) * 100 : 0;

	const title =
		status.title ||
		(isDone ? 'Готово' : isLoading ? 'AI думает…' : 'NMO Helper');

	const showProgress = progress.total > 0;

	return (
		<div className="nmo-pill nmo-fade-up">
			<div className="nmo-pill-head">
				<div className={`nmo-pill-icon ${isWarning || isError ? 'warning' : ''}`}>
					{isLoading && <span className="nmo-spinner" style={{width: 14, height: 14}}/>}
					{!isLoading && (isWarning || isError) && <IconWarn size={13}/>}
					{!isLoading && !isWarning && !isError && isDone && <IconCheck size={13}/>}
					{!isLoading && !isWarning && !isError && !isDone && (
						<span className="nmo-pulse nmo-pill-dot"/>
					)}
				</div>
				<div className="nmo-pill-body">
					<div className="nmo-pill-title">{title}</div>
					{showProgress && (
						<div className="nmo-pill-meta">
							{progress.current} / {progress.total}
							<span className="sep"> · </span>
							<span className="ok">{progress.found}✓</span>
							{progress.missed > 0 && (
								<>
									<span className="sep"> · </span>
									<span className="warn">{progress.missed}!</span>
								</>
							)}
						</div>
					)}
				</div>
				{onStop && inFlight && (
					<button type="button"
						className="nmo-icon-btn"
						title="Остановить"
						onClick={onStop}>
						<IconClose size={12}/>
					</button>
				)}
				<button type="button"
					className="nmo-icon-btn"
					title="Развернуть"
					onClick={() => setCollapsed(false)}>
					<IconExpand size={12}/>
				</button>
			</div>

			<div className={`nmo-progress ${isWarning ? 'warning' : ''}`}>
				<div style={{width: `${pct}%`}}/>
			</div>
		</div>
	);
};

export default CollapsedPill;
