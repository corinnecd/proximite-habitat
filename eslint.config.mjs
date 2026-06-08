import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
  {
    rules: {
      // Conseils de performance du React Compiler (eslint-plugin-react-hooks v6).
      // Déclenchés par des patterns volontaires de ce projet (fetch au montage,
      // synchronisation d'état de formulaire). Conservés en `warn` : visibles
      // sans bloquer le lint, à résorber progressivement (ex. migration vers
      // une couche de data fetching type React Query).
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/preserve-manual-memoization": "warn",
      "react-hooks/immutability": "warn",
      // Pattern idiomatique d'omission de champs : `const { a, b, ...rest } = obj`.
      "@typescript-eslint/no-unused-vars": [
        "error",
        { ignoreRestSiblings: true, argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
    },
  },
]);

export default eslintConfig;
