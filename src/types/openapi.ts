// Tipagem parcial do OpenAPI 3.0 -- só os campos que a página de docs (STC-397)
// realmente consome do schema real do drf-spectacular (backend/core/schema.py),
// não uma tipagem completa da spec.

export interface OpenApiTag {
  name: string;
  description?: string;
}

export interface OpenApiReference {
  $ref: string;
}

// allOf: [{$ref}] é o padrão que drf-spectacular usa pra campo aninhado
// readOnly (ex.: DocumentoUnidadeRead.tipo_documento) -- ver achado real no
// schema. items só existe quando type === "array".
export interface OpenApiSchema {
  $ref?: string;
  type?: "string" | "integer" | "number" | "boolean" | "array" | "object";
  format?: string;
  enum?: string[];
  nullable?: boolean;
  readOnly?: boolean;
  writeOnly?: boolean;
  description?: string;
  example?: unknown;
  properties?: Record<string, OpenApiSchema>;
  required?: string[];
  items?: OpenApiSchema;
  allOf?: OpenApiSchema[];
  oneOf?: OpenApiSchema[];
}

export interface OpenApiParameter {
  name: string;
  in: "query" | "path" | "header" | "cookie";
  required?: boolean;
  description?: string;
  schema?: OpenApiSchema;
}

export interface OpenApiMediaType {
  schema?: OpenApiSchema;
  example?: unknown;
  examples?: Record<string, { value?: unknown; summary?: string }>;
}

export interface OpenApiRequestBody {
  required?: boolean;
  content?: Record<string, OpenApiMediaType>;
}

export interface OpenApiResponse {
  description?: string;
  content?: Record<string, OpenApiMediaType>;
}

export interface OpenApiOperation {
  operationId?: string;
  summary?: string;
  description?: string;
  tags?: string[];
  parameters?: OpenApiParameter[];
  requestBody?: OpenApiRequestBody;
  responses?: Record<string, OpenApiResponse>;
}

export type OpenApiMetodo = "get" | "post" | "put" | "patch" | "delete";

export type OpenApiPathItem = Partial<Record<OpenApiMetodo, OpenApiOperation>>;

export interface OpenApiDocument {
  openapi: string;
  info: { title: string; version: string; description?: string };
  tags?: OpenApiTag[];
  paths: Record<string, OpenApiPathItem>;
  components?: { schemas?: Record<string, OpenApiSchema> };
}
