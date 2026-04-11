import './styles.scss';
import { usePanelUi } from '../../contexts/PanelUiContext';
import type { UiMode } from '../../contexts/PanelUiContext';

const TABS: { mode: UiMode; label: string }[] = [
	{ mode: 'auto', label: 'Авто' },
	{ mode: 'sites', label: 'Сайты' },
	{ mode: 'ai', label: 'AI' },
];

const TabBar = () => {
	const { mode, setMode } = usePanelUi();

	// AI-Pro считается подрежимом AI — таб AI активен для обоих
	const handleClick = (next: UiMode) => setMode(next);

	const activeTab = (mode === 'ai' || mode === 'ai-pro') ? 'ai' : mode;

	return (
		<div className="nmo-tabs">
			{TABS.map(tab => (
				<button
					key={tab.mode}
					className={`nmo-tab ${activeTab === tab.mode ? 'active' : ''}`}
					onClick={() => handleClick(tab.mode)}>
					{tab.label}
				</button>
			))}
		</div>
	);
};

export default TabBar;
