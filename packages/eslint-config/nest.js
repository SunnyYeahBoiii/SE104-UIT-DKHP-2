import prettier from 'eslint-config-prettier/flat'
import { defineConfig } from 'eslint/config'
import globals from 'globals'
import tseslint from 'typescript-eslint'

import { baseConfig } from './base.js'

/**
 * Config for the NestJS API. Type-aware rules need the app's tsconfig, so the caller passes its
 * own directory as `tsconfigRootDir`.
 *
 * `consistent-type-imports` is deliberately off: rewriting an injected class to `import type`
 * erases it from `emitDecoratorMetadata` output and breaks Nest's dependency injection at runtime.
 */
export function nestConfig(tsconfigRootDir) {
  return defineConfig([
    ...baseConfig,
    tseslint.configs.recommendedTypeChecked,
    {
      languageOptions: {
        globals: { ...globals.node, Bun: 'readonly' },
        parserOptions: {
          projectService: { allowDefaultProject: ['*.js'] },
          tsconfigRootDir,
        },
      },
      rules: {
        '@typescript-eslint/no-extraneous-class': 'off',
        '@typescript-eslint/no-floating-promises': 'error',
        '@typescript-eslint/consistent-type-imports': 'off',
      },
    },
    {
      files: ['**/*.js', '**/*.mjs'],
      extends: [tseslint.configs.disableTypeChecked],
    },
    prettier,
  ])
}

export default nestConfig
