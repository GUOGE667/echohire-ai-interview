import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "components/**",
    "db/**",
    "drizzle/**",
    "examples/**",
    "hooks/**",
    "scripts/**",
    "tests/**",
    "vendor/**",
    "worker/**",
    "app/chatgpt-auth.ts",
    "lib/utils.ts",
    "cloudflare-env.d.ts",
    "drizzle.config.ts",
    "vite.config.ts",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
