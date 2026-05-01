import React, {useEffect, useState} from 'react';
import './styles.scss';
import {usePanelStatus} from '../../contexts/PanelStatusContext';
import {useQuestionFinder} from '../../contexts/QuestionFinderContext';
import {storageSet} from '../../utils';
import {answerCache} from '../../utils/answer-cache';
import {detectSource} from '../../utils/matching';
import {findAnswers, extractCases} from '../../utils/cases';
import AnswerLoader from '../Loader/AnswerLoader';
import VariantLoader from '../Loader/VariantLoader';
import type {IAnswerModel} from '../Loader/AnswerLoader';
import type {IVariantModel} from '../Loader/VariantLoader';
import {Status} from '../../types';
import {StatusTitle, LOW_CONFIDENCE_THRESHOLD} from '../../utils/constants';
import {IconPlay, IconSearch, IconStar} from '../icons';
import InlineToast, {type IToast} from '../ui/InlineToast';

type Tab = 'url' | 'search';

const SitesSection: React.FC<{initialUrl: string}> = ({initialUrl}) => {
	const {status, setStatus} = usePanelStatus();
	const {question, variants, topic} = useQuestionFinder();

	const [tab, setTab] = useState<Tab>('url');
	const [url, setUrlRaw] = useState(initialUrl);
	const [activeUrl, setActiveUrl] = useState('');
	const [searchQuery, setSearchQuery] = useState('');
	const [activeSearch, setActiveSearch] = useState('');

	const [variantModel, setVariantModel] = useState<IVariantModel>({loading: false, error: null, data: []});
	const [answerModel, setAnswerModel] = useState<IAnswerModel>({loading: false, error: null, data: null});

	const setUrl = (v: string) => { setUrlRaw(v); storageSet('customUrl', v); };

	const _updateHtml = (state: IAnswerModel) => {
		setAnswerModel(state);
		if (state.loading) setStatus({title: StatusTitle.LOADING_ANSWERS, status: Status.LOADING});
		else if (state.error) setStatus({title: state.error, status: Status.ERR});
		else if (state.data) setStatus({title: StatusTitle.RUNNING, status: Status.OK});
	};

	const _updateSearchUrl = (state: IVariantModel) => {
		setVariantModel(state);
		if (state.loading) setStatus({title: StatusTitle.SEARCHING, status: Status.LOADING});
		else if (state.error) setStatus({title: state.error, status: Status.WARN});
		else if (state.data.length) setStatus({title: `найдено ${state.data.length} результат(ов)`, status: Status.OK});
	};

	const search = () => {
		if (!searchQuery.trim()) return setStatus({title: StatusTitle.ENTER_QUERY, status: Status.ERR});
		setActiveSearch(searchQuery.trim());
	};

	const selectResult = (result: {url: string}) => {
		setUrl(result.url);
		setActiveSearch('');
		setVariantModel({loading: false, error: null, data: []});
		setActiveUrl(result.url);
		setTab('url');
	};

	const run = () => {
		if (!url.trim()) return setStatus({title: StatusTitle.ENTER_URL, status: Status.ERR});
		setActiveUrl(url.trim());
	};

	const stop = () => {
		setActiveUrl('');
		setAnswerModel({loading: false, error: null, data: null});
		setStatus({title: StatusTitle.STOPPED, status: Status.IDLE});
	};

	useEffect(() => {
		if (!answerModel.data || !question || !variants.length) return;
		if (answerCache.has(topic, question, variants)) return;

		const source = detectSource(activeUrl);
		if (!source) return;

		const model = extractCases(source, answerModel.data);
		const found = findAnswers(model, question, variants);
		if (!found) return setStatus({title: StatusTitle.ANSWER_NOT_FOUND, status: Status.WARN});
		if (!found.answers.length) return setStatus({title: StatusTitle.ANSWER_MISMATCH, status: Status.WARN});

		answerCache.set(topic ?? '', question, variants, found.answers);

		const label = source === 'rosmedicinfo' ? 'rosmed' : '24forcare';
		if (found.score < LOW_CONFIDENCE_THRESHOLD) {
			setStatus({title: `${StatusTitle.ANSWER_LOW_CONFIDENCE} • ${label}`, status: Status.WARN});
		} else setStatus({title: `найдено • ${label}`, status: Status.OK});
	}, [answerModel.data, question, variants, topic, activeUrl]);

	const handleKeyDown = (e: React.KeyboardEvent) => {
		if (e.key !== 'Enter') return;
		e.preventDefault();
		search();
	};

	const isRunning = !!answerModel.data;
	const isWarning = status.status === Status.WARN;
	const isError = status.status === Status.ERR;
	const isOk = status.status === Status.OK;

	const results = [...variantModel.data].sort((a, b) => {
		const ar = a.source === 'rosmedicinfo' ? 0 : 1;
		const br = b.source === 'rosmedicinfo' ? 0 : 1;
		return ar - br;
	});
	const canSearch = searchQuery.trim().length > 0 && !variantModel.loading;

	return (
		<div className="nmo-section">
			<AnswerLoader url={activeUrl} onChange={_updateHtml}/>
			<VariantLoader text={activeSearch} onChange={_updateSearchUrl}/>

			<div className="nmo-section-inner">
				<div className="nmo-sub-tabs">
					<button type="button"
						className={tab === 'url' ? 'active' : ''}
						onClick={() => setTab('url')}>URL базы</button>
					<button type="button"
						className={tab === 'search' ? 'active' : ''}
						onClick={() => setTab('search')}>Найти тест</button>
				</div>

				{tab === 'url' ? (
					<div className="nmo-fade-up">
						<label className="nmo-label">URL базы ответов</label>
						<input type="text"
							className="nmo-input mono"
							placeholder="https://example.com/answers"
							value={url}
							onChange={e => setUrl(e.target.value)}/>
						<div className="nmo-sites-help">
							Поддерживаются только на rosmedicinfo, 24force
						</div>
					</div>
				) : (
					<div className="nmo-fade-up">
						<label className="nmo-label">Вставьте текст или название теста</label>
						<textarea className="nmo-input"
							rows={2}
							value={searchQuery}
							onChange={e => setSearchQuery(e.target.value)}
							onKeyDown={handleKeyDown}
							placeholder="Например: «Аритмии у взрослых, ФП, антиаритмики IC класса…»"/>

						<button type="button"
							className="nmo-btn nmo-btn-ghost nmo-search-btn"
							disabled={!canSearch}
							onClick={search}>
							{variantModel.loading ? (
								<>
									<span className="nmo-spinner" style={{width: 11, height: 11, color: 'currentColor'}}/>
									Ищу в базе…
								</>
							) : (
								<>
									<IconSearch size={11}/>Проверить базу
								</>
							)}
						</button>

						{results.length > 0 && (
							<div className="nmo-results nmo-fade-up">
								<div className="nmo-results-meta">
									Найдено: {results.length} {plural(results.length)}
								</div>
								<div className="nmo-results-list">
									{results.map((r, i) => (
										<button key={i} type="button"
											className="nmo-results-item"
											title={r.title}
											onClick={() => selectResult(r)}>
											<div className="nmo-results-title">{r.title}</div>
											<div className="nmo-results-meta-row">
												<span className={`nmo-results-src ${r.source === 'rosmedicinfo' ? 'rosmed' : 'fc'}`}>
													{r.source === 'rosmedicinfo' ? 'rosmed' : '24fc'}
													{r.source === 'rosmedicinfo' && <> <IconStar size={9}/></>}
												</span>
											</div>
										</button>
									))}
								</div>
							</div>
						)}
					</div>
				)}
			</div>

			{(isOk || isWarning || isError) && status.title && (
				<InlineToast toast={statusToToast(status.title, status.status)}/>
			)}

			{(tab === 'url' || isRunning) && (
				<div className="nmo-footer">
					{!isRunning ? (
						<button type="button"
							className="nmo-btn nmo-btn-primary nmo-btn-cta"
							disabled={!url.trim() || answerModel.loading}
							onClick={run}>
							<IconPlay size={14}/>Запустить
						</button>
					) : (
						<button type="button"
							className="nmo-btn nmo-btn-stop nmo-btn-cta"
							onClick={stop}>
							Остановить
						</button>
					)}
				</div>
			)}
		</div>
	);
};

export default SitesSection;

function plural(n: number): string {
	if (n === 1) return 'тест';
	if (n < 5) return 'теста';
	return 'тестов';
}

function statusToToast(title: string, status: typeof Status[keyof typeof Status]): IToast {
	if (status === Status.OK)   return {kind: 'success', title};
	if (status === Status.ERR)  return {kind: 'danger',  title};
	return {kind: 'warning', title};
}
