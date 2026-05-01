import React, {useEffect, useState} from 'react';
import './styles.scss';
import {usePanelStatus} from '../../contexts/PanelStatusContext';
import {useQuestionFinder} from '../../contexts/QuestionFinderContext';
import {answerCache} from '../../utils/answer-cache';
import {Status} from '../../types';
import VariantLoader from '../Loader/VariantLoader';
import AnswerLoader from '../Loader/AnswerLoader';
import type {IVariantModel} from '../Loader/VariantLoader';
import type {IAnswerModel} from '../Loader/AnswerLoader';
import {StatusTitle, LOW_CONFIDENCE_THRESHOLD} from '../../utils/constants';
import {detectSource, pickResult} from '../../utils';
import {findAnswers, extractCases} from '../../utils/cases';
import {IconBolt} from '../icons';
import InlineToast, {type IToast} from '../ui/InlineToast';
import ThinkingStrip from '../ui/ThinkingStrip';

const AutoSection: React.FC = () => {
	const {status, setStatus} = usePanelStatus();
	const {topic, rawTopic, question, variants} = useQuestionFinder();

	const [rosmedUrl, setRosmedUrl] = useState('');
	const [forcareUrl, setForcareUrl] = useState('');
	const [activeUrl, setActiveUrl] = useState('');
	const [html, setHtml] = useState<HTMLElement | null>(null);

	const _updateSearchUrl = (state: IVariantModel): void => {
		if (!question) return;
		if (state.loading) return setStatus({title: StatusTitle.SEARCHING_ANSWERS, status: Status.LOADING});
		if (state.error) return setStatus({title: state.error, status: Status.WARN});
		if (!state.data.length && !rawTopic) return;

		const ros = pickResult(state.data, 'rosmedicinfo', topic);
		const fc = pickResult(state.data, '24forcare', topic);

		setRosmedUrl(ros?.url ?? '');
		setForcareUrl(fc?.url ?? '');
		setActiveUrl(ros?.url ?? fc?.url ?? '');

		if (!ros && !fc) setStatus({title: StatusTitle.NOT_FOUND, status: Status.WARN});
	};

	const _updateHtml = (state: IAnswerModel): void => {
		setHtml(state.data);
		if (state.loading) return setStatus({title: StatusTitle.LOADING_ANSWERS, status: Status.LOADING});

		if (state.error) {
			if (activeUrl === rosmedUrl && forcareUrl) return setActiveUrl(forcareUrl);
			return setStatus({title: StatusTitle.LOADING_FAILED, status: Status.ERR});
		}

		if (state.data) {
			const source = activeUrl === rosmedUrl ? 'rosmed' : '24fc';
			setStatus({title: `загружено: ${source}`, status: Status.OK});
		}
	};

	useEffect(() => {
		if (!question || !variants.length || !html) return;
		if (answerCache.has(topic, question, variants)) return;

		const source = detectSource(activeUrl);
		if (!source) return;

		const model = extractCases(source, html);
		const found = findAnswers(model, question, variants);
		if (!found) return setStatus({title: StatusTitle.ANSWER_NOT_FOUND, status: Status.WARN});
		if (!found.answers.length) return setStatus({title: StatusTitle.ANSWER_MISMATCH, status: Status.WARN});

		answerCache.set(topic ?? '', question, variants, found.answers);

		const label = activeUrl === rosmedUrl ? 'rosmed' : '24forcare';

		if (found.score < LOW_CONFIDENCE_THRESHOLD) {
			setStatus({title: `${StatusTitle.ANSWER_LOW_CONFIDENCE} • ${label}`, status: Status.WARN});
		} else setStatus({title: `найдено • ${label}`, status: Status.OK});

	}, [question, variants, topic, html]);

	const isWarning = status.status === Status.WARN;
	const isError = status.status === Status.ERR;
	const isLoading = status.status === Status.LOADING;
	const isOk = status.status === Status.OK;

	const _topc = question ? topic ?? null : null;

	return (
		<div className="nmo-section">
			<VariantLoader text={_topc} onChange={_updateSearchUrl}/>
			<AnswerLoader url={activeUrl} onChange={_updateHtml}/>

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

			{(isWarning || isError || isOk) && status.title && (
				<InlineToast toast={statusToToast(status.title, status.status)}/>
			)}
		</div>
	);
};

export default AutoSection;

function statusToToast(title: string, status: typeof Status[keyof typeof Status]): IToast {
	if (status === Status.OK)   return {kind: 'success', title};
	if (status === Status.ERR)  return {kind: 'danger',  title};
	return {kind: 'warning', title};
}
