import js from "@eslint/js";
import reactHooks from "eslint-plugin-react-hooks";
import globals from "globals";
import tseslint from "typescript-eslint";

export default tseslint.config(
  // PROTOTYPE branch only: throwaway prototype folders and generated shadcn/ui files skip lint.
  {
    ignores: [
      "dist",
      "src/api/schema.ts",
      "src/components/ui/**",
      "src/features/**/prototype*/**",
      "src/lib/**",
      "src/hooks/**",
      "src/features/core/PrototypeSwitcher.tsx",
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.strictTypeChecked,
  ...tseslint.configs.stylisticTypeChecked,
  {
    languageOptions: {
      globals: globals.browser,
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
    },
    plugins: { "react-hooks": reactHooks },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "max-lines": ["error", { max: 300, skipBlankLines: true, skipComments: true }],
      complexity: ["error", 10],
      "max-depth": ["error", 4],
    },
  },
  {
    files: ["**/*.test.ts", "**/*.test.tsx"],
    rules: { "max-lines": ["error", { max: 500, skipBlankLines: true, skipComments: true }] },
  },
  { files: ["eslint.config.js"], ...tseslint.configs.disableTypeChecked },
);
