import React, {createContext, useCallback, useContext, useMemo, useState} from 'react';

export interface IBugReportContextSnapshot {
	readonly panelMode: string;
	readonly panelTab: string;
	readonly activeUrl: string;
}

interface IBugReportContextState extends IBugReportContextSnapshot {
	readonly setBugReportContext: (next: Partial<IBugReportContextSnapshot>) => void;
}

const EMPTY_CONTEXT: IBugReportContextSnapshot = {
	panelMode: '',
	panelTab: '',
	activeUrl: '',
};

const BugReportContext = createContext<IBugReportContextState>({
	...EMPTY_CONTEXT,
	setBugReportContext: () => undefined,
});

export const BugReportProvider: React.FC<React.PropsWithChildren> = ({children}) => {
	const [snapshot, setSnapshot] = useState<IBugReportContextSnapshot>(EMPTY_CONTEXT);

	const setBugReportContext = useCallback((next: Partial<IBugReportContextSnapshot>) => {
		setSnapshot(prev => {
			const merged = {...prev, ...next};
			if (
				merged.panelMode === prev.panelMode &&
				merged.panelTab === prev.panelTab &&
				merged.activeUrl === prev.activeUrl
			) {
				return prev;
			}
			return merged;
		});
	}, []);

	const value = useMemo<IBugReportContextState>(() => ({
		...snapshot,
		setBugReportContext,
	}), [snapshot, setBugReportContext]);

	return (
		<BugReportContext.Provider value={value}>
			{children}
		</BugReportContext.Provider>
	);
};

export const useBugReportContext = () => useContext(BugReportContext);
