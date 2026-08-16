import React, {useEffect, useRef, useState} from 'react';
import cn from 'classnames';
import './styles.scss';
import {useSettings} from '../../contexts/SettingsContext';
import {IconCheck, IconSettings} from '../icons';
import AutoSolveSettings from './AutoSolveSettings';

interface ISettingsProps {
	readonly onOpen?: () => void;
}

const Settings: React.FC<ISettingsProps> = ({onOpen}) => {
	const settingsRef = useRef<HTMLDivElement>(null);
	const [open, setOpen] = useState(false);
	const {enabled: testDataSharingEnabled, setEnabled: setTestDataSharingEnabled} =
		useSettings().testDataSharing;

	useEffect(() => {
		if (!open) return;

		const closeOnOutside = (event: PointerEvent): void => {
			if (!settingsRef.current?.contains(event.target as Node)) setOpen(false);
		};

		const closeOnEscape = (event: KeyboardEvent): void => {
			if (event.key === 'Escape') setOpen(false);
		};

		document.addEventListener('pointerdown', closeOnOutside);
		document.addEventListener('keydown', closeOnEscape);

		return () => {
			document.removeEventListener('pointerdown', closeOnOutside);
			document.removeEventListener('keydown', closeOnEscape);
		};
	}, [open]);

	const _toggleOpen = (): void => {
		setOpen(current => {
			const next = !current;
			if (next) onOpen?.();
			return next;
		});
	};

	return (
		<div ref={settingsRef} className="nmo-settings">
			<button type="button"
				className={cn('nmo-icon-btn', 'nmo-settings-trigger', {active: open})}
				title="Настройки"
				aria-haspopup="menu"
				aria-expanded={open}
				onClick={_toggleOpen}>
				<IconSettings size={14}/>
			</button>

			{open && (
				<div className="nmo-settings-menu nmo-fade-up" role="menu">
					<AutoSolveSettings/>
					<div className="nmo-settings-divider"/>
					<label className={cn('nmo-settings-option', {on: testDataSharingEnabled})}
						role="menuitemcheckbox"
						aria-checked={testDataSharingEnabled}>
						<input type="checkbox"
							className="nmo-settings-option-input"
							checked={testDataSharingEnabled}
							onChange={e => setTestDataSharingEnabled(e.target.checked)}/>
						<span className="nmo-settings-option-text">Делиться данными теста</span>
						<span className="nmo-settings-option-check" aria-hidden="true">
							<IconCheck size={12}/>
						</span>
					</label>
				</div>
			)}
		</div>
	);
};

export default Settings;
