import React from 'react';
import cn from 'classnames';
import type {IExtensionState} from './types';
import {PanelUiProvider, usePanelUi} from './contexts/PanelUiContext';
import {PanelStatusProvider} from './contexts/PanelStatusContext';
import {QuestionFinderProvider} from './contexts/QuestionFinderContext';
import {BugReportProvider} from './contexts/BugReportContext';
import {PdfScoreProvider} from './contexts/PdfScoreContext';
import {SettingsProvider} from './contexts/SettingsContext';
import ErrorBoundary from './components/ErrorBoundary';
import Header from './components/Header';
import TabBar from './components/TabBar';
import SectionAuto from './components/SectionAuto';
import SectionSites from './components/SectionSites';
import SectionAi from './components/SectionAi';
import SectionPdf from './components/SectionPdf';
import CollapsedPill from './components/CollapsedPill';
import AnswerHighlighter from './components/Loader/AnswerHighlighter';
import QuestionCacheCollector from './components/Loader/QuestionCacheCollector';
import AnswerSharingLoader from './components/Loader/AnswerSharingLoader';
import AnswerScoreHighlighter from './components/Loader/AnswerScoreHighlighter';
import AutoSolveLoader from './components/Loader/AutoSolveLoader';
import QuizActionsStatus from './components/QuizActionsStatus';

const FullPanel: React.FC<{initialState: IExtensionState}> = ({initialState}) => {
	const {mode} = usePanelUi();

	return (
		<>
			<Header/>
			<div className="nmo-body">
				<TabBar/>
				<ErrorBoundary>
					{mode === 'auto' && <SectionAuto/>}
					{mode === 'sites' && <SectionSites initialUrl={initialState.savedUrl}/>}
					{mode === 'ai' && <SectionAi/>}
					{mode === 'pdf' && <SectionPdf/>}
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
			<div className={cn('nmo-fullpanel', {hidden: collapsed})}>
				<FullPanel initialState={initialState}/>
			</div>
			{collapsed && <CollapsedPill/>}
		</>
	);
};

const App: React.FC<{initialState: IExtensionState}> = ({initialState}) => (
	<PanelUiProvider initialState={initialState}>
		<SettingsProvider initialState={initialState}>
			<BugReportProvider>
				<PanelStatusProvider>
					<QuestionFinderProvider>
						<PdfScoreProvider>
							<ErrorBoundary>
								<AnswerHighlighter/>
								<QuestionCacheCollector/>
								<AnswerSharingLoader/>
								<AnswerScoreHighlighter/>
								<AutoSolveLoader/>
								<QuizActionsStatus/>
								<PanelShell initialState={initialState}/>
							</ErrorBoundary>
						</PdfScoreProvider>
					</QuestionFinderProvider>
				</PanelStatusProvider>
			</BugReportProvider>
		</SettingsProvider>
	</PanelUiProvider>
);

export default App;
