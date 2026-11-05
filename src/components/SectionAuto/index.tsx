import React, {useEffect, useRef, useState} from 'react';
import './styles.scss';
import {usePanelStatus} from '../../contexts/PanelStatusContext';
import {useQuestionFinder} from '../../contexts/QuestionFinderContext';
import {useBugReportContext} from '../../contexts/BugReportContext';
import {answerCache} from '../../utils/answer-cache';
import {Status} from '../../types';
import VariantLoader from '../Loader/VariantLoader';
import AnswerLoader from '../Loader/AnswerLoader';
import AIProxyFreeLoader from '../Loader/AIProxyFreeLoader';
import {StatusTitle, LOW_CONFIDENCE_THRESHOLD} from '../../utils/constants';
import {pickResult} from '../../utils';
import {findAnswers} from '../../utils/cases';
import {IconBolt} from '../icons';
import InlineToast from '../ui/InlineToast';
import ThinkingStrip from '../ui/ThinkingStrip';
import {statusToToast} from './utils';
import type {IVariantModel} from '../Loader/VariantLoader';
import type {IAnswerModel} from '../Loader/AnswerLoader';

const EMPTY_ANSWER_MODEL: IAnswerModel = {loading: false, error: null, data: null};
const EMPTY_ANSWER_SOURCE_STATE: IAnswerSourceState = {url: '', model: EMPTY_ANSWER_MODEL};

interface IAnswerSourceState {
	readonly url: string;
	readonly model: IAnswerModel;
}

