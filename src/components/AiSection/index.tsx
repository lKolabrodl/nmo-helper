import React, { useEffect, useState } from 'react';
import './styles.scss';
import { usePanelUi } from '../../contexts/PanelUiContext';
import { usePanelStatus } from '../../contexts/PanelStatusContext';
import { validateApiKey } from '../../api/fetch';
import { storageSet, storageGet } from '../../utils';
import { Status } from '../../types';
import { StatusTitle } from '../../utils/constants';
import ModelDropdown from '../ModelDropdown';
import AIProxyLoader from '../Loader/AIProxyLoader';

const AiSection: React.FC = () => {
	const { mode, setMode } = usePanelUi();
	const { status, setStatus } = usePanelStatus();

	const isCustom = mode === 'ai-pro';

	const [apiKey, setApiKeyRaw] = useState<string | null>(null);
	const [model, setModelRaw] = useState('gpt-4o-mini');

	const [customUrl, setCustomUrlRaw] = useState<string | null>(null);
	const [customToken, setCustomTokenRaw] = useState<string | null>(null);
	const [customModel, setCustomModelRaw] = useState<string | null>(null);

	const [aiRunning, setAiRunning] = useState(false);
	const [aiDisabled, setAiDisabled] = useState(false);

	// Читаем актуальные значения из storage при монтировании
	useEffect(() => {
		storageGet('apiKey', '').then(v => setApiKeyRaw(v || null));
		storageGet('aiModel', 'gpt-4o-mini').then(setModelRaw);
		storageGet('customAiUrl', '').then(v => setCustomUrlRaw(v || null));
		storageGet('customAiToken', '').then(v => setCustomTokenRaw(v || null));
		storageGet('customAiModel', '').then(v => setCustomModelRaw(v || null));
	}, []);

	const setApiKey = (v: string) => { setApiKeyRaw(v); storageSet('apiKey', v); };
	const setModel = (v: string) => { setModelRaw(v); storageSet('aiModel', v); };
	const setCustomUrl = (v: string) => { setCustomUrlRaw(v); storageSet('customAiUrl', v); };
	const setCustomToken = (v: string) => { setCustomTokenRaw(v); storageSet('customAiToken', v); };
	const setCustomModel = (v: string) => { setCustomModelRaw(v); storageSet('customAiModel', v); };

	const validateProxy = async () => {
		if (!apiKey) throw new Error(StatusTitle.ENTER_KEY);

		setAiDisabled(true);
		setStatus({ title: StatusTitle.CHECKING_KEY, status: Status.LOADING });
		await validateApiKey(apiKey, model);
	};

	const validateCustom = async () => {
		if (!customUrl?.trim()) throw new Error('введите API endpoint');
		if (!customToken) throw new Error('введите API токен');
		if (!customModel?.trim()) throw new Error('введите название модели');

		setAiDisabled(true);
		setStatus({ title: StatusTitle.CHECKING_KEY, status: Status.LOADING });
		await validateApiKey(customToken, customModel.trim(), customUrl.trim());
	};

	const _run = async () => {
		try {
			if (isCustom) await validateCustom();
			else await validateProxy();
		}
		catch (err) {
			setStatus({ title: (err as Error).message, status: Status.ERR });
			setAiDisabled(false);
			return;
		}

		setAiDisabled(false);
		setAiRunning(true);
		setStatus({ title: StatusTitle.RUNNING, status: Status.OK });
	};

	const _stop = () => {
		setAiRunning(false);
		setStatus({ title: StatusTitle.STOPPED, status: Status.IDLE });
	};

	return (
		<div className="nmo-section">
			<AIProxyLoader
				active={aiRunning}
				apiKey={isCustom ? (customToken ?? '') : (apiKey ?? '')}
				model={isCustom ? (customModel ?? '').trim() : model}
				aiUrl={isCustom ? (customUrl ?? '').trim() : undefined}
				onChange={({ running, disabled }) => { if (!running) setAiRunning(false); setAiDisabled(disabled); }}
			/>

			<label className="nmo-switch">
				<input type="checkbox" checked={isCustom} onChange={() => setMode(isCustom ? 'ai' : 'ai-pro')} />
				<span>Свой endpoint</span>
			</label>


			{!isCustom && <ProxyFields apiKey={apiKey} setApiKey={setApiKey} model={model} setModel={setModel}/>}

			{isCustom &&
				<CustomFields
					url={customUrl}
					setUrl={setCustomUrl}
					token={customToken} setToken={setCustomToken}
					model={customModel} setModel={setCustomModel}
				/>
			}

			<div className="nmo-btn-row">
				{!aiRunning &&
					<button className="nmo-btn nmo-btn-primary" onClick={_run} disabled={aiDisabled}>Запуск AI</button>

				}
				{aiRunning && <button className="nmo-btn nmo-btn-stop" onClick={_stop}>Стоп</button>}
			</div>

			<div className={`nmo-status ${status.status}`}>{status.title}</div>
		</div>
	);
};

export default AiSection;


interface IProxyFieldsProps {
	readonly apiKey: string | null;
	readonly setApiKey: (v: string) => void;
	readonly model: string;
	readonly setModel: (v: string) => void;
}

/** Поля ProxyAPI-режима */
const ProxyFields: React.FC<IProxyFieldsProps> = ({apiKey, setApiKey, model, setModel}) => (
	<>
		<div className="nmo-field">
			<label>API-ключ ProxyAPI</label>
			<input
				type="password"
				placeholder="вставьте ключ..."
				value={apiKey ?? ''}
				onChange={(e) => setApiKey(e.target.value.trim())}
			/>
			{!apiKey && (
				<a className="nmo-key-hint" href="https://console.proxyapi.ru/keys" target="_blank" rel="noreferrer">
					Получить ключ API
				</a>
			)}
		</div>
		<div className="nmo-field">
			<label>Модель</label>
			<ModelDropdown model={model} setModel={setModel}/>
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
}

/** Поля Custom endpoint режима */
const CustomFields: React.FC<ICustomFieldsProps> = ({url, setUrl, token, setToken, model, setModel}) => (
	<>
		<div className="nmo-field">
			<label>API Endpoint</label>
			<input
				type="text"
				placeholder="https://api.example.com/v1/chat/completions"
				value={url ?? ''}
				onChange={(e) => setUrl(e.target.value.trim())}
			/>
		</div>
		<div className="nmo-field">
			<label>API Token</label>
			<input
				type="password"
				placeholder="токен..."
				value={token ?? ''}
				onChange={(e) => setToken(e.target.value.trim())}
			/>
		</div>
		<div className="nmo-field">
			<label>Модель</label>
			<input
				type="text"
				placeholder="gpt-4o, llama3, mistral..."
				value={model ?? ''}
				onChange={(e) => setModel(e.target.value)}
			/>
		</div>
	</>
);