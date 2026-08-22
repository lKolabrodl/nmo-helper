import {beforeEach, describe, expect, it, vi} from 'vitest';
import {NMO_API_BASE_URL} from '../../utils/constants';
import {submitSharedQuestions} from './submit-shared-questions';

const mocks = vi.hoisted(() => ({
	fetchViaBackground: vi.fn(),
}));

vi.mock('./fetch', async importOriginal => ({
	...await importOriginal<typeof import('./fetch')>(),
	fetchViaBackground: mocks.fetchViaBackground,
}));

const SUBMISSION_ID = '4db424d4-c223-4ad1-a931-01fbc208ecad';
const QUESTIONS = [{
	text: 'Вопрос?',
	options: ['Нет', 'Да'],
	correct_indexes: [1],
}] as const;

beforeEach(() => {
	mocks.fetchViaBackground.mockReset();
	mocks.fetchViaBackground.mockResolvedValue({
		error: false,
		status: 200,
		text: '{"submitted_question_count":1}',
	});
});

describe('submitSharedQuestions', () => {
	it('отправляет подписываемый POST в формате API пополнения базы', async () => {
		await submitSharedQuestions('  Кардиология - 2025  ', QUESTIONS, SUBMISSION_ID);

		expect(mocks.fetchViaBackground).toHaveBeenCalledOnce();
		const [url, options] = mocks.fetchViaBackground.mock.calls[0] as [
			string,
			{method: string; headers: Record<string, string>; body: string; credentials: string},
		];
		expect(url).toBe(`${NMO_API_BASE_URL}/topics`);
		expect(options).toMatchObject({
			method: 'POST',
			headers: {
				'Accept': 'application/json',
				'Content-Type': 'application/json',
			},
			credentials: 'omit',
		});
		expect(JSON.parse(options.body)).toEqual({
			submission_id: SUBMISSION_ID,
			title: 'Кардиология - 2025',
			questions: QUESTIONS,
		});
	});

	it('не отправляет пустую тему или пустой список вопросов', async () => {
		await expect(submitSharedQuestions('   ', QUESTIONS, SUBMISSION_ID))
			.rejects.toThrow('не указана тема теста');
		await expect(submitSharedQuestions('Тема', [], SUBMISSION_ID))
			.rejects.toThrow('нет правильных ответов');
		expect(mocks.fetchViaBackground).not.toHaveBeenCalled();
	});

	it('пробрасывает ошибку отклонённого сервером запроса', async () => {
		mocks.fetchViaBackground.mockResolvedValue({
			error: false,
			status: 422,
			text: '{"detail":"invalid_question_submission"}',
		});

		await expect(submitSharedQuestions('Тема', QUESTIONS, SUBMISSION_ID))
			.rejects.toThrow('ошибка 422');
	});
});
