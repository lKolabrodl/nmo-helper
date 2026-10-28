import {useEffect, useRef} from 'react';
import type {IQuizQuestionsSnapshot} from '../../utils/quiz-questions';
import {downloadQuizQuestions} from '../../utils/quiz-questions';
import ModalWindow, {MODAL_WINDOW_DRAG_HANDLE_PROPS} from '../ModalWindow';
import './styles.scss';

const WINDOW_SETTINGS = {width: 800, height: 680, minWidth: 320, minHeight: 300};

interface IModalQuizQuestionsProps {
	readonly snapshot: IQuizQuestionsSnapshot;
	readonly onClose: () => void;
}

const ModalQuizQuestions = ({snapshot, onClose}: IModalQuizQuestionsProps) => {
	const bodyRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		if (bodyRef.current) bodyRef.current.scrollTop = 0;
	}, []);

	return (
		<ModalWindow
			storageKey="nmo-helper:quiz-questions-layout:v1"
			settings={WINDOW_SETTINGS}
			className="nmo-quiz-questions-dialog"
			ariaLabelledBy="nmo-quiz-questions-title"
			onClose={onClose}>

			<header className="nmo-quiz-questions-header" {...MODAL_WINDOW_DRAG_HANDLE_PROPS}>
				<h2 id="nmo-quiz-questions-title">Вопросы теста</h2>
				<p>{snapshot.topic}</p>
				<span>Всего вопросов: {snapshot.questions.length}</span>
			</header>

			<div ref={bodyRef} className="nmo-quiz-questions-body">
				{snapshot.questions.map((question, index) => (
					<section className="nmo-quiz-questions-item" key={index}>
						<h3>Вопрос {index + 1}</h3>
						<p>{question.question}</p>
						<div className="nmo-quiz-questions-hint">
							{question.isSingle ? 'Один вариант ответа' : 'Несколько вариантов ответа'}
						</div>
						<ol>
							{question.variants.map((variant, variantIndex) => <li key={variantIndex}>{variant}</li>)}
						</ol>
					</section>
				))}
			</div>

			<footer className="nmo-quiz-questions-footer">
				<button type="button" className="nmo-quiz-questions-close" onClick={onClose}>Закрыть</button>
				<button type="button" className="nmo-quiz-questions-download" onClick={() => downloadQuizQuestions(snapshot)}>
					Скачать TXT
				</button>
			</footer>

		</ModalWindow>
	);
};

export default ModalQuizQuestions;
