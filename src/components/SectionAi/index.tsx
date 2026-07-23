import React, {useState} from 'react';
import cn from 'classnames';
import './styles.scss';
import {usePanelStatus} from '../../contexts/PanelStatusContext';
import {useSettings} from '../../contexts/SettingsContext';
import type {AiProvider} from '../../types';
import {Status} from '../../types';
import CustomEndpoint from './components/CustomEndpoint';
import FreeAi from './components/FreeAi';
import ProxyApi from './components/ProxyApi';

const AI_PROVIDERS: ReadonlyArray<{readonly id: AiProvider; readonly label: string}> = [
	{id: 'free', label: 'Бесплатно'},
	{id: 'proxy', label: 'ProxyAPI'},
	{id: 'custom', label: 'Свой endpoint'},
];

const SectionAi: React.FC = (): React.JSX.Element => {
	const {aiProvider, setAiProvider} = useSettings();
	const {setStatus} = usePanelStatus();
	const [providerLocked, setProviderLocked] = useState(false);

	const selectProvider = (provider: AiProvider): void => {
		if (providerLocked || provider === aiProvider) return;
		setAiProvider(provider);
		setStatus({title: '', status: Status.IDLE});
	};

	return (
		<div className="nmo-section">
			<div className="nmo-section-inner">
				<div className={cn('nmo-ai-provider-tabs', {disabled: providerLocked})}	role="tablist" aria-label="Вариант подключения AI">
					{AI_PROVIDERS.map(provider => (
						<button
							key={provider.id}
							type="button"
							role="tab"
							aria-selected={aiProvider === provider.id}
							className={cn({active: aiProvider === provider.id})}
							disabled={providerLocked}
							onClick={() => selectProvider(provider.id)}>
							{provider.label}
						</button>
					))}
				</div>
			</div>

			{aiProvider === 'free' && <FreeAi/>}
			{aiProvider === 'proxy' && <ProxyApi onBusyChange={setProviderLocked}/>}
			{aiProvider === 'custom' && <CustomEndpoint onBusyChange={setProviderLocked}/>}
		</div>
	);
};

export default SectionAi;
