import swaggerJsdoc from "swagger-jsdoc";

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "CollabDocs API",
      version: "2.0.0",
      description: "Enterprise-Grade Real-Time Collaboration Platform API — LogicVeda Industry Project · March 2026",
      contact: { name: "CollabDocs", url: "https://real-time-collab-frontend-black.vercel.app" },
    },
    servers: [
      { url: "https://real-time-collab-rhvs.onrender.com", description: "Production" },
      { url: "http://localhost:5000", description: "Local Development" },
    ],
    components: {
      securitySchemes: {
        cookieAuth: {
          type: "apiKey",
          in: "cookie",
          name: "accessToken",
          description: "JWT access token stored in httpOnly cookie",
        },
      },
      schemas: {
        User: {
          type: "object",
          properties: {
            _id: { type: "string", example: "64f1a2b3c4d5e6f7a8b9c0d1" },
            name: { type: "string", example: "John Doe" },
            email: { type: "string", example: "john@example.com" },
            cursorColor: { type: "string", example: "#6366f1" },
            isGuest: { type: "boolean", example: false },
            createdAt: { type: "string", format: "date-time" },
          },
        },
        Document: {
          type: "object",
          properties: {
            _id: { type: "string", example: "64f1a2b3c4d5e6f7a8b9c0d2" },
            title: { type: "string", example: "My Document" },
            content: { type: "string", example: "<p>Hello world</p>" },
            owner: { type: "string", example: "64f1a2b3c4d5e6f7a8b9c0d1" },
            collaborators: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  userId: { type: "string" },
                  role: { type: "string", enum: ["editor", "viewer"] },
                },
              },
            },
            createdAt: { type: "string", format: "date-time" },
            updatedAt: { type: "string", format: "date-time" },
          },
        },
        Comment: {
          type: "object",
          properties: {
            _id: { type: "string" },
            documentId: { type: "string" },
            authorId: { $ref: "#/components/schemas/User" },
            body: { type: "string", example: "Great point here!" },
            anchorText: { type: "string", example: "selected text" },
            color: { type: "string", example: "#6366f1" },
            resolved: { type: "boolean", example: false },
            replies: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  _id: { type: "string" },
                  authorId: { $ref: "#/components/schemas/User" },
                  body: { type: "string" },
                  createdAt: { type: "string", format: "date-time" },
                },
              },
            },
            createdAt: { type: "string", format: "date-time" },
          },
        },
        Version: {
          type: "object",
          properties: {
            _id: { type: "string" },
            documentId: { type: "string" },
            content: { type: "string" },
            savedBy: { $ref: "#/components/schemas/User" },
            label: { type: "string", example: "Before major edit" },
            isManual: { type: "boolean", example: true },
            createdAt: { type: "string", format: "date-time" },
          },
        },
        Error: {
          type: "object",
          properties: {
            message: { type: "string", example: "Not found" },
          },
        },
      },
    },
    security: [{ cookieAuth: [] }],
  },
  apis: ["./src/routes/*.ts"],
};

export const swaggerSpec = swaggerJsdoc(options);
