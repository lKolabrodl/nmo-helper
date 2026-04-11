const js = require('@eslint/js');
const tseslint = require('typescript-eslint');
const react = require('eslint-plugin-react');
const reactHooks = require('eslint-plugin-react-hooks');

module.exports = tseslint.config(
	js.configs.recommended,
	...tseslint.configs.recommended,
	{
		files: ['src/**/*.{ts,tsx}'],
		plugins: {
			react,
			'react-hooks': reactHooks,
		},
		settings: {
			react: { version: 'detect' },
		},
		languageOptions: {
			parserOptions: {
				ecmaFeatures: { jsx: true },
			},
		},
		rules: {
			// --- Formatting ---
			indent: ['error', 'tab'],
			quotes: ['error', 'single', { avoidEscape: true }],
			semi: ['error', 'always'],

			// --- TypeScript ---
			'@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
			'@typescript-eslint/no-explicit-any': 'warn',

			// --- React ---
			'react/react-in-jsx-scope': 'off',
			'react-hooks/rules-of-hooks': 'error',
			'react-hooks/exhaustive-deps': 'warn',

			// --- General ---
			'no-console': ['warn', { allow: ['warn', 'error'] }],
			'prefer-const': 'error',
			'no-var': 'error',
			eqeqeq: ['error', 'always'],
		},
	},
	{
		ignores: ['dist/', 'node_modules/', 'build.js', 'tests/'],
	},
);
