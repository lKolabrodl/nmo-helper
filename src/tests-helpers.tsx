import React from 'react';
import { render } from '@testing-library/react';
import type { RenderOptions } from '@testing-library/react';
import { PanelUiProvider } from '../src/contexts/PanelUiContext';
import { PanelStatusProvider } from '../src/contexts/PanelStatusContext';
import { QuestionFinderProvider } from '../src/contexts/QuestionFinderContext';

interface IProviderOptions {
	readonly initialMode?: string;
	readonly initialCollapsed?: boolean;
}

const Providers: React.FC<React.PropsWithChildren<IProviderOptions>> = ({
	children,
	initialMode = 'auto',
	initialCollapsed = false,
}) => (
	<PanelUiProvider initialCollapsed={initialCollapsed} initialMode={initialMode}>
		<PanelStatusProvider>
			<QuestionFinderProvider>
				{children}
			</QuestionFinderProvider>
		</PanelStatusProvider>
	</PanelUiProvider>
);

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
