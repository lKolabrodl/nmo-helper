import React from 'react';
import './ui.scss';

export interface IProgress {
	readonly current: number;
	readonly total: number;
	readonly found: number;
	readonly missed: number;
}

interface IProps {
	readonly progress: IProgress;
	readonly title?: string;
	readonly warning?: boolean;
}

const RunningStrip: React.FC<IProps> = ({progress, title = 'Подсвечиваю', warning}) => {
	const pct = progress.total ? (progress.current / progress.total) * 100 : 0;

	return (
		<div className={`nmo-strip nmo-strip-running ${warning ? 'warning' : ''} nmo-fade-up`}>
			<div className="nmo-strip-running-head">
				<div className="nmo-strip-running-label">
					<span className="nmo-pulse nmo-strip-running-dot"/>
					<span>{title} · {progress.current} / {progress.total}</span>
				</div>
				<div className="nmo-strip-running-counts">
					<span className="ok">{progress.found}</span>
					<span className="sep">·</span>
					<span className="warn">{progress.missed}</span>
				</div>
			</div>
			<div className={`nmo-progress ${warning ? 'warning' : ''}`}>
				<div style={{width: `${pct}%`}}/>
			</div>
		</div>
	);
};

export default RunningStrip;
