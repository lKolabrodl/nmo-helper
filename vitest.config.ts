import { defineConfig } from 'vitest/config';

export default defineConfig({
	test: {
		environment: 'jsdom',
		globals: true,
		setupFiles: ['./src/tests-setup.ts'],
		include: ['src/**/*.test.{ts,tsx}'],
	},
	esbuild: {
		jsx: 'automatic',
		jsxImportSource: 'react',
	},
});
