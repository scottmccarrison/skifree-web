export default [
  {
    files: ["js/**/*.js", "worker/src/**/*.js"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
      globals: {
        // Browser globals
        window: "readonly",
        document: "readonly",
        localStorage: "readonly",
        performance: "readonly",
        requestAnimationFrame: "readonly",
        setTimeout: "readonly",
        setInterval: "readonly",
        clearInterval: "readonly",
        console: "readonly",
        fetch: "readonly",
        Response: "readonly",
        Request: "readonly",
        URL: "readonly",
        WebSocket: "readonly",
        WebSocketPair: "readonly",
        crypto: "readonly",
        HTMLElement: "readonly",
        Event: "readonly",
        navigator: "readonly",
        location: "readonly",
        structuredClone: "readonly",
      },
    },
    rules: {
      // Catch real bugs
      "no-undef": "error",
      "no-unused-vars": ["warn", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
      "no-unreachable": "error",
      "no-fallthrough": "error",
      "no-duplicate-case": "error",
      "no-dupe-keys": "error",
      "no-dupe-args": "error",
      "no-self-assign": "error",
      "no-self-compare": "error",
      "no-constant-condition": "warn",
      "no-loss-of-precision": "error",
      "use-isnan": "error",
      "valid-typeof": "error",
      "eqeqeq": ["error", "smart"],
      "no-implicit-coercion": ["warn", { allow: ["!!"] }],
      "consistent-return": "warn",
      "no-constructor-return": "error",
      "no-promise-executor-return": "error",

      // State machine safety
      "default-case": "warn",
      "no-case-declarations": "error",

      // Avoid accidental globals
      "no-var": "error",
      "no-shadow": "warn",
    },
  },
  {
    // Worker-specific: Cloudflare Durable Objects have different globals
    files: ["worker/src/**/*.js"],
    languageOptions: {
      globals: {
        WebSocketPair: "readonly",
      },
    },
  },
  {
    ignores: ["node_modules/**", "wrangler.jsonc"],
  },
];
