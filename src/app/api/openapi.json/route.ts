import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const spec = {
    openapi: "3.0.0",
    info: {
      title: "Aura SMM Universal API",
      version: "2.0.0",
      description:
        "Standard Universal REST API for Aura SMM. Enables AI assistants (Muse, ChatGPT, Gemini, Claude) and automated clients to list live engagement services, check balance, place orders, and track order execution seamlessly.",
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
        Service: {
          type: "object",
          properties: {
            service: { type: "integer", example: 101 },
            category: { type: "string", example: "Engagement" },
            name: { type: "string", example: "TikTok Views" },
            platform: { type: "string", example: "tiktok" },
            type: { type: "string", example: "views" },
            rate: { type: "string", example: "5.70" },
            min: { type: "integer", example: 100 },
            max: { type: "integer", example: 10000000 },
            description: { type: "string", example: "Organic views for TikTok videos" },
            status: { type: "string", enum: ["active", "inactive"], example: "active" },
          },
        },
        BalanceResponse: {
          type: "object",
          properties: {
            balance: { type: "string", example: "125.50" },
            currency: { type: "string", example: "USD" },
          },
        },
        OrderRequest: {
          type: "object",
          required: ["service", "link", "quantity"],
          properties: {
            service: { type: "integer", example: 101 },
            link: { type: "string", format: "uri", example: "https://www.tiktok.com/@user/video/123" },
            quantity: { type: "integer", example: 2000 },
          },
        },
        OrderResponse: {
          type: "object",
          properties: {
            order: { type: "integer", example: 98765 },
            charge: { type: "string", example: "1.50" },
            currency: { type: "string", example: "USD" },
            status: { type: "string", example: "processing" },
          },
        },
        OrderStatusResponse: {
          type: "object",
          properties: {
            order: { type: "integer", example: 98765 },
            service: { type: "integer", example: 101 },
            link: { type: "string", example: "https://www.tiktok.com/@user/video/123" },
            quantity: { type: "integer", example: 2000 },
            status: {
              type: "string",
              enum: ["pending", "in_progress", "completed", "cancelled", "failed"],
              example: "in_progress",
            },
            start_count: { type: "integer", example: 0 },
            remains: { type: "integer", example: 1500 },
            charge: { type: "string", example: "1.50" },
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
    security: [{ BearerAuth: [] }, { ApiKeyAuth: [] }],
    paths: {
      "/services": {
        get: {
          summary: "List all active services",
          description: "Returns every active service currently available in the Engagement Tab.",
          responses: {
            "200": {
              description: "List of active services",
              content: {
                "application/json": {
                  schema: {
                    type: "array",
                    items: { $ref: "#/components/schemas/Service" },
                  },
                },
              },
            },
            "401": {
              description: "Unauthorized",
              content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } },
            },
          },
        },
      },
      "/balance": {
        get: {
          summary: "Check account wallet balance",
          description: "Returns the available balance and currency for the authenticated account.",
          responses: {
            "200": {
              description: "Account balance",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/BalanceResponse" },
                },
              },
            },
            "401": {
              description: "Unauthorized",
              content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } },
            },
          },
        },
      },
      "/orders": {
        post: {
          summary: "Place a new order",
          description: "Submits a new order using the specified service ID, target URL, and quantity.",
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
              description: "Order created successfully",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/OrderResponse" },
                },
              },
            },
            "400": {
              description: "Validation error (out of bounds, invalid URL, or insufficient balance)",
              content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } },
            },
            "401": {
              description: "Unauthorized",
              content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } },
            },
            "403": {
              description: "Forbidden (READ_ONLY API Key)",
              content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } },
            },
          },
        },
      },
      "/orders/{id}": {
        get: {
          summary: "Get order status",
          description: "Fetches live status and delivery telemetry for an existing order by ID.",
          parameters: [
            {
              name: "id",
              in: "path",
              required: true,
              description: "The numeric or reference order ID",
              schema: { type: "string", example: "98765" },
            },
          ],
          responses: {
            "200": {
              description: "Order status details",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/OrderStatusResponse" },
                },
              },
            },
            "404": {
              description: "Order not found",
              content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } },
            },
          },
        },
      },
      "/": {
        post: {
          summary: "Classic SMM Single-Endpoint Compatibility",
          description:
            "Standard single-endpoint API supporting action=services, action=balance, action=add, action=status via application/x-www-form-urlencoded or application/json.",
          requestBody: {
            content: {
              "application/x-www-form-urlencoded": {
                schema: {
                  type: "object",
                  properties: {
                    key: { type: "string" },
                    action: { type: "string", enum: ["services", "balance", "add", "status"] },
                    service: { type: "integer" },
                    link: { type: "string" },
                    quantity: { type: "integer" },
                    order: { type: "integer" },
                  },
                },
              },
            },
          },
          responses: {
            "200": { description: "Action response matching REST outputs" },
          },
        },
      },
    },
  };

  return NextResponse.json(spec, {
    status: 200,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Content-Type": "application/json",
    },
  });
}
