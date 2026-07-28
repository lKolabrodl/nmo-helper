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
import type {ISearchResult, IVariantModel} from '../Loader/VariantLoader';
import {Status} from '../../types';
import {StatusTitle, LOW_CONFIDENCE_THRESHOLD} from '../../utils/constants';
import {IconPlay, IconSearch} from '../icons';
import InlineToast from '../ui/InlineToast';
import SearchResults from './components/SearchResults';
import {formatUrlForDisplay, SOURCE_DETAILS, statusToToast} from './utils';

type Tab = 'url' | 'search';

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

	// для дебаг мода
	useEffect(() => setBugReportContext({mode: `sites:${tab}`, url: activeUrl}), [activeUrl, setBugReportContext, tab]);

	const _updateHtml = (state: IAnswerModel) => {
		setAnswerModel(state);

		if (state.loading) setStatus({title: StatusTitle.LOADING_ANSWERS, status: Status.LOADING});
		else if (state.error) setStatus({title: state.error, status: Status.ERR});
		else if (state.data) setStatus({title: StatusTitle.RUNNING, status: Status.OK});
	};

	const _updateSearchUrl = (state: IVariantModel): void => {
		setVariantModel(state);
		if (state.loading) setStatus({title: StatusTitle.SEARCHING, status: Status.LOADING});
		else if (state.error) setStatus({title: state.error, status: Status.WARN});
		else if (state.data.length) setStatus({title: `найдено ${state.data.length} результат(ов)`, status: Status.OK});
	};

	const search = () => {
		if (!searchQuery.trim()) return setStatus({title: StatusTitle.ENTER_QUERY, status: Status.ERR});
		setActiveSearch(searchQuery.trim());
	};

	const _onSelectResult = (result: ISearchResult): void => {
		setUrl(result.url);
		setActiveUrl(result.url);
	};

	const _onRun = (): void => {
		if (!url.trim()) return setStatus({title: StatusTitle.ENTER_URL, status: Status.ERR});
		setActiveUrl(url.trim());
	};

	const _onStop = (): void => {
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

	const isLoadingAll = variantModel.loading || answerModel.loading;
	const canSearch = searchQuery.trim().length;

	// теxt =/
	let searchButtonText = 'Проверить базу';
	if (variantModel.loading) searchButtonText = 'Ищу в базе…';
	if (answerModel.loading) searchButtonText = 'Загружаю ответы…';

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
							Поддерживаются базы поиска ответов и nmo-helper
						</div>
					</div>
				) : (
					<div className="nmo-fade-up">
						<label className="nmo-label">Вставьте название теста</label>
						<textarea className="nmo-input"
							rows={2}
							disabled={isRunning || isLoadingAll}
							value={searchQuery}
							onChange={e => setSearchQuery(e.target.value)}
							onKeyDown={handleKeyDown}
							placeholder="Например: «Аритмии у взрослых, ФП, антиаритмики IC класса…»"/>

						<button type="button"
							className="nmo-btn nmo-btn-ghost nmo-search-btn"
							disabled={!canSearch || isRunning || isLoadingAll}
							aria-busy={isLoadingAll}
							onClick={search}>
							{isLoadingAll && <span className="nmo-spinner" style={{width: 11, height: 11, color: 'currentColor'}}/>}
							{!isLoadingAll && <IconSearch size={11}/>}
							{searchButtonText}
						</button>

						<SearchResults results={variantModel.data} selectedUrl={url} onSelect={_onSelectResult}/>
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
							onClick={_onRun}>
							<IconPlay size={14}/>Запустить
						</button>
					}
					{isRunning &&
						<button type="button" className="nmo-btn nmo-btn-stop nmo-btn-cta" onClick={_onStop}>
							Остановить
						</button>
					}
				</div>
			)}
		</div>
	);
};

export default SectionSites;
