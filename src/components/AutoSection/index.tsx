import React, { useEffect, useState } from 'react';
import { usePanelStatus } from '../../contexts/PanelStatusContext';
import { useQuestionFinder } from '../../contexts/QuestionFinderContext';
import { answerCache } from '../../utils/answer-cache';
import { Status } from '../../types';
import VariantLoader from '../Loader/VariantLoader';
import AnswerLoader from '../Loader/AnswerLoader';
import BugReportButton from '../BugReportButton';
import type { IVariantModel } from '../Loader/VariantLoader';
import type { IAnswerModel } from '../Loader/AnswerLoader';
import { StatusTitle, LOW_CONFIDENCE_THRESHOLD } from '../../utils/constants';
import {detectSource, pickResult} from '../../utils';
import {findAnswers, extractCases} from '../../utils/cases';

const AutoSection: React.FC<unknown> = (): React.JSX.Element => {
	const { status, setStatus } = usePanelStatus();
	const { topic, rawTopic, question, variants } = useQuestionFinder();

	// url
	const [rosmedUrl, setRosmedUrl] = useState('');
	const [forcareUrl, setForcareUrl] = useState('');
	const [activeUrl, setActiveUrl] = useState('');

	//html
	const [html, setHtml] = useState<HTMLElement | null>(null);


	const _updateSearchUrl = (state: IVariantModel): void => {
		// Ждём появления вопроса — на карточке с одной темой молчим
		if (!question) return;

		if (state.loading) return setStatus({title: StatusTitle.SEARCHING_ANSWERS, status: Status.LOADING});
		if (state.error) return setStatus({title: state.error, status: Status.WARN});

		// Нет темы — не на странице с вопросами, молчим
		if (!state.data.length && !rawTopic) return;

		const ros = pickResult(state.data, 'rosmedicinfo', topic);
		const fc = pickResult(state.data, '24forcare', topic);

		setRosmedUrl(ros?.url ?? '');
		setForcareUrl(fc?.url ?? '');

		setActiveUrl(ros?.url ?? fc?.url ?? '');
		// ничего не нашли кидаем предупреждение
		if (!ros && !fc) setStatus({ title: StatusTitle.NOT_FOUND, status: Status.WARN });
	};

	const _updateHtml = (state: IAnswerModel): void => {
		setHtml(state.data);

		if (state.loading) return setStatus({title: StatusTitle.LOADING_ANSWERS, status: Status.LOADING});


		if (state.error) {
			// ищем в forcareUrldataSource
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
		if (!question || !variants.length || !html) return;

		// уже в кеше — пропускаем
		if (answerCache.has(topic, question, variants)) return;

		const source = detectSource(activeUrl);
		if (!source) return;   // activeUrl ещё не опознан / пустой

		// собираем все пары вопрос/варианты/ответы из html источника
		const model = extractCases(source, html);

		// ищем нужный case и получаем правильные варианты уже в терминах ВХОДНЫХ variants
		const found = findAnswers(model, question, variants);
		if (!found) return setStatus({ title: StatusTitle.ANSWER_NOT_FOUND, status: Status.WARN });
		if (!found.answers.length) return setStatus({ title: StatusTitle.ANSWER_MISMATCH, status: Status.WARN });

		answerCache.set(topic ?? '', question, variants, found.answers);

		const label = activeUrl === rosmedUrl ? 'rosmed' : '24forcare';

		if (found.score < LOW_CONFIDENCE_THRESHOLD) {
			setStatus({title: `${StatusTitle.ANSWER_LOW_CONFIDENCE} \u2022 ${label}`, status: Status.WARN});
		}
		else setStatus({title: `найдено \u2022 ${label}`, status: Status.OK});


	}, [question, variants, topic, html]);

	const isWarning = status.status === Status.WARN;
	const warnTitles: string[] = [StatusTitle.ANSWER_NOT_FOUND, StatusTitle.ANSWER_MISMATCH, StatusTitle.ANSWER_LOW_CONFIDENCE];
	const isNotFound = warnTitles.includes(status.title);

	const _topc = question ? topic ?? null : null;

 	return (
		<div className="nmo-section">
			<VariantLoader text={_topc} onChange={_updateSearchUrl} />
			<AnswerLoader url={activeUrl} onChange={_updateHtml} />
			<div className={`nmo-status ${status.status}`}>{status.title}</div>

			{isWarning && isNotFound && !!activeUrl && <BugReportButton activeUrl={activeUrl}/>}
		</div>
	);
};

export default AutoSection;