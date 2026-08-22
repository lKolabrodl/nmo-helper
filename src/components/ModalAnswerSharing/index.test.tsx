import {fireEvent, render, screen} from '@testing-library/react';
import {beforeEach, describe, expect, it, vi} from 'vitest';
import ModalAnswerSharing from './index';

const settings = vi.hoisted(() => ({
	enabled: false,
	setEnabled: vi.fn(),
}));

vi.mock('../../contexts/SettingsContext', () => ({
	useSettings: () => ({testDataSharing: settings}),
}));

describe('ModalAnswerSharing', () => {
	beforeEach(() => {
		settings.enabled = false;
		settings.setEnabled.mockReset();
	});

	it('показывает количество вопросов и доступный диалог', () => {
		render(<ModalAnswerSharing questionCount={17} onChange={vi.fn()}/>);

		const dialog = screen.getByRole('dialog', {name: 'Помочь другим врачам?'});
		expect(dialog).toHaveAttribute('aria-modal', 'true');
		expect(screen.getByText('17')).toBeInTheDocument();
		expect(dialog.querySelector('img')).toHaveAttribute(
			'src',
			'chrome-extension://nmo-helper/icons/new_icon.png',
		);
	});

	it('отправляет разовое согласие без сохранения настройки', () => {
		const onChange = vi.fn();
		render(<ModalAnswerSharing questionCount={1} onChange={onChange}/>);

		fireEvent.click(screen.getByRole('button', {name: 'Да, поделиться'}));

		expect(onChange).toHaveBeenCalledWith(true);
		expect(settings.setEnabled).not.toHaveBeenCalled();
	});

	it('запоминает согласие по выбранному флажку', () => {
		const onChange = vi.fn();
		render(<ModalAnswerSharing questionCount={2} onChange={onChange}/>);

		fireEvent.click(screen.getByRole('checkbox', {name: 'Запомнить выбор'}));
		fireEvent.click(screen.getByRole('button', {name: 'Да, поделиться'}));

		expect(settings.setEnabled).toHaveBeenCalledWith(true);
		expect(onChange).toHaveBeenCalledWith(true);
	});

	it('позволяет отказаться, если выбор не запоминается', () => {
		const onChange = vi.fn();
		render(<ModalAnswerSharing questionCount={2} onChange={onChange}/>);

		fireEvent.click(screen.getByRole('button', {name: 'Нет'}));

		expect(onChange).toHaveBeenCalledWith(false);
		expect(settings.setEnabled).not.toHaveBeenCalled();
	});

	it('не позволяет отказаться при включённом запоминании', () => {
		settings.enabled = true;
		const onChange = vi.fn();
		render(<ModalAnswerSharing questionCount={2} onChange={onChange}/>);

		expect(screen.getByRole('checkbox', {name: 'Запомнить выбор'})).toBeChecked();
		const noButton = screen.getByRole('button', {name: 'Нет'});
		expect(noButton).toBeDisabled();
		expect(noButton).toHaveAttribute('title', 'Снимите «Запомнить выбор», чтобы отказаться');
		fireEvent.click(noButton);

		expect(onChange).not.toHaveBeenCalled();
	});
});
