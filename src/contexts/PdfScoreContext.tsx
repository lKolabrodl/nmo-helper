import React, {createContext, useCallback, useMemo, useState} from 'react';
import type {PredictionSources} from 'med-pdf-nmo/browser';

const PDF_SCORE_MAX_ENTRIES = 25;

export interface IPdfScoreVariant {
	readonly id: string;
	readonly title: string;
	readonly score: number;
	readonly raw?: number;
	readonly selected?: boolean;
}

export interface IPdfScoreModel {
	readonly id: string;
	readonly scores: IPdfScoreVariant[];
	readonly sources: PredictionSources | null;
	readonly updatedAt: number;
}

interface IPdfScoreContextState {
	readonly getPdfScore: (topic: string | null, question: string | null, variants: string[]) => IPdfScoreModel | null;
	readonly setPdfScore: (topic: string, question: string, variants: string[], scores: IPdfScoreVariant[], sources?: PredictionSources | null) => IPdfScoreModel;
	readonly clearPdfScore: (topic: string | null, question: string | null, variants: string[]) => void;
}

type PdfScoreStore = Record<string, IPdfScoreModel>;

const EMPTY_CONTEXT: IPdfScoreContextState = {
	getPdfScore: () => null,
	setPdfScore: (topic, question, variants, scores, sources = null) => ({
		id: makePdfScoreId(topic, question, variants),
		scores,
		sources,
		updatedAt: Date.now(),
	}),
	clearPdfScore: () => undefined,
};

const PdfScoreContext = createContext<IPdfScoreContextState>(EMPTY_CONTEXT);

export const PdfScoreProvider: React.FC<React.PropsWithChildren> = ({children}) => {
	const [scoresById, setScoresById] = useState<PdfScoreStore>({});

	const getPdfScore = useCallback((topic: string | null, question: string | null, variants: string[]) => {
		if (!question || !variants.length) return null;
		return scoresById[makePdfScoreId(topic ?? '', question, variants)] ?? null;
	}, [scoresById]);

	const setPdfScore = useCallback((topic: string, question: string, variants: string[], scores: IPdfScoreVariant[], sources: PredictionSources | null = null) => {
		const id = makePdfScoreId(topic, question, variants);
		const entry: IPdfScoreModel = {
			id,
			scores: scores.map(normalizeScoreVariant),
			sources,
			updatedAt: Date.now(),
		};

		setScoresById(prev => {
			const next = pruneStore({...prev, [id]: entry});
			return next;
		});

		return entry;
	}, []);

	const clearPdfScore = useCallback((topic: string | null, question: string | null, variants: string[]) => {
		if (!question || !variants.length) return;
		const id = makePdfScoreId(topic ?? '', question, variants);
		setScoresById(prev => {
			if (!(id in prev)) return prev;
			const next = {...prev};
			delete next[id];
			return next;
		});
	}, []);

	const value = useMemo<IPdfScoreContextState>(() => ({
		getPdfScore,
		setPdfScore,
		clearPdfScore,
	}), [getPdfScore, setPdfScore, clearPdfScore]);

	return (
		<PdfScoreContext.Provider value={value}>
			{children}
		</PdfScoreContext.Provider>
	);
};

export const usePdfScore = () => React.useContext(PdfScoreContext);

export function makePdfScoreId(topic: string, question: string, variants: string[]): string {
	const v = [...variants].map(norm).sort().join('|');
	return `${norm(topic)}::${norm(question)}::${v}`;
}

const norm = (s: string): string => s.trim().toLowerCase();

function normalizeScoreVariant(score: IPdfScoreVariant): IPdfScoreVariant {
	return {
		id: String(score.id),
		title: score.title,
		score: clampScore(score.score),
		raw: Number.isFinite(score.raw) ? score.raw : undefined,
		selected: score.selected === true,
	};
}

function clampScore(value: number): number {
	if (!Number.isFinite(value)) return 0;
	if (value < 0) return 0;
	if (value > 1) return 1;
	return value;
}

function pruneStore(store: PdfScoreStore): PdfScoreStore {
	const entries = Object.values(store)
		.sort((a, b) => b.updatedAt - a.updatedAt)
		.slice(0, PDF_SCORE_MAX_ENTRIES);

	return entries.reduce<PdfScoreStore>((acc, item) => {
		acc[item.id] = item;
		return acc;
	}, {});
}
