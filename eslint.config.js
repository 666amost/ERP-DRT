import js from '@eslint/js';
import tsParser from '@typescript-eslint/parser';
import tsPlugin from '@typescript-eslint/eslint-plugin';
import vue from 'eslint-plugin-vue';
import globals from 'globals';

export default [
  js.configs.recommended,
  ...vue.configs['flat/recommended'],
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      parser: tsParser,
      ecmaVersion: 2023,
      sourceType: 'module',
      globals: { ...globals.browser, ...globals.node }
    },
    plugins: { '@typescript-eslint': tsPlugin },
    rules: {
      '@typescript-eslint/no-explicit-any': 'error'
    }
  },
  {
    files: ['test/**/*.ts', 'test/**/*.tsx'],
    rules: {
      // Test files often use `any` for mocks/stubs; relax this rule for tests
      '@typescript-eslint/no-explicit-any': 'off'
    }
  },
  {
    files: ['api/**/*.ts'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off'
    }
  },
  {
    files: ['lib/**/*.ts', 'lib/**/*.js'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off'
    }
  },
  {
    files: ['**/*.vue'],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'module',
      globals: { ...globals.browser, ...globals.node },
      parserOptions: { parser: tsParser }
    },
    plugins: { '@typescript-eslint': tsPlugin },
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      'vue/multi-word-component-names': 'off'
      ,
      // Workflow: turn off strict template formatting rules - we prefer Prettier or IDE formatting
      'vue/html-indent': 'off',
      'vue/max-attributes-per-line': 'off',
      'vue/singleline-html-element-content-newline': 'off',
      'vue/html-self-closing': 'off',
      'vue/attributes-order': 'off'
    }
  },
  {
    ignores: ['dist/**', 'design-dashboard-figma/**', '*.cjs', 'dev/**', 'scripts/**', 'dev-server.js']
  }
];
