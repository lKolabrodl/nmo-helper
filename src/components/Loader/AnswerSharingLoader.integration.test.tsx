import {afterEach, describe, expect, it, vi} from 'vitest';
import {cleanup, fireEvent, render, screen} from '@testing-library/react';
import AnswerSharingLoader from './AnswerSharingLoader';
import QuestionCacheCollector from './QuestionCacheCollector';

const mocks = vi.hoisted(() => ({submitSharedQuestions: vi.fn().mockResolvedValue(undefined)}));

vi.mock('../../api/fetch/submit-shared-questions', () => ({
	submitSharedQuestions: mocks.submitSharedQuestions,
}));

vi.mock('../../contexts/SettingsContext', () => ({
	useSettings: () => ({testDataSharing: {enabled: false, setEnabled: vi.fn()}}),
}));

afterEach(() => {
	cleanup();
	delete window.__NMO_HELPER_STATE__;
	document.body.innerHTML = '';
	mocks.submitSharedQuestions.mockClear();
});

describe('сохранение ответов и показ окна на итоговой странице', () => {
	it('показывает окно после выбора ответа в новой разметке и очистки State', async () => {
		const question = {
			question: 'Первый вопрос', variants: ['Вариант A', 'Вариант B'], isSingle: true,
		};
		window.__NMO_HELPER_STATE__ = {
			topic: 'Тестовая тема - 2025 - Контрольное тестирование', question, questions: [question],
		};
		document.body.innerHTML = `
			<lib-main-layout><lib-quiz-page><lib-quiz>
				<mat-card-title class="mat-card-title-quiz-custom">
					Тестовая тема - 2025 - Контрольное тестирование
				</mat-card-title>
				<div id="questionAnchor">
					<div class="question-title-text">Первый вопрос</div>
					<mat-radio-button>
						<div class="mat-internal-form-field">
							<input id="answer-a" type="radio" name="answer">
							<label for="answer-a"><span>Вариант A</span></label>
						</div>
					</mat-radio-button>
					<mat-radio-button>
						<div class="mat-internal-form-field">
							<input id="answer-b" type="radio" name="answer">
							<label for="answer-b"><span>Вариант B</span></label>
						</div>
					</mat-radio-button>
				</div>
			</lib-quiz></lib-quiz-page></lib-main-layout>
		`;
		render(<><QuestionCacheCollector/><AnswerSharingLoader/></>);

		fireEvent.click(document.getElementById('answer-b')!);
		window.__NMO_HELPER_STATE__ = null;
		document.querySelector('lib-main-layout')!.outerHTML = `
			<lib-main-layout><lib-quiz-page>
				<lib-quiz>
					<mat-card-title class="mat-card-title-quiz-custom">
						Тестовая тема - 2025 - Контрольное тестирование
					</mat-card-title>
					<lib-status-indicator>
						<div class="text text_label">Статус</div>
						<div class="text text_value text-success">Завершен</div>
					</lib-status-indicator>
				</lib-quiz>
				<mat-card><lib-questions-list><div class="questionList"><mat-card-content>
					<div id="item-0"><div class="mat-ripple questionList-item">
						<div class="questionList-item-number">1</div>
						<div class="questionList-item-content">
							<div class="questionList-item-content-title">Первый вопрос</div>
							<span class="questionList-item-content-answer-text">Вариант B</span>
						</div>
						<div class="questionList-item-status">
							<div class="questionList-item-status-wright">Верно</div>
						</div>
					</div></div>
				</mat-card-content></div></lib-questions-list></mat-card>
			</lib-quiz-page></lib-main-layout>
		`;

		expect(await screen.findByRole('dialog', {name: 'Помочь другим врачам?'})).toBeInTheDocument();
		expect(mocks.submitSharedQuestions).not.toHaveBeenCalled();
		fireEvent.click(screen.getByRole('button', {name: 'Да, поделиться'}));
		expect(mocks.submitSharedQuestions).toHaveBeenCalledWith('Тестовая тема - 2025', [{
			text: 'Первый вопрос', options: ['Вариант A', 'Вариант B'], correct_indexes: [1],
		}]);
	});
});
