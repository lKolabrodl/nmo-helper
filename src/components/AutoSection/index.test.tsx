import { describe, it, expect, vi } from 'vitest';
import { screen } from '@testing-library/react';
import AutoSection from '.';
import { renderWithProviders } from '../../tests-helpers';

// Мокаем fetchViaBackground чтобы VariantLoader/AnswerLoader не делали реальные запросы
vi.mock('../../utils', async (importOriginal) => {
	const actual = await importOriginal<typeof import('../../utils')>();
	return { ...actual, fetchViaBackground: vi.fn().mockResolvedValue({ error: false, status: 200, text: '' }) };
});

// Мокаем answerCache
vi.mock('../../utils/answer-cache', () => ({
	answerCache: {
		get: vi.fn(() => null),
		set: vi.fn(),
		getCorrectIndexes: vi.fn(() => null),
		isFresh: vi.fn(() => false),
	},
}));

describe('AutoSection', () => {
	it('рендерит блок статуса', () => {
		const { container } = renderWithProviders(<AutoSection />, { initialMode: 'auto' });
		expect(container.querySelector('.nmo-status')).toBeInTheDocument();
	});

	it('рендерит секцию', () => {
		const { container } = renderWithProviders(<AutoSection />, { initialMode: 'auto' });
		expect(container.querySelector('.nmo-section')).toBeInTheDocument();
	});

	it('не показывает ошибку когда нет темы', () => {
		renderWithProviders(<AutoSection />, { initialMode: 'auto' });
		// rawTopic = null по умолчанию в QuestionFinderContext,
		// VariantLoader получит пустую строку и вернёт IDLE,
		// handleSearch должен промолчать (не показать NOT_FOUND)
		expect(screen.queryByText('ответы не найдены на сайтах')).not.toBeInTheDocument();
	});
});
