import React from 'react';
import { render } from '@testing-library/react';
import type { RenderOptions } from '@testing-library/react';
import { PanelUiProvider } from '../src/contexts/PanelUiContext';
import { PanelStatusProvider } from '../src/contexts/PanelStatusContext';
import { QuestionFinderProvider } from '../src/contexts/QuestionFinderContext';
import { PdfScoreProvider } from '../src/contexts/PdfScoreContext';
import { SettingsProvider } from '../src/contexts/SettingsContext';
import type { AiProvider, IExtensionState } from '../src/types';

interface IProviderOptions {
	readonly initialMode?: string;
	readonly initialAiProvider?: AiProvider;
	readonly initialApiKey?: string;
	readonly initialAiModel?: string;
	readonly initialCollapsed?: boolean;
}

const Providers: React.FC<React.PropsWithChildren<IProviderOptions>> = ({children, initialMode = 'auto', initialAiProvider = 'free', initialApiKey = '', initialAiModel = '', initialCollapsed = false}) => {
	const initialState: IExtensionState = {
		savedUrl: '',
		savedCollapsed: initialCollapsed,
		savedRight: null,
		savedTop: null,
		savedMode: initialMode,
		savedAiProvider: initialAiProvider,
		savedApiKey: initialApiKey,
		savedModel: initialAiModel,
		savedCustomAiUrl: '',
		savedCustomAiToken: '',
		savedCustomAiModel: '',
		savedAutoSolveEnabled: false,
		savedAutoSolveDelayMinSeconds: 5,
		savedAutoSolveDelayMaxSeconds: 12,
		savedTestDataSharingEnabled: false,
	};

	return (
		<PanelUiProvider initialState={initialState}>
			<SettingsProvider initialState={initialState}>
				<PanelStatusProvider>
					<QuestionFinderProvider>
						<PdfScoreProvider>
							{children}
						</PdfScoreProvider>
					</QuestionFinderProvider>
				</PanelStatusProvider>
			</SettingsProvider>
		</PanelUiProvider>
	);
};

export function renderWithProviders(ui: React.ReactElement,	options?: RenderOptions & IProviderOptions) {

	const { initialMode, initialAiProvider, initialApiKey, initialAiModel, initialCollapsed, ...renderOptions } = options ?? {};

	return render(ui, {
		wrapper: ({ children }) => (
			<Providers
				initialMode={initialMode}
				initialAiProvider={initialAiProvider}
				initialApiKey={initialApiKey}
				initialAiModel={initialAiModel}
				initialCollapsed={initialCollapsed}>
				{children}
			</Providers>
		),
		...renderOptions,
	});
}
