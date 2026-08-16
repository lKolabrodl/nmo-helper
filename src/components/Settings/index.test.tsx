import {fireEvent, screen} from '@testing-library/react';
import {describe, expect, it} from 'vitest';
import {storageGet} from '../../utils';
import {TEST_DATA_SHARING_STORAGE_KEY} from '../../contexts/SettingsContext';
import {renderWithProviders} from '../../tests-helpers';
import Settings from './index';

describe('Settings', () => {
	it('включает передачу данных тестов только после явного согласия', async () => {
		renderWithProviders(<Settings/>);

		fireEvent.click(screen.getByRole('button', {name: 'Настройки'}));

		const option = screen.getByRole('menuitemcheckbox', {
			name: 'Делиться данными теста',
		});
		const checkbox = screen.getByLabelText('Делиться данными теста');

		expect(option).toHaveAttribute('aria-checked', 'false');
		expect(checkbox).not.toBeChecked();

		fireEvent.click(checkbox);

		expect(option).toHaveAttribute('aria-checked', 'true');
		expect(checkbox).toBeChecked();
		await expect(storageGet(TEST_DATA_SHARING_STORAGE_KEY, false)).resolves.toBe(true);

		fireEvent.click(checkbox);

		expect(option).toHaveAttribute('aria-checked', 'false');
		expect(checkbox).not.toBeChecked();
		await expect(storageGet(TEST_DATA_SHARING_STORAGE_KEY, true)).resolves.toBe(false);
	});
});
