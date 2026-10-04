import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    globalSetup: ["src/test/globalSetup.ts"],
    // Jalankan test file secara sekuensial agar integration tests yang berbagi
    // satu database test tidak saling mengganggu (race condition pada cleanAllTables).
    fileParallelism: false,
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      exclude: [
        "node_modules/**",
        "dist/**",
        "src/index.ts",
        "**/*.test.ts",
        "**/*.spec.ts",
      ],
    },
    include: ["src/**/*.test.ts", "src/**/*.spec.ts"],
    exclude: ["node_modules/**", "dist/**"],
  },
});
