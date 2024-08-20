import path from 'node:path';
import { fileURLToPath } from 'node:url';

import tseslint from 'typescript-eslint';

// plugins
import noOnlyTestsEslint from 'eslint-plugin-no-only-tests';
import regexpEslint from 'eslint-plugin-regexp';
const typescriptEslint = tseslint.plugin;

// parsers
const typescriptParser = tseslint.parser;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default [
	// If ignores is used without any other keys in the configuration object, then the patterns act as global ignores.
	// ref: https://eslint.org/docs/latest/use/configure/configuration-files#globally-ignoring-files-with-ignores
	{
		ignores: [
			'**/.*',
			'**/*.d.ts',
			'packages/**/*.min.js',
			'packages/**/dist/',
			'packages/**/fixtures/',
			'scripts/',
			'.github/',
			'.changeset/',
		],
	},

	...tseslint.configs.recommendedTypeChecked,
	...tseslint.configs.stylisticTypeChecked,
	regexpEslint.configs['flat/recommended'],
	{
		languageOptions: {
			parser: typescriptParser,
			parserOptions: {
				project: ['./packages/*/tsconfig.json', './tsconfig.eslint.json'],
				tsconfigRootDir: __dirname,
			},
		},
		plugins: {
			'@typescript-eslint': typescriptEslint,
			'no-only-tests': noOnlyTestsEslint,
			regexp: regexpEslint,
		},
		rules: {
			// These off/configured-differently-by-default rules fit well for us
			'@typescript-eslint/switch-exhaustiveness-check': 'error',
			'@typescript-eslint/no-unused-vars': 'off', // different from core
			'no-only-tests/no-only-tests': 'error',
			'@typescript-eslint/no-shadow': 'off', // different from core
			'no-console': 'off', // different from core

			// Todo: do we want these?
			'@typescript-eslint/array-type': 'off',
			'@typescript-eslint/ban-ts-comment': 'off',
			'@typescript-eslint/class-literal-property-style': 'off',
			'@typescript-eslint/consistent-indexed-object-style': 'off',
			'@typescript-eslint/consistent-type-definitions': 'off',
			'@typescript-eslint/dot-notation': 'off',
			'@typescript-eslint/no-base-to-string': 'off',
			'@typescript-eslint/no-empty-function': 'off',
			'@typescript-eslint/no-floating-promises': 'off',
			'@typescript-eslint/no-misused-promises': 'off',
			'@typescript-eslint/no-redundant-type-constituents': 'off',
			'@typescript-eslint/no-this-alias': 'off',
			'@typescript-eslint/no-unsafe-argument': 'off',
			'@typescript-eslint/no-unsafe-assignment': 'off',
			'@typescript-eslint/no-unsafe-call': 'off',
			'@typescript-eslint/no-unsafe-member-access': 'off',
			'@typescript-eslint/no-unused-expressions': 'off',
			'@typescript-eslint/only-throw-error': 'off',
			'@typescript-eslint/no-unsafe-return': 'off',
			'@typescript-eslint/no-unnecessary-type-assertion': 'off',
			'@typescript-eslint/prefer-nullish-coalescing': 'off',
			'@typescript-eslint/prefer-optional-chain': 'off',
			'@typescript-eslint/prefer-promise-reject-errors': 'off',
			'@typescript-eslint/prefer-string-starts-ends-with': 'off',
			'@typescript-eslint/require-await': 'off',
			'@typescript-eslint/restrict-plus-operands': 'off',
			'@typescript-eslint/restrict-template-expressions': 'off',
			'@typescript-eslint/sort-type-constituents': 'off',
			'@typescript-eslint/unbound-method': 'off',
			'@typescript-eslint/no-explicit-any': 'off',

			// Enforce separate type imports for type-only imports to avoid bundling unneeded code
			'@typescript-eslint/consistent-type-imports': [
				'error',
				{
					prefer: 'type-imports',
					fixStyle: 'separate-type-imports',
					disallowTypeAnnotations: false,
				},
			],

			// These rules enabled by the preset configs don't work well for us
			'@typescript-eslint/await-thenable': 'off',
			'prefer-const': 'off',

			// In some cases, using explicit letter-casing is more performant than the `i` flag
			'regexp/use-ignore-case': 'off',
			'regexp/prefer-regexp-exec': 'warn',
			'regexp/prefer-regexp-test': 'warn',
		},
	},
	{
		files: ['packages/**/test/*.js', 'packages/**/*.js'],
		languageOptions: {
			globals: {
				globalThis: false, // false means read-only
			},
		},
		rules: {
			'no-console': 'off',
		},
	},
];
