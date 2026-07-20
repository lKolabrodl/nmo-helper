import React from 'react';
import './styles.scss';
import {IconBolt, IconPlay} from '../../../icons';

/**
 * Заглушка бесплатного режима. Позже здесь будет подключён старый бесплатный
 * API Pollinations (`https://text.pollinations.ai/`).
 */
const FreeAi: React.FC = () => (
	<>
		<div className="nmo-section-inner nmo-ai-free-content" role="tabpanel">
			<div className="nmo-ai-free nmo-fade-up">
				<div className="nmo-ai-free-icon"><IconBolt size={16}/></div>
				<div className="nmo-ai-free-body">
					<div className="nmo-ai-free-title-row">
						<span className="nmo-ai-free-title">Бесплатный AI</span>
						<span className="nmo-ai-free-badge">По умолчанию</span>
					</div>
					<div className="nmo-ai-free-description">
						Без API-ключа и дополнительных настроек. Подключение бесплатных запросов появится следующим шагом.
					</div>
				</div>
			</div>
		</div>
		<div className="nmo-footer">
			<button
				type="button"
				className="nmo-btn nmo-btn-primary nmo-btn-cta"
				disabled
				title="Бесплатный AI пока не подключён">
				<IconPlay size={14}/>Скоро будет доступно
			</button>
		</div>
	</>
);

export default FreeAi;
