module.exports = {
	root: true,
	env: {
		browser: true,
		commonjs: true,
		es6: true,
		node: true,
		jquery: false,
		jest: true,
		jasmine: true,
	},

	ignorePatterns: ['test/*', '.eslintrc.js'],
	parser: '@typescript-eslint/parser',
	extends: [
		'prettier',
	],
	parserOptions: {
		sourceType: 'module',
		ecmaVersion: '2018',
		project: 'tsconfig.json',
	},
	plugins: ['prefer-arrow', 'import', '@typescript-eslint'],
	rules: {
		// Disabled Rules
		'@typescript-eslint/explicit-function-return-type': 'off',
		'@typescript-eslint/class-name-casing': 'off',
		'@typescript-eslint/interface-name-prefix': 'off',
		'@typescript-eslint/no-explicit-any': 'off',
		'@typescript-eslint/no-parameter-properties': 'off',
		'@typescript-eslint/no-use-before-define': 'off',
		complexity: 'off',
		'no-console': 'off',
		'no-fallthrough': 'off',
		'no-invalid-this': 'off',
		'valid-typeof': 'off',
	},
};