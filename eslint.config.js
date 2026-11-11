import tseslint from "typescript-eslint";
export default tseslint.config(
  { ignores: ["dist/**"] },
  ...tseslint.configs.recommendedTypeChecked.map(config => ({ ...config, files: ["src/**/*.ts", "src/**/*.tsx"] })),
  { files: ["src/**/*.ts", "src/**/*.tsx"], languageOptions: { parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname } } },
);
