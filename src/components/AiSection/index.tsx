import React, {useEffect, useState} from 'react';
import './styles.scss';
import {usePanelUi} from '../../contexts/PanelUiContext';
import {usePanelStatus} from '../../contexts/PanelStatusContext';
import {validateApiKey} from '../../api/fetch';
import {storageSet, storageGet} from '../../utils';
import {Status} from '../../types';
import {StatusTitle} from '../../utils/constants';
import ModelDropdown from '../ModelDropdown';
import AIProxyLoader from '../Loader/AIProxyLoader';
import {IconPlay} from '../icons';
import InlineToast, {type IToast} from '../ui/InlineToast';
import ThinkingStrip from '../ui/ThinkingStrip';

const AiSection: React.FC = (): React.JSX.Element => {
	const {mode, setMode} = usePanelUi();
	const {status, setStatus} = usePanelStatus();

	const isCustom = mode === 'ai-pro';

	const [apiKey, setApiKeyRaw] = useState<string | null>(null);
	const [model, setModelRaw] = useState('gpt-4o-mini');

	const [customUrl, setCustomUrlRaw] = useState<string | null>(null);
	const [customToken, setCustomTokenRaw] = useState<string | null>(null);
	const [customModel, setCustomModelRaw] = useState<string | null>(null);

	const [aiRunning, setAiRunning] = useState(false);
	const [aiDisabled, setAiDisabled] = useState(false);

	useEffect(() => {
		storageGet('apiKey', '').then(v => setApiKeyRaw(v || null));
		storageGet('aiModel', 'gpt-4o-mini').then(setModelRaw);
		storageGet('customAiUrl', '').then(v => setCustomUrlRaw(v || null));
		storageGet('customAiToken', '').then(v => setCustomTokenRaw(v || null));
		storageGet('customAiModel', '').then(v => setCustomModelRaw(v || null));
	}, []);

	const _setApiKey = (v: string) => { setApiKeyRaw(v); storageSet('apiKey', v); };
	const _setModel = (v: string) => { setModelRaw(v); storageSet('aiModel', v); };

	const _setCustomUrl = (v: string) => { setCustomUrlRaw(v); storageSet('customAiUrl', v); };
	const _setCustomToken = (v: string) => { setCustomTokenRaw(v); storageSet('customAiToken', v); };
	const _setCustomModel = (v: string) => { setCustomModelRaw(v); storageSet('customAiModel', v); };

	const validateProxy = async (): Promise<void> => {
		if (!apiKey) throw new Error(StatusTitle.ENTER_KEY);
		setAiDisabled(true);
		setStatus({title: StatusTitle.CHECKING_KEY, status: Status.LOADING});
		await validateApiKey(apiKey, model);
	};

	const validateCustom = async () => {
		if (!customUrl?.trim()) throw new Error('введите API endpoint');
		if (!customToken) throw new Error('введите API токен');
		if (!customModel?.trim()) throw new Error('введите название модели');
		setAiDisabled(true);
		setStatus({title: StatusTitle.CHECKING_KEY, status: Status.LOADING});
		await validateApiKey(customToken, customModel.trim(), customUrl.trim());
	};

	const _run = async () => {
		try {
			if (isCustom) await validateCustom();
			else await validateProxy();
		} catch (err) {
			setStatus({title: (err as Error).message, status: Status.ERR});
			setAiDisabled(false);
			return;
		}

		setAiDisabled(false);
		setAiRunning(true);
		setStatus({title: StatusTitle.RUNNING, status: Status.OK});
	};

	const _stop = () => {
		setAiRunning(false);
		setStatus({title: StatusTitle.STOPPED, status: Status.IDLE});
	};

	const isLoading = status.status === Status.LOADING;
	const isError = status.status === Status.ERR;
	const isOk = status.status === Status.OK;

	return (
		<div className="nmo-section">
			<AIProxyLoader
				active={aiRunning}
				apiKey={isCustom ? (customToken ?? '') : (apiKey ?? '')}
				model={isCustom ? (customModel ?? '').trim() : model}
				aiUrl={isCustom ? (customUrl ?? '').trim() : undefined}
				onChange={({running, disabled}) => { if (!running) setAiRunning(false); setAiDisabled(disabled); }}
			/>

			<div className="nmo-section-inner">
				<label className={`nmo-switch ${isCustom ? 'on' : ''} ${aiRunning ? 'disabled' : ''}`}>
					<button type="button"
						className="nmo-switch-track"
						disabled={aiRunning}
						onClick={() => setMode(isCustom ? 'ai' : 'ai-pro')}>
						<span className="nmo-switch-thumb"/>
					</button>
					<span className="nmo-switch-label">Свой endpoint</span>
				</label>

				<div className="nmo-ai-fields nmo-fade-up">
					{!isCustom ? (
						<ProxyFields
							apiKey={apiKey}
							setApiKey={_setApiKey}
							model={model}
							setModel={_setModel}
							disabled={aiRunning}/>
					) : (
						<CustomFields
							url={customUrl}
							setUrl={_setCustomUrl}
							token={customToken}
							setToken={_setCustomToken}
							model={customModel}
							setModel={_setCustomModel}
							disabled={aiRunning}/>
					)}
				</div>
			</div>

			{isLoading && <ThinkingStrip title={status.title} steps={[]}/>}

			{(isOk || isError) && !isLoading && status.title && (
				<InlineToast toast={statusToToast(status.title, status.status)}/>
			)}

			<div className="nmo-footer">
				{!aiRunning ? (
					<button type="button"
						className="nmo-btn nmo-btn-primary nmo-btn-cta"
						disabled={aiDisabled}
						onClick={_run}>
						<IconPlay size={14}/>Запустить AI
					</button>
				) : (
					<button type="button"
						className="nmo-btn nmo-btn-stop nmo-btn-cta"
						onClick={_stop}>
						Остановить
					</button>
				)}
			</div>
		</div>
	);
};

