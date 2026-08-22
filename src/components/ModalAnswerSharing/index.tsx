import React, {useState} from 'react';
import {useSettings} from '../../contexts/SettingsContext';
import {IconCheck} from '../icons';
import './styles.scss';

export interface IModalAnswerSharingProps {
	readonly questionCount: number;
	readonly onChange: (save: boolean) => void;
}

const ModalAnswerSharing: React.FC<IModalAnswerSharingProps> = ({questionCount, onChange}) => {
	const {enabled, setEnabled} = useSettings().testDataSharing;
	const [rememberChoice, setRememberChoice] = useState(enabled);

	const handleChange = (save: boolean): void => {
		if (save && rememberChoice) setEnabled(true);
		onChange(save);
	};

	return (
		<div className="nmo-answer-sharing-backdrop">
			<section
				className="nmo-answer-sharing-dialog nmo-fade-up"
				role="dialog"
				aria-modal="true"
				aria-labelledby="nmo-answer-sharing-title"
				aria-describedby="nmo-answer-sharing-description">
				<div className="nmo-answer-sharing-icon" aria-hidden="true">
					<IconCheck size={22}/>
				</div>
				<h2 id="nmo-answer-sharing-title">Помочь другим врачам?</h2>
				<p id="nmo-answer-sharing-description">
					Поделиться правильными ответами из завершённого теста? Данные отправятся
					анонимно и помогут другим врачам быстрее находить ответы.
				</p>
				<div className="nmo-answer-sharing-count">
					Будет отправлено вопросов: <strong>{questionCount}</strong>
				</div>
				<label className="nmo-answer-sharing-remember">
					<input
						type="checkbox"
						checked={rememberChoice}
						onChange={event => setRememberChoice(event.target.checked)}/>
					<span>Запомнить выбор</span>
				</label>
				<div className="nmo-answer-sharing-actions">
					<button
						type="button"
						className="nmo-answer-sharing-no"
						disabled={rememberChoice}
						title={rememberChoice ? 'Снимите «Запомнить выбор», чтобы отказаться' : undefined}
						onClick={() => handleChange(false)}>
						Нет
					</button>
					<button
						type="button"
						className="nmo-answer-sharing-yes"
						autoFocus
						onClick={() => handleChange(true)}>
						Да, поделиться
					</button>
				</div>
			</section>
		</div>
	);
};

export default ModalAnswerSharing;
