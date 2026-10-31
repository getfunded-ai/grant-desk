import { defineConfig } from "vitest/config";

// Only the tests the testing policy allows live under tests/ (sign-in, money, RLS,
// migrations, deletion, escaped bugs). pr-checks runs them when those folders change;
// weekly-tests runs everything once a week.
export default defineConfig({
  test: {
    include: ["tests/**/*.test.ts"],
    environment: "node",
  },
});
