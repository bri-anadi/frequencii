/**
 * OpenAPI 3.1.0 Specification for Frequencii API v1.
 *
 * This file defines the complete API spec served at /api/v1/openapi.json
 * and rendered by Scalar at /api/v1/docs.
 */

export function getOpenApiSpec() {
  return {
    openapi: "3.1.0",
    info: {
      title: "Frequencii API",
      version: "1.0.0",
      description:
        "Privacy-first Solana prediction market API. Browse markets, trade, interact with the AI agent, and manage your profile — all authenticated via Solana wallet signatures.",
      contact: {
        name: "Frequencii",
        url: "https://frequencii.world",
      },
      license: {
        name: "MIT",
      },
    },
    servers: [
      { url: "http://localhost:3000", description: "Development" },
      { url: "https://frequencii.world", description: "Production" },
    ],
    tags: [
      { name: "Auth", description: "JWT authentication via Solana wallet signatures" },
      { name: "Markets", description: "Prediction market browsing and discovery" },
      { name: "Trade", description: "Build and submit trade transactions" },
      { name: "Positions", description: "Track open and resolved positions" },
      { name: "Agent", description: "AI prediction market analyst (SSE streaming)" },
      { name: "User", description: "User profile management" },
      { name: "Push Notifications", description: "FCM push token registration" },
      { name: "Watchlist", description: "Market watchlist management" },
      { name: "Seeker", description: "Solana Seeker device and Genesis Token verification" },
    ],

    // ========== Security Schemes ==========
    components: {
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT",
          description:
            "JWT obtained from POST /api/v1/auth/login. Include as `Authorization: Bearer <token>`.",
        },
      },
      schemas: {
        Error: {
          type: "object",
          properties: {
            error: { type: "string", description: "Error message" },
            details: { type: "string", description: "Additional error details" },
          },
          required: ["error"],
        },

        // ---- Auth ----
        LoginRequest: {
          type: "object",
          properties: {
            pubkey: { type: "string", description: "Solana wallet public key (base58)" },
            signature: { type: "string", description: "Signed message (base58)" },
            message: { type: "string", description: "The message that was signed, e.g. 'Frequencii Auth: 1714000000'" },
          },
          required: ["pubkey", "signature", "message"],
        },
        LoginResponse: {
          type: "object",
          properties: {
            token: { type: "string", description: "JWT access token" },
            expiresAt: { type: "integer", description: "Token expiry (unix timestamp)" },
            user: { $ref: "#/components/schemas/UserProfile" },
          },
        },
        RefreshResponse: {
          type: "object",
          properties: {
            token: { type: "string" },
            expiresAt: { type: "integer" },
          },
        },

        // ---- Markets ----
        PredictionMarket: {
          type: "object",
          properties: {
            id: { type: "string" },
            question: { type: "string" },
            slug: { type: "string" },
            outcomes: { type: "array", items: { type: "string" } },
            outcomePrices: { type: "array", items: { type: "number" } },
            volume: { type: "number", description: "Total volume in USD" },
            endDate: { type: "string", format: "date-time" },
            startDate: { type: "string", format: "date-time" },
            active: { type: "boolean" },
            closed: { type: "boolean" },
            image: { type: "string", format: "uri" },
            description: { type: "string" },
            category: { type: "string" },
            lastTradePrice: { type: "number" },
            oneDayPriceChange: { type: "number" },
          },
        },
        PredictionEvent: {
          type: "object",
          properties: {
            id: { type: "string" },
            title: { type: "string" },
            slug: { type: "string" },
            description: { type: "string" },
            category: { type: "string" },
            image: { type: "string", format: "uri" },
            volume: { type: "number" },
            active: { type: "boolean" },
            closed: { type: "boolean" },
            startDate: { type: "string" },
            endDate: { type: "string" },
            volume24hr: { type: "number" },
            markets: {
              type: "array",
              items: { $ref: "#/components/schemas/PredictionMarket" },
            },
          },
        },
        MarketsListResponse: {
          type: "object",
          properties: {
            events: {
              type: "array",
              items: { $ref: "#/components/schemas/PredictionEvent" },
            },
            total: { type: "integer" },
            hasMore: { type: "boolean" },
          },
        },
        MarketDetailResponse: {
          type: "object",
          properties: {
            event: { $ref: "#/components/schemas/PredictionEvent" },
          },
        },

        // ---- Trade ----
        TradeRequest: {
          type: "object",
          properties: {
            marketId: { type: "string" },
            outcome: { type: "string", enum: ["YES", "NO"] },
            amount: { type: "number", description: "Amount in USDC" },
            walletPubkey: { type: "string", description: "Burner wallet public key" },
          },
          required: ["marketId", "outcome", "amount", "walletPubkey"],
        },
        TradeResponse: {
          type: "object",
          properties: {
            transaction: { type: "string", description: "Base64-encoded serialized transaction" },
          },
        },

        // ---- Positions ----
        Position: {
          type: "object",
          properties: {
            marketId: { type: "string" },
            marketTitle: { type: "string" },
            outcome: { type: "string", enum: ["YES", "NO"] },
            entryPrice: { type: "number" },
            currentPrice: { type: "number" },
            amount: { type: "number" },
            pnl: { type: "number" },
            pnlPercent: { type: "number" },
            resolved: { type: "boolean" },
            claimable: { type: "boolean" },
          },
        },

        // ---- Agent ----
        AgentChatRequest: {
          type: "object",
          properties: {
            message: { type: "string", description: "User message to the AI agent" },
            marketContext: {
              $ref: "#/components/schemas/PredictionEvent",
              description: "Optional: current market being viewed",
            },
            trendingMarkets: {
              type: "array",
              items: { $ref: "#/components/schemas/PredictionEvent" },
              description: "Optional: trending markets for context",
            },
            history: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  role: { type: "string", enum: ["user", "agent"] },
                  content: { type: "string" },
                },
              },
              description: "Conversation history (last 10 messages)",
            },
          },
          required: ["message"],
        },
        AgentStreamChunk: {
          type: "object",
          properties: {
            content: { type: "string", description: "Partial content chunk" },
            done: { type: "boolean", description: "Whether this is the final chunk" },
          },
        },

        // ---- User ----
        UserProfile: {
          type: "object",
          properties: {
            pubkey: { type: "string" },
            displayName: { type: "string" },
            avatar: { type: "string" },
            createdAt: { type: "string", format: "date-time" },
          },
        },
        UpdateProfileRequest: {
          type: "object",
          properties: {
            displayName: { type: "string" },
            avatar: { type: "string" },
          },
        },

        // ---- Push Tokens ----
        PushTokenRequest: {
          type: "object",
          properties: {
            token: { type: "string", description: "FCM push token" },
            platform: { type: "string", enum: ["android", "ios"] },
          },
          required: ["token", "platform"],
        },
        RemovePushTokenRequest: {
          type: "object",
          properties: {
            token: { type: "string" },
          },
          required: ["token"],
        },

        // ---- Watchlist ----
        WatchlistItem: {
          type: "object",
          properties: {
            eventId: { type: "string" },
            addedAt: { type: "string", format: "date-time" },
          },
        },
        WatchlistResponse: {
          type: "object",
          properties: {
            items: {
              type: "array",
              items: { $ref: "#/components/schemas/WatchlistItem" },
            },
          },
        },
        SeekerVerificationResponse: {
          type: "object",
          properties: {
            hasGenesisToken: { type: "boolean" },
            genesisTokenMint: { type: ["string", "null"] },
          },
          required: ["hasGenesisToken", "genesisTokenMint"],
        },
      },
    },

    // ========== Paths ==========
    paths: {
      // ---- Auth ----
      "/api/v1/auth/login": {
        post: {
          tags: ["Auth"],
          summary: "Login with wallet signature",
          description:
            "Authenticate by signing a message with your Solana wallet. Returns a JWT token valid for 7 days.",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/LoginRequest" },
              },
            },
          },
          responses: {
            "200": {
              description: "Successfully authenticated",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/LoginResponse" },
                },
              },
            },
            "401": {
              description: "Invalid signature",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/Error" },
                },
              },
            },
          },
        },
      },
      "/api/v1/auth/refresh": {
        post: {
          tags: ["Auth"],
          summary: "Refresh JWT token",
          security: [{ bearerAuth: [] }],
          responses: {
            "200": {
              description: "New token issued",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/RefreshResponse" },
                },
              },
            },
            "401": {
              description: "Invalid or expired token",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/Error" },
                },
              },
            },
          },
        },
      },

      // ---- Markets ----
      "/api/v1/markets": {
        get: {
          tags: ["Markets"],
          summary: "List prediction markets",
          description: "Browse prediction events with optional category filter and search.",
          security: [{ bearerAuth: [] }],
          parameters: [
            { name: "category", in: "query", schema: { type: "string", enum: ["All", "crypto", "politics", "sports", "economics", "mentions", "culture"] }, description: "Filter by category" },
            { name: "search", in: "query", schema: { type: "string" }, description: "Search query" },
            { name: "limit", in: "query", schema: { type: "integer", default: 20 }, description: "Max results" },
            { name: "offset", in: "query", schema: { type: "integer", default: 0 }, description: "Pagination offset" },
          ],
          responses: {
            "200": {
              description: "Market list",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/MarketsListResponse" },
                },
              },
            },
          },
        },
      },
      "/api/v1/markets/{id}": {
        get: {
          tags: ["Markets"],
          summary: "Get market detail",
          description: "Fetch a single prediction event by its ID.",
          security: [{ bearerAuth: [] }],
          parameters: [
            { name: "id", in: "path", required: true, schema: { type: "string" }, description: "Event ID" },
          ],
          responses: {
            "200": {
              description: "Event detail",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/MarketDetailResponse" },
                },
              },
            },
            "404": {
              description: "Event not found",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/Error" },
                },
              },
            },
          },
        },
      },

      // ---- Trade ----
      "/api/v1/trade": {
        post: {
          tags: ["Trade"],
          summary: "Build trade transaction",
          description: "Build a serialized Solana transaction for a market trade. The client must sign and submit.",
          security: [{ bearerAuth: [] }],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/TradeRequest" },
              },
            },
          },
          responses: {
            "200": {
              description: "Serialized transaction",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/TradeResponse" },
                },
              },
            },
            "400": {
              description: "Missing or invalid fields",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/Error" },
                },
              },
            },
          },
        },
      },

      // ---- Positions ----
      "/api/v1/positions": {
        get: {
          tags: ["Positions"],
          summary: "List user positions",
          security: [{ bearerAuth: [] }],
          parameters: [
            { name: "walletPubkey", in: "query", required: true, schema: { type: "string" }, description: "Wallet public key" },
          ],
          responses: {
            "200": {
              description: "Position list",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      positions: { type: "array", items: { $ref: "#/components/schemas/Position" } },
                    },
                  },
                },
              },
            },
          },
        },
      },
      "/api/v1/positions/{id}/claim": {
        post: {
          tags: ["Positions"],
          summary: "Claim payout",
          description: "Build a claim transaction for a resolved position.",
          security: [{ bearerAuth: [] }],
          parameters: [
            { name: "id", in: "path", required: true, schema: { type: "string" }, description: "Position ID" },
          ],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    walletPubkey: { type: "string" },
                  },
                  required: ["walletPubkey"],
                },
              },
            },
          },
          responses: {
            "200": {
              description: "Claim transaction",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/TradeResponse" },
                },
              },
            },
          },
        },
      },

      // ---- Agent ----
      "/api/v1/agent/chat": {
        post: {
          tags: ["Agent"],
          summary: "AI market analyst (SSE streaming)",
          description:
            "Send a message to the Frequencii AI agent. Returns a Server-Sent Events stream with partial content chunks.",
          security: [{ bearerAuth: [] }],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/AgentChatRequest" },
              },
            },
          },
          responses: {
            "200": {
              description: "SSE stream of content chunks",
              content: {
                "text/event-stream": {
                  schema: {
                    type: "string",
                    description: "Each line: `data: {\"content\": \"...\", \"done\": false}`",
                  },
                },
              },
            },
          },
        },
      },

      // ---- User ----
      "/api/v1/user/profile": {
        get: {
          tags: ["User"],
          summary: "Get user profile",
          security: [{ bearerAuth: [] }],
          responses: {
            "200": {
              description: "User profile",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/UserProfile" },
                },
              },
            },
          },
        },
        put: {
          tags: ["User"],
          summary: "Update user profile",
          security: [{ bearerAuth: [] }],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/UpdateProfileRequest" },
              },
            },
          },
          responses: {
            "200": {
              description: "Updated profile",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      updated: { type: "boolean" },
                      user: { $ref: "#/components/schemas/UserProfile" },
                    },
                  },
                },
              },
            },
          },
        },
      },

      // ---- Push Notifications ----
      "/api/v1/user/push-token": {
        post: {
          tags: ["Push Notifications"],
          summary: "Register push token",
          security: [{ bearerAuth: [] }],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/PushTokenRequest" },
              },
            },
          },
          responses: {
            "200": {
              description: "Token registered",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: { registered: { type: "boolean" } },
                  },
                },
              },
            },
          },
        },
        delete: {
          tags: ["Push Notifications"],
          summary: "Unregister push token",
          security: [{ bearerAuth: [] }],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/RemovePushTokenRequest" },
              },
            },
          },
          responses: {
            "200": {
              description: "Token removed",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: { removed: { type: "boolean" } },
                  },
                },
              },
            },
          },
        },
      },

      // ---- Watchlist ----
      "/api/v1/watchlist": {
        get: {
          tags: ["Watchlist"],
          summary: "Get watchlist",
          security: [{ bearerAuth: [] }],
          responses: {
            "200": {
              description: "Watchlist items",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/WatchlistResponse" },
                },
              },
            },
          },
        },
      },
      "/api/v1/watchlist/{eventId}": {
        post: {
          tags: ["Watchlist"],
          summary: "Add to watchlist",
          security: [{ bearerAuth: [] }],
          parameters: [
            { name: "eventId", in: "path", required: true, schema: { type: "string" } },
          ],
          responses: {
            "200": {
              description: "Added",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: { added: { type: "boolean" } },
                  },
                },
              },
            },
          },
        },
        delete: {
          tags: ["Watchlist"],
          summary: "Remove from watchlist",
          security: [{ bearerAuth: [] }],
          parameters: [
            { name: "eventId", in: "path", required: true, schema: { type: "string" } },
          ],
          responses: {
            "200": {
              description: "Removed",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: { removed: { type: "boolean" } },
                  },
                },
              },
            },
          },
        },
      },
      "/api/v1/seeker/verify": {
        get: {
          tags: ["Seeker"],
          summary: "Verify Seeker Genesis Token ownership",
          description:
            "Checks whether the authenticated wallet owns a valid Solana Seeker Genesis Token. Device model detection should only be used for UI hints.",
          security: [{ bearerAuth: [] }],
          responses: {
            "200": {
              description: "Seeker verification result",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/SeekerVerificationResponse" },
                },
              },
            },
            "401": {
              description: "Missing or invalid JWT",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/Error" },
                },
              },
            },
          },
        },
      },
    },
  };
}
