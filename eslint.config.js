import js from '@eslint/js';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: [
      '**/dist/**',
      '**/node_modules/**',
      '.claude/**',
      'mobile/.expo/**',
      'mobile/android/**',
      'mobile/ios/**',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: { globals: { ...globals.node } },
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    },
  },
  {
    // Requêtes métier par DatabaseService.asUser() seulement (ADR-0003) : aucune
    // autre connexion à la base dans l'API.
    files: ['api/src/**/*.ts'],
    ignores: ['api/src/db/database.service.ts', 'api/src/migrations/run.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            { name: 'pg', message: 'Passer par DatabaseService.asUser() (ADR-0003).' },
            {
              name: 'kysely',
              importNames: ['Kysely', 'PostgresDialect'],
              message: 'Passer par DatabaseService.asUser() (ADR-0003).',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['web/**/*.{ts,tsx}', 'mobile/**/*.{ts,tsx}'],
    languageOptions: { globals: { ...globals.browser } },
    plugins: { 'react-hooks': reactHooks },
    rules: reactHooks.configs.recommended.rules,
  },
);
