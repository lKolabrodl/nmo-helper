import React, {useState} from 'react';
import './styles.scss';
import {IconCheck, IconRefresh} from '../icons';
import {checkVersion, isOutdated, type IVersionInfo} from '../../api/version-check';

const EXT_VERSION = (typeof chrome !== 'undefined' && chrome.runtime?.getManifest?.()?.version) || '0.0.0';

type State = 'idle' | 'checking' | 'uptodate' | 'outdated';

interface IProps {
	readonly onOutdated?: (info: IVersionInfo) => void;
}

const VersionCheck: React.FC<IProps> = ({onOutdated}) => {
	const [state, setState] = useState<State>('idle');
	const [hover, setHover] = useState(false);

	const handleClick = async () => {
		if (state === 'checking') return;
		setState('checking');
		try {
			const info = await checkVersion();
			if (isOutdated(info)) {
				setState('outdated');
				onOutdated?.(info);
			} else {
				setState('uptodate');
				setTimeout(() => setState('idle'), 2500);
			}
		} catch {
			setState('idle');
		}
	};

	const tooltip =
		state === 'idle' ? 'Проверить обновления'
		: state === 'checking' ? 'Проверяю на сервере…'
		: state === 'uptodate' ? 'У вас последняя версия'
		: 'Доступно обновление';

	const cls = `nmo-chip nmo-version-chip ${state}`;

	return (
		<div className="nmo-version-wrap"
			onMouseEnter={() => setHover(true)}
			onMouseLeave={() => setHover(false)}>
			<button type="button"
				className={cls}
				disabled={state === 'checking'}
				onClick={handleClick}>
				<span className="nmo-version-icon">
					{state === 'checking' && <span className="nmo-spinner" style={{width: 9, height: 9, borderWidth: 1.4}}/>}
					{state === 'uptodate' && <IconCheck size={10}/>}
					{state === 'outdated' && <span className="nmo-version-dot"/>}
					{state === 'idle' && <IconRefresh size={10} className={hover ? 'rot' : ''}/>}
				</span>
				<span>v{EXT_VERSION}</span>
			</button>

			{hover && state !== 'checking' && (
				<div className="nmo-version-tip nmo-fade-up">{tooltip}</div>
			)}
		</div>
	);
};

export default VersionCheck;