const SectionAuto: React.FC = (): React.JSX.Element => {
	const {status, setStatus} = usePanelStatus();
	const {topic, question, variants, isSingle} = useQuestionFinder();
	const {setBugReportContext} = useBugReportContext();

	// models
	const [nmoHelperSource, setNmoHelperSource] = useState<IAnswerSourceState>(EMPTY_ANSWER_SOURCE_STATE);
	const [firstSource, setFirstSource] = useState<IAnswerSourceState>(EMPTY_ANSWER_SOURCE_STATE);
	const [secondarySource, setSecondarySource] = useState<IAnswerSourceState>(EMPTY_ANSWER_SOURCE_STATE);
	const [thirdSource, setThirdSource] = useState<IAnswerSourceState>(EMPTY_ANSWER_SOURCE_STATE);
	const [activeAiQuestionKey, setActiveAiQuestionKey] = useState<string | null>(null);

	const sourceTopicRef = useRef<string | null | undefined>(undefined);
	const aiAttemptRef = useRef({questionKey: '', attempted: false});

	const questionKey = JSON.stringify([topic, question, variants, isSingle]);

	// Инициализация контекста при каждом входе в режим «Авто».
	useEffect(() => setBugReportContext({mode: 'auto', url: ''}), [setBugReportContext]);

	const _updateSearchUrl = (state: IVariantModel): void => {
		if (!question) return;

		if (state.loading) {
			setActiveAiQuestionKey(null);
			sourceTopicRef.current = undefined;
			setFirstSource(EMPTY_ANSWER_SOURCE_STATE);
			setSecondarySource(EMPTY_ANSWER_SOURCE_STATE);
			setNmoHelperSource(EMPTY_ANSWER_SOURCE_STATE);
			setThirdSource(EMPTY_ANSWER_SOURCE_STATE);
			// init status
			setBugReportContext({mode: 'auto', url: ''});
			return setStatus({title: StatusTitle.SEARCHING_ANSWERS, status: Status.LOADING});
		}

		sourceTopicRef.current = topic;
		const results = state.error ? [] : state.data;

		const nmoHelperResult = pickResult(results, 'nmo-helper', topic);
		const primaryResult = pickResult(results, 'first', topic);
		const secondaryResult = pickResult(results, 'second', topic);
		const fooResult = pickResult(results, 'third', topic);

		const nextPrimarySourceUrl = primaryResult?.url ?? '';
		const nextSecondarySourceUrl = secondaryResult?.url ?? '';
		const nextNmoHelperUrl = nmoHelperResult?.url ?? '';
		const nextFooUrl = fooResult?.url ?? '';

		setFirstSource({url: nextPrimarySourceUrl, model: {...EMPTY_ANSWER_MODEL, loading: !!nextPrimarySourceUrl}});
		setSecondarySource({url: nextSecondarySourceUrl, model: {...EMPTY_ANSWER_MODEL, loading: !!nextSecondarySourceUrl}});
		setNmoHelperSource({url: nextNmoHelperUrl, model: {...EMPTY_ANSWER_MODEL, loading: !!nextNmoHelperUrl}});
		setThirdSource({url: nextFooUrl, model: {...EMPTY_ANSWER_MODEL, loading: !!nextFooUrl}});

		// update report
		setBugReportContext({
			mode: 'auto',
			url: nextNmoHelperUrl || nextPrimarySourceUrl || nextSecondarySourceUrl || nextFooUrl,
		});
	};

	useEffect(() => {
		const questionKey = JSON.stringify([topic, question, variants, isSingle]);
		if (aiAttemptRef.current.questionKey !== questionKey) {
			aiAttemptRef.current = {questionKey, attempted: false};
		}
		if (!question || !variants.length || sourceTopicRef.current !== topic) return;
		if (answerCache.has(topic, question, variants)) {
			setActiveAiQuestionKey(null);
			setStatus({title: 'найдено в памяти', status: Status.OK});
			return;
		}

		const sources = [
			{label: 'nmo-helper', ...nmoHelperSource},
			...(nmoHelperSource.url && nmoHelperSource.model.error ? [
				{label: 'база 1', ...firstSource},
				{label: 'база 2', ...secondarySource},
				{label: 'база 3', ...thirdSource},
			] : []),
		].filter(source => source.url);

		for (const source of sources) {
			if (!source.model.data?.length) continue;

			const found = findAnswers(source.model.data, question, variants);

			if (!found?.answers.length) continue;

			answerCache.set(topic ?? '', question, variants, found.answers);
			setActiveAiQuestionKey(null);
			setBugReportContext({mode: 'auto', url: source.url});

			if (found.score < LOW_CONFIDENCE_THRESHOLD) {
				setStatus({title: `${StatusTitle.ANSWER_LOW_CONFIDENCE} • ${source.label}`, status: Status.WARN});
			}
			else setStatus({title: `найдено • ${source.label}`, status: Status.OK});

			return;
		}

		const isLoading = sources.some(source => source.model.loading);
		if (isLoading) return setStatus({title: StatusTitle.LOADING_ANSWERS, status: Status.LOADING});

		// Поиск завершён, но ответа на текущий вопрос нет: запускаем AI
		// один раз за посещение вопроса, включая пустую выдачу и ошибки источников.
		if (aiAttemptRef.current.attempted) return;
		aiAttemptRef.current.attempted = true;
		setBugReportContext({mode: 'auto', url: ''});
		setActiveAiQuestionKey(questionKey);

	}, [topic, question, variants, isSingle, firstSource, secondarySource, nmoHelperSource, thirdSource, setBugReportContext, setStatus]);

	const isWarning = status.status === Status.WARN;
	const isError = status.status === Status.ERR;
	const isLoading = status.status === Status.LOADING;
	const isOk = status.status === Status.OK;

	const searchTopic = question ? topic ?? null : null;

	// Остальные источники загружаем только при ошибке загрузки по найденному URL nmo-helper.
	// Пустые данные и отсутствие URL не включают остальные источники.
	const loadOtherSources = Boolean(nmoHelperSource.url && nmoHelperSource.model.error);

	return (
		<div className="nmo-section">
			<VariantLoader text={searchTopic} onChange={_updateSearchUrl}/>
			<AnswerLoader url={nmoHelperSource.url}	onChange={model => setNmoHelperSource(source => ({...source, model}))}/>

			{loadOtherSources &&
				<>
					<AnswerLoader url={firstSource.url} onChange={model => setFirstSource(source => ({...source, model}))}/>
					<AnswerLoader url={secondarySource.url}	onChange={model => setSecondarySource(source => ({...source, model}))}/>
					<AnswerLoader url={thirdSource.url} onChange={model => setThirdSource(source => ({...source, model}))}/>
				</>
			}

			<AIProxyFreeLoader
				active={activeAiQuestionKey === questionKey && sourceTopicRef.current === topic}
				onChange={({running}) => setActiveAiQuestionKey(running ? questionKey : null)}
				onComplete={() => setActiveAiQuestionKey(null)}/>

			<div className="nmo-section-inner">
				<div className="nmo-auto-hero nmo-fade-up">
					<div className="nmo-auto-hero-icon"><IconBolt size={16}/></div>
					<div className="nmo-auto-hero-body">
						<div className="nmo-auto-hero-title">Автоматически</div>
						<div className="nmo-auto-hero-sub">
							Подсветим правильные варианты прямо на странице
						</div>
					</div>
				</div>
			</div>

			{isLoading && <ThinkingStrip title={status.title} steps={[]}/>}

			{(isWarning || isError || isOk) && status.title && <InlineToast toast={statusToToast(status.title, status.status)}/>}
		</div>
	);
};

export default SectionAuto;
