import React from 'react';
import cn from 'classnames';
import {MIN_AUTO_SOLVE_DELAY_SECONDS, useSettings} from '../../contexts/SettingsContext';
import {IconCheck} from '../icons';

const AutoSolveSettings: React.FC = () => {
	const {
		autoSolveEnabled,
		setAutoSolveEnabled,
		autoSolveDelayMinSeconds,
		setAutoSolveDelayMinSeconds,
		autoSolveDelayMaxSeconds,
		setAutoSolveDelayMaxSeconds,
	} = useSettings();

	return (
		<>
			<label className={cn('nmo-settings-option', {on: autoSolveEnabled})}
				role="menuitemcheckbox"
				aria-checked={autoSolveEnabled}>
				<input type="checkbox"
					className="nmo-settings-option-input"
					checked={autoSolveEnabled}
					onChange={e => setAutoSolveEnabled(e.target.checked)}/>
				<span className="nmo-settings-option-text">Решать автоматически</span>
				<span className="nmo-settings-option-check" aria-hidden="true">
					<IconCheck size={12}/>
				</span>
			</label>

			<div className={cn('nmo-settings-section', {disabled: !autoSolveEnabled})} aria-disabled={!autoSolveEnabled}>
				<div className="nmo-settings-section-title">Интервал прохождения вопроса</div>

				<div className="nmo-settings-range">
					<label className="nmo-settings-number-field">
						<span>Мин, сек</span>
						<input type="number"
							min={MIN_AUTO_SOLVE_DELAY_SECONDS}
							step={1}
							value={autoSolveDelayMinSeconds}
							disabled={!autoSolveEnabled}
							onChange={e => setAutoSolveDelayMinSeconds(e.currentTarget.valueAsNumber)}/>
					</label>

					<label className="nmo-settings-number-field">
						<span>Макс, сек</span>
						<input type="number"
							min={autoSolveDelayMinSeconds}
							step={1}
							value={autoSolveDelayMaxSeconds}
							disabled={!autoSolveEnabled}
							onChange={e => setAutoSolveDelayMaxSeconds(e.currentTarget.valueAsNumber)}/>
					</label>
				</div>
			</div>
		</>
	);
};

export default AutoSolveSettings;
