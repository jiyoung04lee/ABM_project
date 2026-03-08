import { globalIgnores } from "eslint/config";
import nextPlugin from "@next/eslint-plugin-next";

export default [
  globalIgnores([".next/**", "out/**", "build/**", "next-env.d.ts", "node_modules/**"]),
  nextPlugin.flatConfig.coreWebVitals,
];
