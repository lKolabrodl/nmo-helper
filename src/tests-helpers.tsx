import React from 'react';
import { render } from '@testing-library/react';
import type { RenderOptions } from '@testing-library/react';
import { PanelUiProvider } from '../src/contexts/PanelUiContext';
import { PanelStatusProvider } from '../src/contexts/PanelStatusContext';
import { QuestionFinderProvider } from '../src/contexts/QuestionFinderContext';
import { PdfScoreProvider } from '../src/contexts/PdfScoreContext';
import { SettingsProvider } from '../src/contexts/SettingsContext';
import type { IExtensionState } from '../src/types';
import {DEFAULT_AI_MODEL} from '../src/utils/constants';

interface IProviderOptions {
	readonly initialMode?: string;
	readonly initialCollapsed?: boolean;
}

const Providers: React.FC<React.PropsWithChildren<IProviderOptions>> = ({
	children,
	initialMode = 'auto',
	initialCollapsed = false,
}) => {
	const initialState: IExtensionState = {
		savedUrl: '',
		savedCollapsed: initialCollapsed,
		savedRight: null,
		savedTop: null,
		savedMode: initialMode,
		savedApiKey: '',
		savedModel: DEFAULT_AI_MODEL,
		savedCustomAiUrl: '',
		savedCustomAiToken: '',
		savedCustomAiModel: '',
		savedAutoSolveEnabled: false,
		savedAutoSolveDelayMinSeconds: 5,
		savedAutoSolveDelayMaxSeconds: 12,
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

export function renderWithProviders(
	ui: React.ReactElement,
	options?: RenderOptions & IProviderOptions,
) {
	const { initialMode, initialCollapsed, ...renderOptions } = options ?? {};

	return render(ui, {
		wrapper: ({ children }) => (
			<Providers initialMode={initialMode} initialCollapsed={initialCollapsed}>
				{children}
			</Providers>
		),
		...renderOptions,
	});
}
