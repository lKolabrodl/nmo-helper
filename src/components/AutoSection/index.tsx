import React, { useEffect, useState } from 'react';
import { usePanelStatus } from '../../contexts/PanelStatusContext';
import { useQuestionFinder } from '../../contexts/QuestionFinderContext';
import { answerCache } from '../../utils/answer-cache';
import { findCorrectIndexes } from '../../utils/matching';
import { Status } from '../../types';
import VariantLoader from '../Loader/VariantLoader';
import AnswerLoader from '../Loader/AnswerLoader';
import type { IVariantLoaderState } from '../Loader/VariantLoader';
import type { IAnswerLoaderState } from '../Loader/AnswerLoader';
import { StatusTitle } from '../../utils/constants';

const AutoSection: React.FC<unknown> = () => {
	const { status, setStatus } = usePanelStatus();
	const { topic, rawTopic, question, variants } = useQuestionFinder();

	const [rosmedUrl, setRosmedUrl] = useState('');
	const [forcareUrl, setForcareUrl] = useState('');
	const [activeUrl, setActiveUrl] = useState('');
	const [parser, setParser] = useState<IAnswerLoaderState>({ loading: false, error: null, data: null });

	const handleSearch = (state: IVariantLoaderState): void => {
		if (state.loading) return setStatus({title: StatusTitle.SEARCHING_ANSWERS, status: Status.LOADING});
		if (state.error) return setStatus({title: state.error, status: Status.WARN});

		// Нет темы — не на странице с вопросами, молчим
		if (!state.data.length && !rawTopic) return;

		const ros = state.data.find(r => r.source === 'rosmedicinfo');
		const fc = state.data.find(r => r.source === '24forcare');

		setRosmedUrl(ros?.url ?? '');
		setForcareUrl(fc?.url ?? '');
		setActiveUrl(ros?.url ?? fc?.url ?? '');

		if (!ros && !fc) setStatus({ title: StatusTitle.NOT_FOUND, status: Status.WARN });
	};

	const handleLoader = (state: IAnswerLoaderState): void => {
		setParser(state);

		if (state.loading) return setStatus({title: StatusTitle.LOADING_ANSWERS, status: Status.LOADING});

		if (state.error) {
			// ищем в forcareUrl
			if (activeUrl === rosmedUrl && forcareUrl) return setActiveUrl(forcareUrl);
			// =( нет вариантов
			return setStatus({ title: StatusTitle.LOADING_FAILED, status: Status.ERR });
		}

		if (state.data) {
			const source = activeUrl === rosmedUrl ? 'rosmed' : '24fc';
			setStatus({ title: `загружено: ${source}`, status: Status.OK });
		}
	};

	useEffect(() => {
		if (!question || !variants.length || !parser.data) return;

		const t = topic ?? '';
		if (answerCache.get(t, question)) return;

		const answers = parser.data(question);

		// ничего не нашли =(
		if (!answers || !answers.length) return setStatus({title: StatusTitle.ANSWER_NOT_FOUND, status: Status.WARN});

		// полезли в кеш
		const correctIndexes = findCorrectIndexes(variants, answers);

		// опаньки ответы то не совпадают
		if (correctIndexes.length === 0) return setStatus({title: StatusTitle.ANSWER_MISMATCH, status: Status.WARN});

		const source = activeUrl === rosmedUrl ? 'rosmed' : '24forcare';
		// обогощаем кеш
		const _variants = variants.map((title, i) => ({title, answer: correctIndexes.includes(i)}));
		answerCache.set(t, question, {variants: _variants, source});

		setStatus({ title: `найдено \u2022 ${source}`, status: Status.OK });

	}, [question, variants, topic, parser.data, activeUrl, rosmedUrl]);

	return (
		<div className="nmo-section">
			<VariantLoader text={rawTopic ?? ''} onChange={handleSearch} />
			<AnswerLoader url={activeUrl} onChange={handleLoader} />
			<div className={`nmo-status ${status.status}`}>{status.title}</div>
		</div>
	);
};

export default AutoSection;
