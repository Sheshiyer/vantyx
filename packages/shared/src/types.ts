/**
 * API contract DTOs shared by the Worker, admin, and viewer. (The config document types
 * live in schema.ts; these are the request/response shapes around it.)
 */
import type { TenantConfig } from "./schema";

export type UploadKind = "slot" | "logo";

/** POST /api/uploads — request a presigned R2 PUT URL. */
export type UploadRequest =
  | {
      kind: "slot";
      contentType: string;
      contentLength: number;
      floorId: string;
      timeId: string;
      viewId: string;
    }
  | {
      kind: "logo";
      contentType: string;
      contentLength: number;
      filename: string;
    };

/** POST /api/uploads — response. */
export type UploadResponse = {
  /** Presigned PUT URL — the browser uploads bytes here directly (never through the Worker). */
  url: string;
  /** Relative R2 key the client writes into the config slot once the PUT succeeds. */
  key: string;
  expiresIn: number;
};

/** GET /api/config — response. */
export type ConfigResponse = {
  config: TenantConfig;
};

/** Standard error envelope. */
export type ApiError = {
  error: string;
  code?: string;
};

/** Upload guardrails enforced client-side (admin) AND server-side (Worker). */
export const UPLOAD_LIMITS = {
  /** Hard cap. The recommended client export preset is ~12 MB / 8192px wide. */
  maxBytes: 25 * 1024 * 1024,
  allowedTypes: ["image/jpeg", "image/png", "image/webp"],
} as const;
