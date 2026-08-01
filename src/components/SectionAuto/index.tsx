import React, {useEffect, useState} from 'react';
import './styles.scss';
import {usePanelStatus} from '../../contexts/PanelStatusContext';
import {useQuestionFinder} from '../../contexts/QuestionFinderContext';
import {useBugReportContext} from '../../contexts/BugReportContext';
import {answerCache} from '../../utils/answer-cache';
import {Status} from '../../types';
import VariantLoader from '../Loader/VariantLoader';
import AnswerLoader from '../Loader/AnswerLoader';
import type {IVariantModel} from '../Loader/VariantLoader';
import type {IAnswerModel} from '../Loader/AnswerLoader';
import {StatusTitle, LOW_CONFIDENCE_THRESHOLD} from '../../utils/constants';
import {pickResult} from '../../utils';
import {findAnswers, extractCases} from '../../utils/cases';
import {IconBolt} from '../icons';
import InlineToast from '../ui/InlineToast';
import ThinkingStrip from '../ui/ThinkingStrip';
import {statusToToast} from './utils';

const EMPTY_ANSWER_MODEL: IAnswerModel = {loading: false, error: null, data: null};

const SectionAuto: React.FC = (): React.JSX.Element => {
	// контекст всяктй
	const {status, setStatus} = usePanelStatus();
	const {topic, question, variants} = useQuestionFinder();
	const {setBugReportContext} = useBugReportContext();

	// url save
	const [primarySourceUrl, setPrimarySourceUrl] = useState<string>('');
	const [secondarySourceUrl, setSecondarySourceUrl] = useState<string>('');
	const [nmoHelperUrl, setNmoHelperUrl] = useState<string>('');

	// models
	const [primarySourceModel, setPrimarySourceModel] = useState<IAnswerModel>(EMPTY_ANSWER_MODEL);
	const [secondarySourceModel, setSecondarySourceModel] = useState<IAnswerModel>(EMPTY_ANSWER_MODEL);
	const [nmoHelperModel, setNmoHelperModel] = useState<IAnswerModel>(EMPTY_ANSWER_MODEL);

	// Инициализация контекста при каждом входе в режим «Авто».
	useEffect(() => setBugReportContext({mode: 'auto', url: ''}), [setBugReportContext]);

	const _updateSearchUrl = (state: IVariantModel): void => {
		if (!question) return;

		if (state.loading) {
			// clen url
			setPrimarySourceUrl('');
			setSecondarySourceUrl('');
			setNmoHelperUrl('');
			// clen model
			setPrimarySourceModel(EMPTY_ANSWER_MODEL);
			setSecondarySourceModel(EMPTY_ANSWER_MODEL);
			setNmoHelperModel(EMPTY_ANSWER_MODEL);
			// init status
			setBugReportContext({mode: 'auto', url: ''});
			return setStatus({title: StatusTitle.SEARCHING_ANSWERS, status: Status.LOADING});
		}

		if (state.error) return setStatus({title: state.error, status: Status.WARN});
		if (!state.data.length) return;

		const primaryResult = pickResult(state.data, 'primary', topic);
		const secondaryResult = pickResult(state.data, 'secondary', topic);
		const nmo = pickResult(state.data, 'nmo-helper', topic);

		const nextPrimarySourceUrl = primaryResult?.url ?? '';
		const nextSecondarySourceUrl = secondaryResult?.url ?? '';
		const nextNmoHelperUrl = nmo?.url ?? '';
		// upd url
		setPrimarySourceUrl(nextPrimarySourceUrl);
		setSecondarySourceUrl(nextSecondarySourceUrl);
		setNmoHelperUrl(nextNmoHelperUrl);
		// clean model
		setPrimarySourceModel({...EMPTY_ANSWER_MODEL, loading: !!nextPrimarySourceUrl});
		setSecondarySourceModel({...EMPTY_ANSWER_MODEL, loading: !!nextSecondarySourceUrl});
		setNmoHelperModel({...EMPTY_ANSWER_MODEL, loading: !!nextNmoHelperUrl});

		// update report
		setBugReportContext({mode: 'auto', url: nextPrimarySourceUrl || nextSecondarySourceUrl || nextNmoHelperUrl});

		// ничего не нашли =`(
		if (!primaryResult && !secondaryResult && !nmo) setStatus({title: StatusTitle.NOT_FOUND, status: Status.WARN});
	};

	useEffect(() => {
		if (!question || !variants.length) return;

		const sources = [
			{key: 'primary' as const, label: 'база 1', url: primarySourceUrl, state: primarySourceModel},
			{key: 'secondary' as const, label: 'база 2', url: secondarySourceUrl, state: secondarySourceModel},
			{key: 'nmo-helper' as const, label: 'nmo-helper', url: nmoHelperUrl, state: nmoHelperModel},
		].filter(source => source.url);

		// пока пусто
		if (!sources.length) return;

		// загрузочка у нас
		const isLoading = sources.find(source => source.state.loading);
		if (isLoading) return setStatus({title: StatusTitle.LOADING_ANSWERS, status: Status.LOADING});

		// всё в ошибку встало -_-
		const isAllError = sources.every(source => source.state.error);
		if (isAllError) return setStatus({title: StatusTitle.LOADING_FAILED, status: Status.ERR});

		// ваще голяк
		const isAllNullData = sources.every(source => !source.state.data);
		if (isAllNullData) return setStatus({title: StatusTitle.ANSWER_NOT_FOUND, status: Status.WARN});

		let hasAnswerMismatch = false;

		for (const source of sources) {
			if (!source.state.data) continue;

			const model = extractCases(source.key, source.state.data);
			const found = findAnswers(model, question, variants);

			if (!found) continue;

			if (!found.answers.length) {
				hasAnswerMismatch = true;
				continue;
			}

			answerCache.set(topic ?? '', question, variants, found.answers);
			setBugReportContext({mode: 'auto', url: source.url});

			if (found.score < LOW_CONFIDENCE_THRESHOLD) {
				setStatus({title: `${StatusTitle.ANSWER_LOW_CONFIDENCE} • ${source.label}`, status: Status.WARN});
			}
			else setStatus({title: `найдено • ${source.label}`, status: Status.OK});

			return;
		}

		if (hasAnswerMismatch) return setStatus({title: StatusTitle.ANSWER_MISMATCH, status: Status.WARN});
		setStatus({title: StatusTitle.ANSWER_NOT_FOUND, status: Status.WARN});

	}, [
		question,
		variants,
		topic,
		primarySourceUrl,
		secondarySourceUrl,
		nmoHelperUrl,
		primarySourceModel,
		secondarySourceModel,
		nmoHelperModel,
		setBugReportContext,
		setStatus,
	]);

	const isWarning = status.status === Status.WARN;
	const isError = status.status === Status.ERR;
	const isLoading = status.status === Status.LOADING;
	const isOk = status.status === Status.OK;

	const _topc = question ? topic ?? null : null;

	return (
		<div className="nmo-section">
			<VariantLoader text={_topc} onChange={_updateSearchUrl}/>
			<AnswerLoader url={primarySourceUrl} onChange={setPrimarySourceModel}/>
			<AnswerLoader url={secondarySourceUrl} onChange={setSecondarySourceModel}/>
			<AnswerLoader url={nmoHelperUrl} onChange={setNmoHelperModel}/>

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
