import React from 'react';
import type {IExtensionState} from './types';
import {PanelUiProvider, usePanelUi} from './contexts/PanelUiContext';
import {PanelStatusProvider} from './contexts/PanelStatusContext';
import {QuestionFinderProvider} from './contexts/QuestionFinderContext';
import {BugReportProvider} from './contexts/BugReportContext';
import {PdfScoreProvider} from './contexts/PdfScoreContext';
import ErrorBoundary from './components/ErrorBoundary';
import Header from './components/Header';
import TabBar from './components/TabBar';
import AutoSection from './components/AutoSection';
import SitesSection from './components/SitesSection';
import AiSection from './components/AiSection';
import PdfSection from './components/PdfSection';
import CollapsedPill from './components/CollapsedPill';
import AnswerHighlighter from './components/Loader/AnswerHighlighter';
import AnswerScoreHighlighter from './components/Loader/AnswerScoreHighlighter';

const FullPanel: React.FC<{initialState: IExtensionState}> = ({initialState}) => {
	const {mode} = usePanelUi();

	return (
		<>
			<Header/>
			<div className="nmo-body">
				<TabBar/>
				<ErrorBoundary>
					{mode === 'auto' && <AutoSection/>}
					{mode === 'sites' && <SitesSection initialUrl={initialState.savedUrl}/>}
					{(mode === 'ai' || mode === 'ai-pro') && <AiSection/>}
					{mode === 'pdf' && <PdfSection/>}
				</ErrorBoundary>
			</div>
		</>
	);
};

const PanelShell: React.FC<{initialState: IExtensionState}> = ({initialState}) => {
	const {collapsed} = usePanelUi();
	// FullPanel остаётся в DOM, чтобы AI/loader'ы продолжали работать —
	// схлопывание/расхлопывание чисто визуальное.
	return (
		<>
			<div className={`nmo-fullpanel ${collapsed ? 'hidden' : ''}`}>
				<FullPanel initialState={initialState}/>
			</div>
			{collapsed && <CollapsedPill/>}
		</>
	);
};

const App: React.FC<{initialState: IExtensionState}> = ({initialState}) => (
	<PanelUiProvider
		initialCollapsed={initialState.savedCollapsed}
		initialMode={initialState.savedMode}>
		<BugReportProvider>
			<PanelStatusProvider>
				<QuestionFinderProvider>
					<PdfScoreProvider>
						<ErrorBoundary>
							<AnswerHighlighter/>
							<AnswerScoreHighlighter/>
							<PanelShell initialState={initialState}/>
						</ErrorBoundary>
					</PdfScoreProvider>
				</QuestionFinderProvider>
			</PanelStatusProvider>
		</BugReportProvider>
	</PanelUiProvider>
);

export default App;
