import React, {useState} from 'react';
import './styles.scss';
import {validateApiKey} from '../../../../api/fetch/fetch-ai';
import {requestCustomEndpointPermission} from '../../../../api/host-permissions';
import {usePanelStatus} from '../../../../contexts/PanelStatusContext';
import {useSettings} from '../../../../contexts/SettingsContext';
import {Status} from '../../../../types';
import {StatusTitle} from '../../../../utils/constants';
import AIProxyLoader from '../../../Loader/AIProxyLoader';
import {IconPlay} from '../../../icons';
import InlineToast from '../../../ui/InlineToast';
import ThinkingStrip from '../../../ui/ThinkingStrip';
import {statusToToast} from '../../utils';

interface ICustomEndpointProps {
	readonly onBusyChange: (busy: boolean) => void;
}

const CustomEndpoint: React.FC<ICustomEndpointProps> = ({onBusyChange}) => {
	// contextик
	const {
		url: customAiUrl,
		setUrl: setCustomAiUrl,
		token: customAiToken,
		setToken: setCustomAiToken,
		model: customAiModel,
		setModel: setCustomAiModel,
	} = useSettings().ai.custom;
	const {status, setStatus} = usePanelStatus();

	// state
	const [aiRunning, setAiRunning] = useState<boolean>(false);
	const [aiDisabled, setAiDisabled] = useState<boolean>(false);

	const _run = async (): Promise<void> => {
		if (!customAiUrl.trim())   return setStatus({title: 'введите API endpoint', status: Status.ERR});
		if (!customAiToken) 	   return setStatus({title: 'введите API токен', status: Status.ERR});
		if (!customAiModel.trim()) return setStatus({title: 'введите название модели', status: Status.ERR});

		setAiDisabled(true);
		onBusyChange(true);
		setStatus({title: 'проверяю доступ к endpoint…', status: Status.LOADING});

		try {
			if (!await requestCustomEndpointPermission(customAiUrl.trim())) {
				throw new Error('доступ к endpoint не разрешён; AI не запущен');
			}
			setStatus({title: StatusTitle.CHECKING_KEY, status: Status.LOADING});
			await validateApiKey(customAiToken, customAiModel.trim(), customAiUrl.trim());
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
			<AIProxyLoader
				active={aiRunning}
				apiKey={customAiToken}
				model={customAiModel.trim()}
				aiUrl={customAiUrl.trim()}
				onChange={({running, disabled}) => {
					if (!running) {
						setAiRunning(false);
						onBusyChange(false);
					}
					setAiDisabled(disabled);
				}}/>

			<div className="nmo-section-inner nmo-ai-custom-content" role="tabpanel">
				<div className="nmo-ai-custom-fields nmo-fade-up">
					<div className="nmo-ai-custom-field">
						<label className="nmo-label" htmlFor="nmo-ai-custom-url">API Endpoint</label>
						<input
							id="nmo-ai-custom-url"
							type="text"
							className="nmo-input mono"
							placeholder="https://api.example.com/v1/chat/completions"
							disabled={aiRunning || aiDisabled}
							value={customAiUrl}
							onChange={event => setCustomAiUrl(event.target.value.trim())}/>
						{__BUILD_TARGET__ === 'chrome-store' && (
							<p className="nmo-hint">
								При первом запуске Chrome попросит доступ к указанному сайту.
								Токен, тема, вопросы и варианты ответов будут отправляться на этот endpoint.
							</p>
						)}
					</div>
					<div className="nmo-ai-custom-field">
						<label className="nmo-label" htmlFor="nmo-ai-custom-token">API Token</label>
						<input
							id="nmo-ai-custom-token"
							type="password"
							className="nmo-input"
							placeholder="токен…"
							disabled={aiRunning || aiDisabled}
							value={customAiToken}
							onChange={event => setCustomAiToken(event.target.value.trim())}/>
					</div>
					<div className="nmo-ai-custom-field">
						<label className="nmo-label" htmlFor="nmo-ai-custom-model">Модель</label>
						<input
							id="nmo-ai-custom-model"
							type="text"
							className="nmo-input mono"
							placeholder="gpt-5.4-mini, llama3, mistral…"
							disabled={aiRunning || aiDisabled}
							value={customAiModel}
							onChange={event => setCustomAiModel(event.target.value)}/>
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
						disabled={aiDisabled}
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

export default CustomEndpoint;
