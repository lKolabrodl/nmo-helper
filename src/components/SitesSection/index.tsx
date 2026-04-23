import React, { useState, useEffect } from 'react';
import './styles.scss';
import { usePanelStatus } from '../../contexts/PanelStatusContext';
import { useQuestionFinder } from '../../contexts/QuestionFinderContext';
import { storageSet } from '../../utils';
import { answerCache } from '../../utils/answer-cache';
import { detectSource } from '../../utils/matching';
import { findAnswers, extractCases } from '../../utils/cases';
import AnswerLoader from '../Loader/AnswerLoader';
import VariantLoader from '../Loader/VariantLoader';
import BugReportButton from '../BugReportButton';
import type { IAnswerModel } from '../Loader/AnswerLoader';
import type { IVariantModel } from '../Loader/VariantLoader';
import { Status } from '../../types';
import { StatusTitle, LOW_CONFIDENCE_THRESHOLD } from '../../utils/constants';

const SitesSection = ({ initialUrl }: { initialUrl: string }) => {
	const { status, setStatus } = usePanelStatus();
	const { question, variants, topic } = useQuestionFinder();

	const [url, setUrlRaw] = useState(initialUrl);
	const [activeUrl, setActiveUrl] = useState('');
	const [searchQuery, setSearchQuery] = useState('');
	const [activeSearch, setActiveSearch] = useState('');

	const [variantModel, setVariantModel] = useState<IVariantModel>({ loading: false, error: null, data: [] });
	const [answerModel, setAnswerModel] = useState<IAnswerModel>({ loading: false, error: null, data: null });

	const setUrl = (v: string) => { setUrlRaw(v); storageSet('customUrl', v); };

	const _updateHtml = (state: IAnswerModel) => {
		setAnswerModel(state);
		if (state.loading) setStatus({ title: StatusTitle.LOADING_ANSWERS, status: Status.LOADING });
		else if (state.error) setStatus({ title: state.error, status: Status.ERR });
		else if (state.data) setStatus({ title: StatusTitle.RUNNING, status: Status.OK });
	};

	const _updateSearchUrl = (state: IVariantModel) => {
		setVariantModel(state);
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
		setVariantModel({ loading: false, error: null, data: [] });
		setActiveUrl(result.url);
	};

	const run = () => {
		if (!url.trim()) return setStatus({ title: StatusTitle.ENTER_URL, status: Status.ERR });
		setActiveUrl(url.trim());
	};

	const stop = () => {
		setActiveUrl('');
		setAnswerModel({ loading: false, error: null, data: null });
		setStatus({ title: StatusTitle.STOPPED, status: Status.IDLE });
	};

	useEffect(() => {
		if (!answerModel.data || !question || !variants.length) return;

		// уже в кеше — пропускаем
		if (answerCache.has(topic, question, variants)) return;

		const source = detectSource(activeUrl);
		if (!source) return;

		// собираем все пары вопрос/варианты/ответы из html источника
		const model = extractCases(source, answerModel.data);

		// ищем нужный case и получаем правильные варианты уже в терминах ВХОДНЫХ variants
		const found = findAnswers(model, question, variants);
		if (!found) return setStatus({ title: StatusTitle.ANSWER_NOT_FOUND, status: Status.WARN });
		if (!found.answers.length) return setStatus({ title: StatusTitle.ANSWER_MISMATCH, status: Status.WARN });

		answerCache.set(topic ?? '', question, variants, found.answers);

		const label = source === 'rosmedicinfo' ? 'rosmed' : '24forcare';

		if (found.score < LOW_CONFIDENCE_THRESHOLD) {
			setStatus({title: `${StatusTitle.ANSWER_LOW_CONFIDENCE} \u2022 ${label}`, status: Status.WARN});
		} else setStatus({title: `найдено \u2022 ${label}`, status: Status.OK});


	}, [answerModel.data, question, variants, topic, activeUrl]);

	const handleKeyDown = (e: React.KeyboardEvent) => {
		if (e.key !== 'Enter') return;
		 e.preventDefault();
		 search();
	};

	const isRunning = !!answerModel.data;

	const isWarning = status.status === Status.WARN;
	const warnTitles: string[] = [StatusTitle.ANSWER_NOT_FOUND, StatusTitle.ANSWER_MISMATCH, StatusTitle.ANSWER_LOW_CONFIDENCE];
	const isNotFound = warnTitles.includes(status.title);

	return (
		<div className="nmo-section">
			<AnswerLoader url={activeUrl} onChange={_updateHtml} />
			<VariantLoader text={activeSearch} onChange={_updateSearchUrl} />

			<div className="nmo-field">
				<label>Поиск</label>
				<input
					type="text"
					placeholder="Название теста..."
					value={searchQuery}
					onChange={(e) => setSearchQuery(e.target.value)}
					onKeyDown={handleKeyDown}/>
			</div>

			<button className="nmo-btn nmo-btn-ghost" onClick={search} disabled={variantModel.loading}>
				Найти ответы
			</button>

			{variantModel.data.length > 0 && (
				<div className="nmo-search-results">
					{variantModel.data.map((r, i) => (
						<div key={i} className="nmo-result-item" onClick={() => selectResult(r)}>
							<span className={`nmo-result-src ${r.source === '24forcare' ? 'src-24' : 'src-ros'}`}>
								{r.source === '24forcare' ? '24fc' : 'rosmed'}
							</span>
							<span className="nmo-result-title" title={r.title}>{r.title}</span>
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
				{!isRunning &&
					<button className="nmo-btn nmo-btn-primary" onClick={run} disabled={answerModel.loading}>
						Запуск
					</button>
				}
				{isRunning && <button className="nmo-btn nmo-btn-stop" onClick={stop}> Стоп </button>}
			</div>

			<div className={`nmo-status ${status.status}`}>{status.title}</div>

			{isWarning && isNotFound && !!activeUrl && <BugReportButton activeUrl={activeUrl}/>}
		</div>
	);
};

export default SitesSection;
