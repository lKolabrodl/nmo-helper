import React, {useState} from 'react';
import './styles.scss';
import {usePanelStatus} from '../../../../contexts/PanelStatusContext';
import {Status} from '../../../../types';
import {StatusTitle} from '../../../../utils/constants';
import AIProxyFreeLoader from '../../../Loader/AIProxyFreeLoader';
import {IconBolt, IconPlay} from '../../../icons';
import InlineToast from '../../../ui/InlineToast';
import ThinkingStrip from '../../../ui/ThinkingStrip';
import {statusToToast} from '../../utils';

interface IFreeAiProps {
	readonly onBusyChange: (busy: boolean) => void;
}

const FreeAi: React.FC<IFreeAiProps> = ({onBusyChange}) => {
	const {status, setStatus} = usePanelStatus();
	const [aiRunning, setAiRunning] = useState(false);

	const run = (): void => {
		setAiRunning(true);
		onBusyChange(true);
		setStatus({title: StatusTitle.RUNNING, status: Status.OK});
	};

	const stop = (): void => {
		setAiRunning(false);
		onBusyChange(false);
		setStatus({title: StatusTitle.STOPPED, status: Status.IDLE});
	};

	const isLoading = status.status === Status.LOADING;
	const isError = status.status === Status.ERR;
	const isOk = status.status === Status.OK;
	const isWarn = status.status === Status.WARN;

	return (
		<>
			<AIProxyFreeLoader
				active={aiRunning}
				onChange={({running}) => {
					if (!running) {
						setAiRunning(false);
						onBusyChange(false);
					}
				}}/>

			<div className="nmo-section-inner nmo-ai-free-content" role="tabpanel">
				<div className="nmo-ai-free nmo-fade-up">
					<div className="nmo-ai-free-icon"><IconBolt size={16}/></div>
					<div className="nmo-ai-free-body">
						<div className="nmo-ai-free-title">Бесплатный AI · автоматически</div>
						<div className="nmo-ai-free-description">
							Никаких ключей и настроек: расширение само выбирает сервис и модель.
						</div>
					</div>
				</div>

				<div className="nmo-ai-free-note">
					Бесплатный AI работает не очень эффективно.
				</div>
			</div>

			{isLoading && <ThinkingStrip title={status.title} steps={[]}/>}
			{(isOk || isError || isWarn) && !isLoading && status.title && (
				<InlineToast toast={statusToToast(status.title, status.status)}/>
			)}

			<div className="nmo-footer">
				{!aiRunning && (
					<button type="button" className="nmo-btn nmo-btn-primary nmo-btn-cta" onClick={run}>
						<IconPlay size={14}/>Запустить AI
					</button>
				)}

				{aiRunning && (
					<button type="button" className="nmo-btn nmo-btn-stop nmo-btn-cta" onClick={stop}>
						Остановить
					</button>
				)}
			</div>
		</>
	);
};

export default FreeAi;
