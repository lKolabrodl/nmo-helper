import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import ModelDropdown from '.';

describe('ModelDropdown', () => {
	const setModel = vi.fn();

	it('показывает текущую модель', () => {
		const { container } = render(<ModelDropdown model="gpt-4o-mini" setModel={setModel} />);
		const selected = container.querySelector('.nmo-model-name');
		expect(selected).toHaveTextContent('gpt-4o-mini');
	});

	it('клик открывает список', () => {
		const { container } = render(<ModelDropdown model="gpt-4o-mini" setModel={setModel} />);
		const selected = container.querySelector('.nmo-dropdown-selected')!;
		fireEvent.click(selected);
		expect(container.querySelector('.nmo-dropdown')).toHaveClass('open');
	});

	it('выбор модели вызывает setModel', () => {
		const { container } = render(<ModelDropdown model="gpt-4o-mini" setModel={setModel} />);

		// Открываем
		fireEvent.click(container.querySelector('.nmo-dropdown-selected')!);

		// Кликаем на модель
		const items = container.querySelectorAll('.nmo-dropdown-item');
		expect(items.length).toBeGreaterThan(0);
		fireEvent.click(items[0]);

		expect(setModel).toHaveBeenCalled();
	});

	it('рендерит тег rec у рекомендованной модели', () => {
		const { container } = render(<ModelDropdown model="gpt-4.1-mini" setModel={setModel} />);
		// gpt-4.1-mini имеет tag: 'rec' — должна быть звёздочка
		expect(container.querySelector('.nmo-tag-rec')).toBeInTheDocument();
	});
});
