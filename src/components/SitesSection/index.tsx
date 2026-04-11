import React, { useState, useEffect } from 'react';
import './styles.scss';
import { usePanelStatus } from '../../contexts/PanelStatusContext';
import { useQuestionFinder } from '../../contexts/QuestionFinderContext';
import { storageSet } from '../../utils';
import { answerCache } from '../../utils/answer-cache';
import { findCorrectIndexes } from '../../utils/matching';
import { detectSource } from '../../utils/parsers';
import AnswerLoader from '../Loader/AnswerLoader';
import VariantLoader from '../Loader/VariantLoader';
import type { IAnswerLoaderState } from '../Loader/AnswerLoader';
import type { IVariantLoaderState } from '../Loader/VariantLoader';
import { Status } from '../../types';
import { StatusTitle } from '../../utils/constants';

const SitesSection = ({ initialUrl }: { initialUrl: string }) => {
	const { status, setStatus } = usePanelStatus();
	const { question, variants, topic } = useQuestionFinder();

	const [url, setUrlRaw] = useState(initialUrl);
	const [activeUrl, setActiveUrl] = useState('');
	const [searchQuery, setSearchQuery] = useState('');
	const [activeSearch, setActiveSearch] = useState('');
	const [searchResults, setSearchResults] = useState<IVariantLoaderState>({ loading: false, error: null, data: [] });
	const [parser, setParser] = useState<IAnswerLoaderState>({ loading: false, error: null, data: null });

	const setUrl = (v: string) => { setUrlRaw(v); storageSet('customUrl', v); };

	const handleLoaderChange = (state: IAnswerLoaderState) => {
		setParser(state);
		if (state.loading) setStatus({ title: StatusTitle.LOADING_ANSWERS, status: Status.LOADING });
		else if (state.error) setStatus({ title: state.error, status: Status.ERR });
		else if (state.data) setStatus({ title: StatusTitle.RUNNING, status: Status.OK });
	};

	const handleSearchChange = (state: IVariantLoaderState) => {
		setSearchResults(state);
		if (state.loading) setStatus({ title: StatusTitle.SEARCHING, status: Status.LOADING });
		else if (state.error) setStatus({ title: state.error, status: Status.WARN });
		else if (state.data.length) setStatus({ title: `найдено ${state.data.length} результат(ов)`, status: Status.OK });
	};

	const search = () => {
		if (!searchQuery.trim()) return setStatus({ title: StatusTitle.ENTER_QUERY, status: Status.ERR });
		setActiveSearch(searchQuery.trim());
	};

	const selectResult = (result: { url: string }) => {
		setUrl(result.url);
		setActiveSearch('');
		setSearchResults({ loading: false, error: null, data: [] });
		setActiveUrl(result.url);
	};

	const run = () => {
		if (!url.trim()) return setStatus({ title: StatusTitle.ENTER_URL, status: Status.ERR });
		setActiveUrl(url.trim());
	};

	const stop = () => {
		setActiveUrl('');
		setParser({ loading: false, error: null, data: null });
		setStatus({ title: StatusTitle.STOPPED, status: Status.IDLE });
	};

	const running = !!parser.data;

	useEffect(() => {
		if (!parser.data || !question || !variants.length) return;

		if (answerCache.get(topic ?? '', question)) return;

		const answers = parser.data(question);
		if (!answers || answers.length === 0) {
			return setStatus({ title: StatusTitle.ANSWER_NOT_FOUND, status: Status.WARN });
		}

		const correctIndexes = findCorrectIndexes(variants, answers);
		if (correctIndexes.length === 0) {
			return setStatus({ title: StatusTitle.ANSWER_MISMATCH, status: Status.WARN });
		}

		const source = detectSource(activeUrl) ?? 'rosmed';
		const _variants = variants.map((title, i) => ({title, answer: correctIndexes.includes(i)}));
		answerCache.set(topic ?? '', question, {variants: _variants, source});

		setStatus({ title: `найдено \u2022 ${source}`, status: Status.OK });

	}, [parser.data, question, variants, topic, activeUrl]);

	const handleKeyDown = (e: React.KeyboardEvent) => {
		if (e.key === 'Enter') { e.preventDefault(); search(); }
	};

	return (
		<div className="nmo-section">
			<AnswerLoader url={activeUrl} onChange={handleLoaderChange} />
			<VariantLoader text={activeSearch} onChange={handleSearchChange} />

			<div className="nmo-field">
				<label>Поиск</label>
				<input
					type="text"
					placeholder="Название теста..."
					value={searchQuery}
					onChange={(e) => setSearchQuery(e.target.value)}
					onKeyDown={handleKeyDown}/>
			</div>

			<button className="nmo-btn nmo-btn-ghost" onClick={search} disabled={searchResults.loading}>
				Найти ответы
			</button>

			{searchResults.data.length > 0 && (
				<div className="nmo-search-results">
					{searchResults.data.map((r, i) => (
						<div key={i} className="nmo-result-item" onClick={() => selectResult(r)}>
							<span className={`nmo-result-src ${r.source === '24forcare' ? 'src-24' : 'src-ros'}`}>
								{r.source === '24forcare' ? '24fc' : 'rosmed'}
							</span>
							<span className="nmo-result-title">{r.title}</span>
						</div>
					))}
				</div>
			)}

			<hr className="nmo-separator" />

			<div className="nmo-field">
				<label>URL страницы с ответами</label>
				<input
					type="text"
					placeholder="https://..."
					value={url}
					onChange={(e) => setUrl(e.target.value)}/>
			</div>

			<div className="nmo-btn-row">
				{!running &&
					<button className="nmo-btn nmo-btn-primary" onClick={run} disabled={parser.loading}>
						Запуск
					</button>
				}
				{running && <button className="nmo-btn nmo-btn-stop" onClick={stop}> Стоп </button>}
			</div>

			<div className={`nmo-status ${status.status}`}>{status.title}</div>
		</div>
	);
};

export default SitesSection;
