import {useEffect} from 'react';
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

interface IPdfJsRuntime {
	readonly getDocument?: unknown;
	readonly GlobalWorkerOptions?: {
		workerSrc: string;
	};
}

interface IMedPdfGlobal {
	readonly pdfjsLib?: IPdfJsRuntime;
}

async function loadMedPdfNmo() {
	const medPdfNmo = await import('med-pdf-nmo/browser');
	const pdfjsLib = (globalThis as typeof globalThis & IMedPdfGlobal).pdfjsLib;

	if (!pdfjsLib?.GlobalWorkerOptions) {
		throw new Error('PDF.js browser runtime is not available.');
	}

	pdfjsLib.GlobalWorkerOptions.workerSrc = chrome.runtime.getURL('pdf.worker.min.mjs');
	medPdfNmo.setPdfJsLib(pdfjsLib);

	return medPdfNmo;
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
				const {answerQuestion} = await loadMedPdfNmo();
				if (cancelled) return;

				const options = {question, variants, type: isSingle ? 'single' : 'multi', includeSources: true};
				const result = await answerQuestion(new Uint8Array(pdfData.slice(0)), options);

				if (cancelled) return;

				setPdfScore(topic ?? '', question, variants, toPdfScoreVariants(variants, result.scores, result.selected), result.sources);

				if (!result.selected.length) {
					setStatus({title: StatusTitle.ANSWER_NOT_FOUND, status: Status.WARN});
					return;
				}

				answerCache.set(topic ?? '', question, variants, result.selected);

				const conf = Math.round(result.confidence * 100);

				if (result.confidence < 0.5) setStatus({title: `низкая уверенность ${conf}%`, status: Status.WARN});
				else setStatus({title: `найдено, уверенность ${conf}%`, status: Status.OK});

			} catch (err) {
				if (!cancelled) {
					console.error('[med-pdf-nmo]', err);
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

/**
 * Преобразует результаты анализа PDF в варианты ответов для отображения.
 *
 * Сопоставляет оценки с исходными вариантами по нормализованному тексту,
 * сохраняя их порядок. Если тексты не совпали, использует оценку с тем же
 * индексом; для отсутствующей оценки подставляет идентификатор индекса и ноль.
 *
 * @param variants Исходные варианты ответа.
 * @param scores Оценки вариантов, полученные при анализе PDF.
 * @param selected Тексты вариантов, выбранных анализатором.
 * @returns Варианты ответа с оценками и признаком выбора.
 */
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
