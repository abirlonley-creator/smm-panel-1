import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const spec = {
    openapi: "3.0.0",
    info: {
      title: "Aura SMM Universal Engagement API",
      version: "2.0.0",
      description:
        "Standard Universal REST API for Aura SMM TikTok Engagement Campaigns. Enables AI assistants (Muse, ChatGPT, Gemini, Claude) and developers to list engagement packages (2k, 5k, 10k, 15k), check balance, place orders with dynamic organic batch shuffling, and track multi-wave delivery progress.",
      contact: {
        name: "Aura SMM Support",
        url: "https://t.me/Ghostfinds",
      },
    },
    servers: [
      {
        url: "https://smm-panel-1.vercel.app/api/v2",
        description: "Production API v2 Server",
      },
    ],
    components: {
      securitySchemes: {
        BearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "aura_live_...",
          description: "Enter your Aura SMM API Key (starts with aura_live_)",
        },
        ApiKeyAuth: {
          type: "apiKey",
          in: "header",
          name: "X-API-Key",
          description: "Alternative header for API Key authentication",
        },
      },
      schemas: {
        EngagementService: {
          type: "object",
          properties: {
            service: { type: "integer", example: 101 },
            alias: { type: "string", example: "2k" },
            category: { type: "string", example: "TikTok Engagement" },
            name: { type: "string", example: "2k" },
            display_name: { type: "string", example: "TikTok Engagement 2K" },
            platform: { type: "string", example: "tiktok" },
            type: { type: "string", example: "engagement_campaign" },
            rate: { type: "string", example: "16.91" },
            min: { type: "integer", example: 2000 },
            max: { type: "integer", example: 2000 },
            duration: { type: "string", example: "5 Hours" },
            target_views: { type: "integer", example: 2960 },
            target_likes: { type: "integer", example: 42 },
            target_saves: { type: "integer", example: 0 },
            target_shares: { type: "integer", example: 0 },
            shuffle_supported: { type: "boolean", example: true },
            description: {
              type: "string",
              example: "Organic 5-hour pacing with 16 randomized view batches and 3 synchronized like waves. Dynamic shuffle supported.",
            },
            status: { type: "string", enum: ["active", "inactive"], example: "active" },
          },
        },
        BalanceResponse: {
          type: "object",
          properties: {
            balance: { type: "string", example: "206.12" },
            currency: { type: "string", example: "INR" },
          },
        },
        OrderRequest: {
          type: "object",
          required: ["service", "link"],
          properties: {
            service: {
              type: "string",
              description: "Package tier name ('2k', '5k', '10k', '15k') or numeric service ID (101, 102, 103, 104)",
              example: "2k",
            },
            link: {
              type: "string",
              format: "uri",
              description: "Public TikTok video URL",
              example: "https://www.tiktok.com/@username/video/7708743540372671752",
            },
            quantity: {
              type: "integer",
              description: "Optional quantity corresponding to the tier (2000, 5000, 10000, 15000)",
              example: 2000,
            },
            shuffle: {
              type: "boolean",
              description: "Whether to generate unique randomized organic batch variance (defaults to true)",
              example: true,
            },
          },
        },
        OrderResponse: {
          type: "object",
          properties: {
            order: { type: "integer", example: 836239 },
            order_ref: { type: "string", example: "ENG-836239" },
            service: { type: "integer", example: 101 },
            preset: { type: "string", example: "2k" },
            name: { type: "string", example: "2k" },
            link: { type: "string", example: "https://www.tiktok.com/@username/video/..." },
            target_views: { type: "integer", example: 2960 },
            target_likes: { type: "integer", example: 42 },
            batches: { type: "integer", example: 16 },
            duration: { type: "string", example: "5 Hours" },
            charge: { type: "string", example: "16.91" },
            currency: { type: "string", example: "INR" },
            status: { type: "string", example: "processing" },
          },
        },
        OrderStatusResponse: {
          type: "object",
          properties: {
            order: { type: "integer", example: 836239 },
            order_ref: { type: "string", example: "ENG-836239" },
            service: { type: "integer", example: 101 },
            preset: { type: "string", example: "2k" },
            name: { type: "string", example: "2k" },
            link: { type: "string", example: "https://www.tiktok.com/@username/video/..." },
            status: {
              type: "string",
              enum: ["pending", "in_progress", "completed", "cancelled", "failed"],
              example: "in_progress",
            },
            duration_hours: { type: "integer", example: 5 },
            planned_views: { type: "integer", example: 2960 },
            delivered_views: { type: "integer", example: 184 },
            planned_likes: { type: "integer", example: 42 },
            delivered_likes: { type: "integer", example: 12 },
            remains: { type: "integer", example: 2776 },
            total_batches: { type: "integer", example: 16 },
            completed_batches: { type: "integer", example: 1 },
            charge: { type: "string", example: "16.91" },
            currency: { type: "string", example: "INR" },
            created_at: { type: "string", format: "date-time" },
          },
        },
        ErrorResponse: {
          type: "object",
          properties: {
            error: { type: "string", example: "Invalid or inactive API key" },
          },
        },
      },
    },
    security: [
      { BearerAuth: [] },
      { ApiKeyAuth: [] },
    ],
    paths: {
      "/services": {
        get: {
          summary: "List Engagement Packages",
          description: "Returns the 4 active TikTok Engagement packages (2k, 5k, 10k, 15k) with targets, durations, and rates.",
          responses: {
            "200": {
              description: "Array of available engagement packages",
              content: {
                "application/json": {
                  schema: {
                    type: "array",
                    items: { $ref: "#/components/schemas/EngagementService" },
                  },
                },
              },
            },
            "401": {
              description: "Missing or invalid API key",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/ErrorResponse" },
                },
              },
            },
          },
        },
      },
      "/balance": {
        get: {
          summary: "Check Account Balance",
          description: "Returns the current authenticated user's wallet balance.",
          responses: {
            "200": {
              description: "Balance information",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/BalanceResponse" },
                },
              },
            },
            "401": {
              description: "Unauthorized",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/ErrorResponse" },
                },
              },
            },
          },
        },
      },
      "/orders": {
        post: {
          summary: "Place Engagement Campaign Order",
          description: "Places a multi-batch organic TikTok engagement order (2k, 5k, 10k, or 15k) with dynamic batch shuffling.",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/OrderRequest" },
              },
            },
          },
          responses: {
            "200": {
              description: "Order placed successfully",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/OrderResponse" },
                },
              },
            },
            "400": {
              description: "Invalid input or insufficient funds",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/ErrorResponse" },
                },
              },
            },
            "403": {
              description: "API key does not have order permission",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/ErrorResponse" },
                },
              },
            },
          },
        },
      },
      "/orders/{id}": {
        get: {
          summary: "Get Engagement Order Status",
          description: "Returns live delivery progress, delivered counts, and remaining amounts for a campaign.",
          parameters: [
            {
              name: "id",
              in: "path",
              required: true,
              description: "Order ID (e.g. 836239 or ENG-836239)",
              schema: { type: "string" },
            },
          ],
          responses: {
            "200": {
              description: "Order tracking status",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/OrderStatusResponse" },
                },
              },
            },
            "404": {
              description: "Order not found",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/ErrorResponse" },
                },
              },
            },
          },
        },
      },
    },
  };

  return NextResponse.json(spec, {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "public, max-age=300",
    },
  });
}
