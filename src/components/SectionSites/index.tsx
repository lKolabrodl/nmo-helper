import React, {useEffect, useState} from 'react';
import cn from 'classnames';
import './styles.scss';
import {usePanelStatus} from '../../contexts/PanelStatusContext';
import {useQuestionFinder} from '../../contexts/QuestionFinderContext';
import {useBugReportContext} from '../../contexts/BugReportContext';
import {storageSet} from '../../utils';
import {answerCache} from '../../utils/answer-cache';
import {detectSource} from '../../utils/matching';
import {findAnswers, extractCases} from '../../utils/cases';
import AnswerLoader from '../Loader/AnswerLoader';
import VariantLoader from '../Loader/VariantLoader';
import type {IAnswerModel} from '../Loader/AnswerLoader';
import type {IVariantModel} from '../Loader/VariantLoader';
import {Status, type ISourceKey} from '../../types';
import {StatusTitle, LOW_CONFIDENCE_THRESHOLD} from '../../utils/constants';
import {IconPlay, IconSearch, IconStar} from '../icons';
import InlineToast from '../ui/InlineToast';
import {formatUrlForDisplay, plural, statusToToast} from './utils';

type Tab = 'url' | 'search';

const SOURCE_DETAILS: Record<ISourceKey, {readonly label: string; readonly className: string; readonly priority: number}> = {
	'rosmedicinfo': {label: 'rosmed', className: 'rosmed', priority: 0},
	'24forcare': {label: '24fc', className: 'fc', priority: 1},
	'nmo-helper': {label: 'nmo-helper', className: 'fc', priority: 2},
};

const SectionSites: React.FC<{initialUrl: string}> = ({initialUrl}) => {
	// context
	const {status, setStatus} = usePanelStatus();
	const {question, variants, topic} = useQuestionFinder();
	const {setBugReportContext} = useBugReportContext();

	// url
	const [tab, setTab] = useState<Tab>('search');
	const [url, setUrlRaw] = useState(initialUrl);
	const [activeUrl, setActiveUrl] = useState('');
	const [searchQuery, setSearchQuery] = useState('');
	const [activeSearch, setActiveSearch] = useState('');
	//
	const [variantModel, setVariantModel] = useState<IVariantModel>({loading: false, error: null, data: []});
	const [answerModel, setAnswerModel] = useState<IAnswerModel>({loading: false, error: null, data: null});

	const setUrl = (v: string) => { setUrlRaw(v); storageSet('customUrl', v); };

	const _updateHtml = (state: IAnswerModel) => {
		setAnswerModel(state);
		
		// баг лог
		if (activeUrl) {
			setBugReportContext({panelMode: 'sites', panelTab: tab === 'search' ? 'sites:search' : 'sites:url',	activeUrl});
		}

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

	const selectResult = (result: {url: string }): void => {
		setUrl(result.url);
		setActiveSearch('');
		setVariantModel({loading: false, error: null, data: []});
		setActiveUrl(result.url);
		setTab('url');
	};

	const _run = (): void => {
		if (!url.trim()) return setStatus({title: StatusTitle.ENTER_URL, status: Status.ERR});
		setActiveUrl(url.trim());
	};

	const _stop = () => {
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

		const label = SOURCE_DETAILS[source].label;

		if (found.score < LOW_CONFIDENCE_THRESHOLD) {
			setStatus({title: `${StatusTitle.ANSWER_LOW_CONFIDENCE} • ${label}`, status: Status.WARN});
		}
		else setStatus({title: `найдено • ${label}`, status: Status.OK});

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
		return SOURCE_DETAILS[a.source].priority - SOURCE_DETAILS[b.source].priority;
	});

	const canSearch = searchQuery.trim().length > 0 && !variantModel.loading;

	return (
		<div className="nmo-section">
			<AnswerLoader url={activeUrl} onChange={_updateHtml}/>
			<VariantLoader text={activeSearch} onChange={_updateSearchUrl}/>

			<div className="nmo-section-inner">
				<div className="nmo-sub-tabs">
					<button type="button" className={cn({active: tab === 'search'})} onClick={() => setTab('search')}>
						Найти тест
					</button>
					<button type="button" className={cn({active: tab === 'url'})}	onClick={() => setTab('url')}>
						URL
					</button>
				</div>

				{tab === 'url' ? (
					<div className="nmo-fade-up">
						<label className="nmo-label">URL базы ответов</label>
						<input type="text"
							className="nmo-input mono"
							placeholder="https://example.com/answers"
							value={formatUrlForDisplay(url)}
							onChange={e => setUrl(e.target.value)}/>
						<div className="nmo-sites-help">
							Поддерживаются rosmedicinfo, 24forcare и nmo-helper
						</div>
					</div>
				) : (
					<div className="nmo-fade-up">
						<label className="nmo-label">Вставьте название теста</label>
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
									{results.map((r, i) => {
										const source = SOURCE_DETAILS[r.source];

										return (
											<button key={i} type="button"
												className={cn('nmo-results-item', source.className)}
												title={r.title}
												onClick={() => selectResult(r)}>
												<div className="nmo-results-title">{r.title}</div>
												<div className="nmo-results-meta-row">
													<span className={cn('nmo-results-src', source.className)}>
														{source.label}
														{r.source === 'rosmedicinfo' && <> <IconStar size={9}/></>}
													</span>
												</div>
											</button>
										);
									})}
								</div>
							</div>
						)}
					</div>
				)}
			</div>

			{(isOk || isWarning || isError) && status.title && 	<InlineToast toast={statusToToast(status.title, status.status)}/>}

			{(tab === 'url' || isRunning) && (
				<div className="nmo-footer">
					{!isRunning &&
						<button type="button"
							className="nmo-btn nmo-btn-primary nmo-btn-cta"
							disabled={!url.trim() || answerModel.loading}
							onClick={_run}>
							<IconPlay size={14}/>Запустить
						</button>
					}
					{isRunning &&
						<button type="button" className="nmo-btn nmo-btn-stop nmo-btn-cta" onClick={_stop}>
							Остановить
						</button>
					}
				</div>
			)}
		</div>
	);
};

export default SectionSites;
