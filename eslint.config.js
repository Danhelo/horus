import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import prettier from 'eslint-config-prettier';
import globals from 'globals';

export default tseslint.config(
  // Global ignores
  {
    ignores: [
      '**/dist/**',
      '**/node_modules/**',
      '**/coverage/**',
      '**/.turbo/**',
      '**/public/**',
      '**/*.min.js',
      '**/drizzle/**',
      // Config files outside tsconfig
      '**/*.config.ts',
      '**/*.config.js',
      '**/e2e/**',
    ],
  },

  // Base JS config
  js.configs.recommended,

  // TypeScript config for all packages
  ...tseslint.configs.recommended,

  // Shared config for all TypeScript files
  {
    files: ['**/*.ts', '**/*.tsx'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
        },
      ],
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/consistent-type-imports': [
        'error',
        {
          prefer: 'type-imports',
          fixStyle: 'inline-type-imports',
          disallowTypeAnnotations: false,
        },
      ],
      '@typescript-eslint/no-import-type-side-effects': 'error',
    },
  },

  // React config for frontend
  {
    files: ['packages/frontend/**/*.tsx', 'packages/frontend/**/*.ts'],
    plugins: {
      react,
      'react-hooks': reactHooks,
    },
    languageOptions: {
      globals: {
        ...globals.browser,
      },
      parserOptions: {
        ecmaFeatures: {
          jsx: true,
        },
      },
    },
    settings: {
      react: {
        version: '18.3',
      },
    },
    rules: {
      ...react.configs.recommended.rules,
      ...react.configs['jsx-runtime'].rules,
      ...reactHooks.configs.recommended.rules,
      'react/prop-types': 'off',
      // R3F uses many custom JSX properties
      'react/no-unknown-property': [
        'error',
        {
          ignore: [
            'args',
            'object',
            'attach',
            'dispose',
            'position',
            'rotation',
            'scale',
            'intensity',
            'castShadow',
            'receiveShadow',
            'geometry',
            'material',
            'transparent',
            'opacity',
            'color',
            'fog',
            'near',
            'far',
            'vertexColors',
            'linewidth',
            'depthTest',
            'depthWrite',
            'toneMapped',
            'side',
            'frustumCulled',
            'visible',
            'count',
            'map',
            'alphaMap',
            'envMap',
            'normalMap',
          ],
        },
      ],
    },
  },

  // Backend/shared config (Node.js)
  {
    files: ['packages/backend/**/*.ts', 'packages/shared/**/*.ts'],
    languageOptions: {
      globals: {
        ...globals.node,
      },
    },
  },

  // Test files - more permissive
  {
    files: [
      '**/*.test.ts',
      '**/*.test.tsx',
      '**/*.spec.ts',
      '**/*.spec.tsx',
      '**/__tests__/**/*.ts',
      '**/__tests__/**/*.tsx',
    ],
    languageOptions: {
      globals: {
        ...globals.node,
      },
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': 'off',
    },
  },

  // Disable formatting rules (handled by Prettier)
  prettier
);
