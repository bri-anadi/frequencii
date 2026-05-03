import { ApiReference } from "@scalar/nextjs-api-reference";

export const GET = ApiReference({
  url: "/api/v1/openapi.json",
  theme: "deepSpace",
  darkMode: true,
  metaData: {
    title: "Frequencii API v1",
    description:
      "Privacy-first Solana prediction market API — interactive documentation",
  },
});
