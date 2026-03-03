// CommonJS GraphQL Codegen config to avoid TS/ESM loading browser-only deps in Node
// and to use the same subgraph URL as the app, loaded from .env.local / .env.

// Load environment variables from this app's .env.local first, then .env.
const path = require("path");
const dotenv = require("dotenv");

// 1) Explicitly load apps/web/.env.local
dotenv.config({ path: path.resolve(__dirname, ".env.local") });
// 2) Fallback to apps/web/.env if present
dotenv.config();

const SUBGRAPH_URL =
  process.env.NEXT_PUBLIC_SUBGRAPH_URL_MAINNET ||
  process.env.NEXT_PUBLIC_SUBGRAPH_URL;

if (!SUBGRAPH_URL) {
  throw new Error(
    "GraphQL Codegen: SUBGRAPH_URL is empty. Set NEXT_PUBLIC_SUBGRAPH_URL_MAINNET or NEXT_PUBLIC_SUBGRAPH_URL in apps/web/.env.local or apps/web/.env."
  );
}

/** @type {import("@graphql-codegen/cli").CodegenConfig} */
const config = {
  // Use deployed subgraph schema (same URL the app uses)
  schema: [SUBGRAPH_URL],

  // Scan all .graphql files in src/graphql/
  documents: "src/graphql/**/*.graphql",

  generates: {
    // Output directory with all types + typed document nodes
    "src/generated/": {
      plugins: [],
      preset: "client",
      presetConfig: {
        // Generate fragments as separate exports for reuse
        fragmentMasking: false,
      },
      config: {
        // Use the exact scalar types from The Graph
        scalars: {
          BigInt: "string",
          BigDecimal: "string",
          Bytes: "string",
          Int8: "number",
        },
        // Generate enum values as TypeScript string unions
        enumsAsTypes: true,
        // Skip __typename in generated types (cleaner)
        skipTypename: true,
      },
    },
  },

  // Silence the "no documents" warning during initial setup
  ignoreNoDocuments: false,
};

module.exports = config;

