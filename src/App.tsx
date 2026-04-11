import type { IExtensionState } from './types';
import { PanelUiProvider, usePanelUi } from './contexts/PanelUiContext';
import { PanelStatusProvider } from './contexts/PanelStatusContext';
import { QuestionFinderProvider } from './contexts/QuestionFinderContext';
import Header from './components/Header';
import TabBar from './components/TabBar';
import AutoSection from './components/AutoSection';
import SitesSection from './components/SitesSection';
import AiSection from './components/AiSection';
import AnswerHighlighter from './components/Loader/AnswerHighlighter';

const PanelBody = ({ initialState }: { initialState: IExtensionState }) => {
	const { mode } = usePanelUi();

	return (
		<div className="nmo-body">
			<TabBar />
			{mode === 'auto' && <AutoSection />}
			{mode === 'sites' && <SitesSection initialUrl={initialState.savedUrl} />}
			{(mode === 'ai' || mode === 'ai-pro') && <AiSection />}
		</div>
	);
};

const App = ({ initialState }: { initialState: IExtensionState }) => (
	<PanelUiProvider
		initialCollapsed={initialState.savedCollapsed}
		initialMode={initialState.savedMode}
	>
		<PanelStatusProvider>
			<QuestionFinderProvider>
				<Header />
				<AnswerHighlighter />
				<PanelBody initialState={initialState} />
			</QuestionFinderProvider>
		</PanelStatusProvider>
	</PanelUiProvider>
);

export default App;