export default AiSection;


interface IProxyFieldsProps {
	readonly apiKey: string | null;
	readonly setApiKey: (v: string) => void;
	readonly model: string;
	readonly setModel: (v: string) => void;
	readonly disabled?: boolean;
}

const ProxyFields: React.FC<IProxyFieldsProps> = ({apiKey, setApiKey, model, setModel, disabled}) => (
	<>
		<div className="nmo-ai-field">
			<label className="nmo-label">API-ключ ProxyAPI</label>
			<input type="password"
				className="nmo-input"
				placeholder="вставьте ключ…"
				disabled={disabled}
				value={apiKey ?? ''}
				onChange={e => setApiKey(e.target.value.trim())}/>
			{!apiKey && (
				<a className="nmo-hint"
					href="https://console.proxyapi.ru/keys"
					target="_blank"
					rel="noreferrer">Получить ключ API →</a>
			)}
		</div>
		<div className="nmo-ai-field">
			<label className="nmo-label">Модель</label>
			<ModelDropdown model={model} setModel={setModel} disabled={disabled}/>
		</div>
	</>
);


interface ICustomFieldsProps {
	readonly url: string | null;
	readonly setUrl: (v: string) => void;
	readonly token: string | null;
	readonly setToken: (v: string) => void;
	readonly model: string | null;
	readonly setModel: (v: string) => void;
	readonly disabled?: boolean;
}

const CustomFields: React.FC<ICustomFieldsProps> = ({url, setUrl, token, setToken, model, setModel, disabled}) => (
	<>
		<div className="nmo-ai-field">
			<label className="nmo-label">API Endpoint</label>
			<input type="text"
				className="nmo-input mono"
				placeholder="https://api.example.com/v1/chat/completions"
				disabled={disabled}
				value={url ?? ''}
				onChange={e => setUrl(e.target.value.trim())}/>
		</div>
		<div className="nmo-ai-field">
			<label className="nmo-label">API Token</label>
			<input type="password"
				className="nmo-input"
				placeholder="токен…"
				disabled={disabled}
				value={token ?? ''}
				onChange={e => setToken(e.target.value.trim())}/>
		</div>
		<div className="nmo-ai-field">
			<label className="nmo-label">Модель</label>
			<input type="text"
				className="nmo-input mono"
				placeholder="gpt-4o, llama3, mistral…"
				disabled={disabled}
				value={model ?? ''}
				onChange={e => setModel(e.target.value)}/>
		</div>
	</>
);

function statusToToast(title: string, status: typeof Status[keyof typeof Status]): IToast {
	if (status === Status.OK)   return {kind: 'success', title};
	if (status === Status.ERR)  return {kind: 'danger',  title};
	return {kind: 'warning', title};
}
