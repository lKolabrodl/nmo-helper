import React, {useEffect, useRef, useState} from 'react';
import './styles.scss';
import {usePanelStatus} from '../../contexts/PanelStatusContext';
import {useQuestionFinder} from '../../contexts/QuestionFinderContext';
import {useBugReportContext} from '../../contexts/BugReportContext';
import {answerCache} from '../../utils/answer-cache';
import {Status} from '../../types';
import type {ISearchResult} from '../../types';
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

type SourceKey = ISearchResult['source'];
const SOURCE_LABELS: Record<SourceKey, string> = {
	'nmo-helper': 'nmo-helper', first: 'база 1', second: 'база 2', third: 'база 3',
};

interface ISourceState {
	readonly url: string;
	readonly loading: boolean;
	readonly source: SourceKey;
	readonly error: string | null;
}

const SectionAuto: React.FC = (): React.JSX.Element => {
	const {status, setStatus} = usePanelStatus();
	const {topic, question, variants, isSingle} = useQuestionFinder();
	const {setBugReportContext} = useBugReportContext();

	const [sourceState, setSourceState] = useState<ISourceState>({url: '', loading: false, source: 'nmo-helper', error: null});
	const [answerModel, setAnswerModel] = useState<IAnswerModel>(EMPTY_ANSWER_MODEL);
	const [activeAiQuestionKey, setActiveAiQuestionKey] = useState<string | null>(null);

	const sourceTopicRef = useRef<string | null | undefined>(undefined);
	const aiAttemptRef = useRef({questionKey: '', attempted: false});

	const questionKey = JSON.stringify([topic, question, variants, isSingle]);
	const {url, loading, source, error} = sourceState;


	// Инициализация контекста при каждом входе в режим «Авто».
	useEffect(() => setBugReportContext({mode: 'auto', url: ''}), [setBugReportContext]);

	const _updateSearchUrl = (source: SourceKey, state: IVariantModel): void => {
		if (state.loading) setStatus({title: StatusTitle.SEARCHING_ANSWERS, status: Status.LOADING});

		if (source === 'nmo-helper') {
			setActiveAiQuestionKey(null);
			sourceTopicRef.current = state.loading ? undefined : topic;
		}

		const url = state.loading || state.error ? '' : pickResult(state.data, source, topic)?.url ?? '';
		let error = state.error;
		if (!state.loading && !state.data.length && source !== 'nmo-helper') error = 'ничего не найдено';

		setSourceState({url, loading: state.loading || !!url, source, error});
		setAnswerModel(EMPTY_ANSWER_MODEL);
		setBugReportContext({mode: 'auto', url});
	};

	const _updateAnswers = (model: IAnswerModel): void => {
		setAnswerModel(model);
		setSourceState(previous => ({...previous, loading: model.loading, error: model.error}));
	};

	useEffect(() => {
		const questionKey = JSON.stringify([topic, question, variants, isSingle]);
		if (aiAttemptRef.current.questionKey !== questionKey) aiAttemptRef.current = {questionKey, attempted: false};

		if (!question || !variants.length || sourceTopicRef.current !== topic) return;

		if (answerCache.has(topic, question, variants)) {
			setActiveAiQuestionKey(null);
			setStatus({title: 'найдено в памяти', status: Status.OK});
			return;
		}

		const found = findAnswers(answerModel.data, question, variants);

		if (found?.answers.length) {

			answerCache.set(topic ?? '', question, variants, found.answers);
			setActiveAiQuestionKey(null);
			setBugReportContext({mode: 'auto', url});

			if (found.score < LOW_CONFIDENCE_THRESHOLD) {
				setStatus({title: `${StatusTitle.ANSWER_LOW_CONFIDENCE} • ${SOURCE_LABELS[source]}`, status: Status.WARN});
			}
			else setStatus({title: `найдено • ${SOURCE_LABELS[source]}`, status: Status.OK});

			return;
		}

		if (loading || (error && source !== 'third')) {
			return setStatus({title: url && loading ? StatusTitle.LOADING_ANSWERS : StatusTitle.SEARCHING_ANSWERS, status: Status.LOADING});
		}

		// Поиск завершён, но ответа на текущий вопрос нет: запускаем AI
		// один раз за посещение вопроса, включая пустую выдачу и ошибки источников.
		if (aiAttemptRef.current.attempted) return;
		aiAttemptRef.current.attempted = true;
		setBugReportContext({mode: 'auto', url: ''});
		setActiveAiQuestionKey(questionKey);

	}, [topic, question, variants, isSingle, url, loading, source, error, answerModel, setBugReportContext, setStatus]);

	const isWarning = status.status === Status.WARN;
	const isError = status.status === Status.ERR;
	const isLoading = status.status === Status.LOADING;
	const isOk = status.status === Status.OK;


	const searchIsCurrent = sourceTopicRef.current === topic;
	const loadNextSource = searchIsCurrent && !loading && !!error;

	return (
		<div className="nmo-section">
			<VariantLoader.Nmo text={topic} onChange={model => _updateSearchUrl('nmo-helper', model)}/>

			{searchIsCurrent && (source === 'first' || loadNextSource && source === 'nmo-helper') &&
				<VariantLoader.First text={topic} onChange={model => _updateSearchUrl('first', model)}/>
			}

			{searchIsCurrent && (source === 'second' || loadNextSource && source === 'first') &&
				<VariantLoader.Secondary text={topic} onChange={model => _updateSearchUrl('second', model)}/>
			}

			{searchIsCurrent && (source === 'third' || loadNextSource && source === 'second') &&
				<VariantLoader.Third text={topic} onChange={model => _updateSearchUrl('third', model)}/>
			}

			{searchIsCurrent && url && <AnswerLoader url={url} onChange={_updateAnswers}/>}

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
