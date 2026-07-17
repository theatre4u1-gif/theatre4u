// Lint gate for CI. Intentionally lenient: the goal is to catch real breakage
// (undefined variables, parse errors, misused React hooks) on every push, NOT to
// flag every style nit in the existing code. Warnings do not fail CI; errors do.
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";

export default [
  { ignores: ["**/node_modules/**", "**/dist/**", "supabase/functions/**", ".vercel/**"] },
  {
    files: ["**/*.{js,jsx}"],
    plugins: { "react-hooks": reactHooks },
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: "module",
      parserOptions: { ecmaFeatures: { jsx: true } },
      // Browser + Node globals, plus the Google Picker / GAPI globals loaded from external scripts.
      globals: { ...globals.browser, ...globals.node, google: "readonly", gapi: "readonly" },
    },
    rules: {
      "no-undef": "error",
      "no-unused-vars": "off",
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn",
    },
  },
];
