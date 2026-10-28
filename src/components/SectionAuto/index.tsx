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
	// контекст всяктй
	const {status, setStatus} = usePanelStatus();
	const {topic, question, variants} = useQuestionFinder();
	const {setBugReportContext} = useBugReportContext();

	// models
	const [nmoHelperSource, setNmoHelperSource] = useState<IAnswerSourceState>(EMPTY_ANSWER_SOURCE_STATE);
	const [firstSource, setFirstSource] = useState<IAnswerSourceState>(EMPTY_ANSWER_SOURCE_STATE);
	const [secondarySource, setSecondarySource] = useState<IAnswerSourceState>(EMPTY_ANSWER_SOURCE_STATE);
	const [thirdSource, setThirdSource] = useState<IAnswerSourceState>(EMPTY_ANSWER_SOURCE_STATE);
	const [isActive, setIsActive] = useState(false);
	const sourceTopicRef = useRef<string | null>(null);



	// Инициализация контекста при каждом входе в режим «Авто».
	useEffect(() => setBugReportContext({mode: 'auto', url: ''}), [setBugReportContext]);

	const _updateSearchUrl = (state: IVariantModel): void => {
		if (!question) return;

		if (state.loading) {
			setIsActive(false);
			sourceTopicRef.current = null;
			setFirstSource(EMPTY_ANSWER_SOURCE_STATE);
			setSecondarySource(EMPTY_ANSWER_SOURCE_STATE);
			setNmoHelperSource(EMPTY_ANSWER_SOURCE_STATE);
			setThirdSource(EMPTY_ANSWER_SOURCE_STATE);
			// init status
			setBugReportContext({mode: 'auto', url: ''});
			return setStatus({title: StatusTitle.SEARCHING_ANSWERS, status: Status.LOADING});
		}

		if (state.error) return setStatus({title: state.error, status: Status.WARN});
		if (!state.data.length) return;
		sourceTopicRef.current = topic;

		const nmoHelperResult = pickResult(state.data, 'nmo-helper', topic);
		const primaryResult = pickResult(state.data, 'first', topic);
		const secondaryResult = pickResult(state.data, 'second', topic);
		const fooResult = pickResult(state.data, 'third', topic);

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

		// ничего не нашли =`(
		if (!primaryResult && !secondaryResult && !nmoHelperResult && !fooResult) {
			setStatus({title: StatusTitle.NOT_FOUND, status: Status.WARN});
		}
	};

	useEffect(() => {
		if (!question || !variants.length || sourceTopicRef.current !== topic) return;

		const sources = [
			{label: 'nmo-helper', ...nmoHelperSource},
			...(nmoHelperSource.url && nmoHelperSource.model.error ? [
				{label: 'база 1', ...firstSource},
				{label: 'база 2', ...secondarySource},
				{label: 'база 3', ...thirdSource},
			] : []),
		].filter(source => source.url);

		// пока пусто
		if (!sources.length) return;

		let hasAnswerMismatch = false;

		for (const source of sources) {
			if (!source.model.data?.length) continue;

			const found = findAnswers(source.model.data, question, variants);

			if (!found) continue;

			if (!found.answers.length) {
				hasAnswerMismatch = true;
				continue;
			}

			answerCache.set(topic ?? '', question, variants, found.answers);
			setIsActive(false);
			setBugReportContext({mode: 'auto', url: source.url});

			if (found.score < LOW_CONFIDENCE_THRESHOLD) {
				setStatus({title: `${StatusTitle.ANSWER_LOW_CONFIDENCE} • ${source.label}`, status: Status.WARN});
			}
			else setStatus({title: `найдено • ${source.label}`, status: Status.OK});

			return;
		}

		const isLoading = sources.some(source => source.model.loading);
		if (isLoading) return setStatus({title: StatusTitle.LOADING_ANSWERS, status: Status.LOADING});

		const isAllError = sources.every(source => source.model.error);
		if (isAllError) return setStatus({title: StatusTitle.LOADING_FAILED, status: Status.ERR});

		const isAllNullData = sources.every(source => !source.model.data?.length);
		if (isAllNullData) {
			setBugReportContext({mode: 'auto', url: ''});
			return setIsActive(true);
		}

		if (hasAnswerMismatch) return setStatus({title: StatusTitle.ANSWER_MISMATCH, status: Status.WARN});
		setStatus({title: StatusTitle.ANSWER_NOT_FOUND, status: Status.WARN});

	}, [question, variants, topic, firstSource, secondarySource, nmoHelperSource, thirdSource, setBugReportContext, setStatus]);

	const isWarning = status.status === Status.WARN;
	const isError = status.status === Status.ERR;
	const isLoading = status.status === Status.LOADING;
	const isOk = status.status === Status.OK;

	const _topc = question ? topic ?? null : null;

	// Остальные источники загружаем только при ошибке загрузки по найденному URL nmo-helper.
	// Пустые данные и отсутствие URL не включают остальные источники.
	const loadOtherSources = Boolean(nmoHelperSource.url && nmoHelperSource.model.error);

	return (
		<div className="nmo-section">
			<VariantLoader text={_topc} onChange={_updateSearchUrl}/>
			<AnswerLoader url={nmoHelperSource.url}	onChange={model => setNmoHelperSource(source => ({...source, model}))}/>

			{loadOtherSources &&
				<>
					<AnswerLoader url={firstSource.url} onChange={model => setFirstSource(source => ({...source, model}))}/>
					<AnswerLoader url={secondarySource.url}	onChange={model => setSecondarySource(source => ({...source, model}))}/>
					<AnswerLoader url={thirdSource.url} onChange={model => setThirdSource(source => ({...source, model}))}/>
				</>
			}

			<AIProxyFreeLoader
				active={isActive && sourceTopicRef.current === topic}
				onChange={({running}) => setIsActive(running)}
				onComplete={() => setIsActive(false)}/>

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
