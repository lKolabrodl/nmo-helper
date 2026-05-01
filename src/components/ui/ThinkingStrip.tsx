import React, {useEffect, useState} from 'react';
import './ui.scss';

const STEPS = ['Читаю вопросы…', 'Сверяю с базой…', 'Подбираю ответы…'];

interface IProps {
	readonly title?: string;
	readonly steps?: readonly string[];
}

const ThinkingStrip: React.FC<IProps> = ({title = 'AI думает…', steps = STEPS}) => {
	const [step, setStep] = useState(0);

	useEffect(() => {
		const t = setInterval(() => setStep(s => (s + 1) % steps.length), 800);
		return () => clearInterval(t);
	}, [steps.length]);

	return (
		<div className="nmo-strip nmo-fade-up">
			<span className="nmo-spinner nmo-spinner-md"/>
			<div className="nmo-strip-body">
				<div className="nmo-strip-title">{title}</div>
				<div className="nmo-strip-sub">{steps[step]}</div>
			</div>
		</div>
	);
};

export default ThinkingStrip;
