import {useEffect} from 'react';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';
import {useQuestionFinder} from '../../contexts/QuestionFinderContext';
import {usePanelStatus} from '../../contexts/PanelStatusContext';
import {usePdfScore, type IPdfScoreVariant} from '../../contexts/PdfScoreContext';
import {answerCache} from '../../utils/answer-cache';
import {Status} from '../../types';
import {StatusTitle} from '../../utils/constants';

export interface IPdfLoaderState {
	readonly processing: boolean;
}

interface IPdfLoaderProps {
	readonly pdfData: ArrayBuffer | null;
	readonly onChange: (state: IPdfLoaderState) => void;
}

function ensurePdfWorker() {
	const workerSrc = chrome.runtime.getURL('pdf.worker.min.mjs');
	if (pdfjsLib.GlobalWorkerOptions.workerSrc !== workerSrc) {
		pdfjsLib.GlobalWorkerOptions.workerSrc = workerSrc;
	}
}

const PdfLoader = ({pdfData, onChange}: IPdfLoaderProps) => {
	const {topic, question, variants, isSingle} = useQuestionFinder();
	const {setStatus} = usePanelStatus();
	const {setPdfScore} = usePdfScore();

	useEffect(() => {
		if (!pdfData || !question || !variants.length) {
			onChange({processing: false});
			return;
		}
		if (answerCache.has(topic, question, variants)) {
			onChange({processing: false});
			return;
		}

		let cancelled = false;

		const run = async () => {
			onChange({processing: true});
			setStatus({title: 'анализирую PDF...', status: Status.LOADING});

			try {
				const {answerQuestion} = await import('nmo-pdf');
				ensurePdfWorker();
				if (cancelled) return;

				const result = await answerQuestion(new Uint8Array(pdfData.slice(0)), {
					question,
					variants,
					type: isSingle ? 'single' : 'multi',
					pdfjsLib,
				});

				if (cancelled) return;

				setPdfScore(topic ?? '', question, variants, toPdfScoreVariants(variants, result.scores, result.selected));

				if (!result.selected.length) {
					setStatus({title: StatusTitle.ANSWER_NOT_FOUND, status: Status.WARN});
					return;
				}

				answerCache.set(topic ?? '', question, variants, result.selected);

				const conf = Math.round(result.confidence * 100);

				if (result.confidence < 0.5) setStatus({title: `низкая уверенность (${conf}%) • PDF`, status: Status.WARN});
				else setStatus({title: `найдено (${conf}%) • PDF`, status: Status.OK});

			} catch (err) {
				if (!cancelled) {
					console.error('[nmo-pdf]', err);
					setStatus({title: 'ошибка анализа PDF', status: Status.ERR});
				}
			} finally {
				if (!cancelled) onChange({processing: false});
			}
		};

		run();
		return () => { cancelled = true; };
	}, [pdfData, question, variants, topic, isSingle, onChange, setStatus, setPdfScore]);

	return null;
};

export default PdfLoader;

function toPdfScoreVariants(variants: string[], scores: Array<{readonly id: string; readonly variant: string; readonly score: number; readonly raw: number}>, selected: string[]): IPdfScoreVariant[] {
	const scoreByTitle = new Map(scores.map(score => [norm(score.variant), score]));
	const selectedTitles = new Set(selected.map(norm));

	return variants.map((title, index) => {
		const indexedScore = scores[index];
		const score = indexedScore && norm(indexedScore.variant) === norm(title)
			? indexedScore
			: scoreByTitle.get(norm(title)) ?? indexedScore;

		return {
			id: score?.id ?? String(index),
			title,
			score: score?.score ?? 0,
			raw: score?.raw,
			selected: selectedTitles.has(norm(title)),
		};
	});
}

const norm = (value: string): string => value.trim().toLowerCase();
