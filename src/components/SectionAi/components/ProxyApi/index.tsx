import React, {useEffect, useState} from 'react';
import './styles.scss';
import {validateApiKey} from '../../../../api/fetch/fetch-ai';
import {usePanelStatus} from '../../../../contexts/PanelStatusContext';
import {useSettings} from '../../../../contexts/SettingsContext';
import {Status} from '../../../../types';
import {StatusTitle} from '../../../../utils/constants';
import AIModelLoader, {type IAiModelLoaderState} from '../../../Loader/AIModelLoader';
import AIProxyLoader from '../../../Loader/AIProxyLoader';
import ModelDropdown from '../ModelDropdown';
import {IconPlay} from '../../../icons';
import InlineToast from '../../../ui/InlineToast';
import ThinkingStrip from '../../../ui/ThinkingStrip';
import {getApiModel, statusToToast} from '../../utils';

interface IProxyApiProps {
	readonly onBusyChange: (busy: boolean) => void;
}

const ProxyApi: React.FC<IProxyApiProps> = ({onBusyChange}) => {
	// contextик
	const {apiKey, setApiKey, model: aiModel, setModel: setAiModel} = useSettings().ai.proxy;
	const {status, setStatus} = usePanelStatus();

	// state
	const [aiRunning, setAiRunning] = useState(false);
	const [aiDisabled, setAiDisabled] = useState(false);
	const [modelsState, setModelsState] = useState<IAiModelLoaderState>({models: [], loading: true, fresh: false, error: '', warning: ''});
	const {models, loading: modelsLoading, fresh: modelsFresh, error: modelsError, warning: modelsWarning} = modelsState;

	useEffect(() => {
		if (!models.length || aiRunning || aiDisabled) return;
		const selected = models.find(model => model.id === getApiModel(aiModel));
		// Пропавшую модель заменяем только после успешного обновления API.
		if (!selected && aiModel && !modelsFresh) return;
		const nextModel = selected ?? models.find(model => model.tag === 'rec') ?? models[0];
		if (nextModel.id !== aiModel) setAiModel(nextModel.id);
	}, [models, modelsFresh, aiModel, setAiModel, aiRunning, aiDisabled]);

	const modelAvailable = models.some(model => model.id === aiModel);

	const _run = async (): Promise<void> => {
		if (!apiKey) return setStatus({title: StatusTitle.ENTER_KEY, status: Status.ERR});
		if (!modelAvailable) return setStatus({title: 'выберите доступную модель', status: Status.ERR});


		setAiDisabled(true);
		onBusyChange(true);
		setStatus({title: StatusTitle.CHECKING_KEY, status: Status.LOADING});

		try {
			await validateApiKey(apiKey, aiModel);
		} catch (error) {
			setStatus({title: (error as Error).message, status: Status.ERR});
			setAiDisabled(false);
			onBusyChange(false);
			return;
		}

		setAiDisabled(false);
		setAiRunning(true);
		setStatus({title: StatusTitle.RUNNING, status: Status.OK});
	};

	const _stop = (): void => {
		setAiRunning(false);
		onBusyChange(false);
		setStatus({title: StatusTitle.STOPPED, status: Status.IDLE});
	};

	const isLoading = status.status === Status.LOADING;
	const isError = status.status === Status.ERR;
	const isOk = status.status === Status.OK;

	return (
		<>
			<AIModelLoader apiKey={apiKey} onChange={setModelsState}/>
			<AIProxyLoader
				active={aiRunning}
				apiKey={apiKey}
				model={aiModel}
				onChange={({running, disabled}) => {
					if (!running) {
						setAiRunning(false);
						onBusyChange(false);
					}
					setAiDisabled(disabled);
				}}/>

			<div className="nmo-section-inner nmo-ai-proxy-content" role="tabpanel">
				<div className="nmo-ai-proxy-fields nmo-fade-up">
					<div className="nmo-ai-proxy-field">
						<label className="nmo-label" htmlFor="nmo-ai-proxy-key">API-ключ ProxyAPI</label>
						<input
							id="nmo-ai-proxy-key"
							type="password"
							className="nmo-input"
							placeholder="вставьте ключ…"
							disabled={aiRunning || aiDisabled}
							value={apiKey}
							onChange={event => setApiKey(event.target.value.trim())}/>

						{!apiKey && (
							<a
								className="nmo-hint nmo-api-key-link"
								href="https://console.proxyapi.ru/keys"
								target="_blank"
								rel="noreferrer">
								Получить ключ API →
							</a>
						)}

					</div>
					<div className="nmo-ai-proxy-field">
						<label className="nmo-label" htmlFor="nmo-ai-proxy-model">Модель</label>
						<ModelDropdown models={models} model={aiModel} setModel={setAiModel} loading={modelsLoading} disabled={aiRunning || aiDisabled || !models.length}/>
						{modelsLoading && <span className="nmo-hint" role="status">{models.length ? 'обновляю модели и цены…' : 'загружаю модели и цены…'}</span>}
						{modelsWarning && <span className="nmo-hint nmo-models-warning" role="status">{modelsWarning}</span>}
						{modelsError && <span className="nmo-hint nmo-models-warning" role="status">{modelsError}{models.length ? ' — показан сохранённый список' : ''}</span>}
					</div>
				</div>
			</div>

			{isLoading && <ThinkingStrip title={status.title} steps={[]}/>}

			{(isOk || isError) && !isLoading && status.title && (<InlineToast toast={statusToToast(status.title, status.status)}/>)}

			<div className="nmo-footer">
				{!aiRunning &&
					<button
						type="button"
						className="nmo-btn nmo-btn-primary nmo-btn-cta"
						disabled={aiDisabled || !modelAvailable}
						onClick={_run}>
						<IconPlay size={14}/>Запустить AI
					</button>
				}
				{aiRunning &&
					<button type="button" className="nmo-btn nmo-btn-stop nmo-btn-cta" onClick={_stop}>
						Остановить
					</button>
				}
			</div>
		</>
	);
};

export default ProxyApi;
