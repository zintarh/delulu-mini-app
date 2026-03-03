import type { CodegenConfig } from "@graphql-codegen/cli";
const SUBGRAPH_URL =
  process.env.NEXT_PUBLIC_SUBGRAPH_URL_MAINNET ||
  process.env.NEXT_PUBLIC_SUBGRAPH_URL ||
  "";

const config: CodegenConfig = {
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

export default config;
