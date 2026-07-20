import React, {useState} from 'react';
import './styles.scss';
import {validateApiKey} from '../../../../api/fetch';
import {usePanelStatus} from '../../../../contexts/PanelStatusContext';
import {useSettings} from '../../../../contexts/SettingsContext';
import {Status} from '../../../../types';
import {StatusTitle} from '../../../../utils/constants';
import AIProxyLoader from '../../../Loader/AIProxyLoader';
import ModelDropdown from '../../../ModelDropdown';
import {IconPlay} from '../../../icons';
import InlineToast, {type IToast} from '../../../ui/InlineToast';
import ThinkingStrip from '../../../ui/ThinkingStrip';

interface IProxyApiProps {
	readonly onBusyChange: (busy: boolean) => void;
}

const ProxyApi: React.FC<IProxyApiProps> = ({onBusyChange}) => {
	// contextик
	const {apiKey, setApiKey, aiModel, setAiModel} = useSettings();
	const {status, setStatus} = usePanelStatus();

	// state
	const [aiRunning, setAiRunning] = useState(false);
	const [aiDisabled, setAiDisabled] = useState(false);

	const _run = async (): Promise<void> => {
		if (!apiKey) return setStatus({title: StatusTitle.ENTER_KEY, status: Status.ERR});


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
							<a className="nmo-hint"	href="https://console.proxyapi.ru/keys"	target="_blank"	rel="noreferrer">
								Получить ключ API →
							</a>
						)}

					</div>
					<div className="nmo-ai-proxy-field">
						<label className="nmo-label">Модель</label>
						<ModelDropdown model={aiModel} setModel={setAiModel} disabled={aiRunning || aiDisabled}/>
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

export default ProxyApi;

function statusToToast(title: string, status: typeof Status[keyof typeof Status]): IToast {
	if (status === Status.OK) return {kind: 'success', title};
	if (status === Status.ERR) return {kind: 'danger', title};
	return {kind: 'warning', title};
}
