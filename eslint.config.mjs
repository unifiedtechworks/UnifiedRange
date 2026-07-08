import nextVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";

const eslintConfig = [
  {
    ignores: [".amplify/**", "amplify_outputs.json"]
  },
  ...nextVitals,
  ...nextTypescript
];

export default eslintConfig;
