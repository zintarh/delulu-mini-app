import type { CodegenConfig } from "@graphql-codegen/cli";
import path from "path";

const SUBGRAPH_URL =
  process.env.NEXT_PUBLIC_SUBGRAPH_URL ||
  "https://api.studio.thegraph.com/query/1741533/delulu-prediction-market/0.01";

// Use local schema during dev (has token field); fallback to remote after subgraph redeploy
const LOCAL_SCHEMA = path.join(
  __dirname,
  "../delulu-subgraph/schema.graphql"
);

const config: CodegenConfig = {
  // Prefer local schema (includes token) until subgraph is redeployed
  schema: [LOCAL_SCHEMA, SUBGRAPH_URL],

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

export default config;
