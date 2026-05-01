import React from 'react';
import './styles.scss';
import {usePanelUi} from '../../contexts/PanelUiContext';
import type {UiMode} from '../../contexts/PanelUiContext';
import {IconBolt, IconBrain, IconGlobe} from '../icons';

const TABS: {mode: UiMode; label: string; Icon: React.FC<{size?: number}>}[] = [
	{mode: 'auto',  label: 'Авто',  Icon: IconBolt},
	{mode: 'sites', label: 'Сайты', Icon: IconGlobe},
	{mode: 'ai',    label: 'AI',    Icon: IconBrain},
];

const TabBar: React.FC = () => {
	const {mode, setMode} = usePanelUi();

	const activeTab: UiMode = (mode === 'ai' || mode === 'ai-pro') ? 'ai' : mode;

	return (
		<div className="nmo-tabs-wrap">
			<div className="nmo-seg">
				{TABS.map(({mode: m, label, Icon}) => (
					<button key={m}
						type="button"
						className={activeTab === m ? 'active' : ''}
						onClick={() => setMode(m)}>
						<Icon size={12}/>
						<span>{label}</span>
					</button>
				))}
			</div>
		</div>
	);
};

export default TabBar;
