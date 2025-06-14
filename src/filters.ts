import { REQUEST_METHODS_LIST } from "./defs.ts";
import { RouterError, StatusCode } from "./index.ts";
import type { ProcessedRequest } from "./processed-request.ts";

export interface LimitRateParams {
  maxTokens: number;
  refillRate: number;
  cleanupInterval?: number;
  cleanupMethod?: "clear" | "max-tokens";
}

export function rateLimit(params: LimitRateParams) {
  const { maxTokens, refillRate, cleanupInterval, cleanupMethod } = params;
  const rates = new Map<string, { tokens: number; lastRefill: number }>();
  // latest tokens calculator function
  const latestTokens = (
    tokens: number,
    lastRefill: number,
    now: number
  ): number => {
    const elapsed = (now - lastRefill) / 1000;
    const refillTokens = Math.floor(elapsed * refillRate);
    return Math.min(maxTokens, tokens + refillTokens);
  };
  if (cleanupMethod) {
    if (!cleanupInterval) {
      throw new RouterError("cleanup interval required");
    } else if (cleanupInterval <= 0) {
      throw new RouterError("invalid cleanup interval value");
    }
    const cleanupIntervalMillis = cleanupInterval * 1000;
    // cleanup rates cache occassionally
    if (!["clear", "max-tokens"].includes(cleanupMethod)) {
      throw new RouterError("unknown clean-up-method " + cleanupMethod);
    }
    const _cleanupIntervalId = setInterval(() => {
      if (cleanupMethod === "clear") {
        rates.clear();
      } else if (cleanupMethod === "max-tokens") {
        const expired = rates.entries().filter(([, limiter]) => {
          const tokens = limiter.tokens;
          const lastRefill = limiter.lastRefill;
          return (
            tokens >= maxTokens - 1 ||
            latestTokens(tokens, lastRefill, Date.now()) >= maxTokens - 1
          );
        });
        for (const [key] of expired) {
          rates.delete(key);
        }
      }
    }, cleanupIntervalMillis);
  }
  // ------------------------------------
  return (pr: ProcessedRequest) => {
    const limiter = rates.get(pr.clientAddress);
    if (!limiter) {
      rates.set(pr.clientAddress, {
        tokens: maxTokens - 1,
        lastRefill: Date.now(),
      });
    } else {
      const now = Date.now();
      const { tokens, lastRefill } = limiter;
      limiter.tokens = latestTokens(tokens, lastRefill, now);
      limiter.lastRefill = now;
      limiter.tokens--;
      if (limiter.tokens < 0) {
        limiter.tokens = 0;
        return pr.end(StatusCode.TooManyRequests);
      }
    }
  };
}

export interface AccessControlParams {
  allowMethods?: Array<string>;
  allowHeaders?: Array<string>;
  allowOrigins?: Array<string>;
  allowCredentials?: boolean;
  maxAge?: number;
  exposeHeaders?: Array<string>;
}

export function accessControl(options: AccessControlParams) {
  const methods = (options.allowMethods || REQUEST_METHODS_LIST).join(", ");
  const methodsSet = new Set(options.allowMethods || REQUEST_METHODS_LIST);
  const headers = options.allowHeaders && options.allowHeaders.join(", ");
  const headersSet = options.allowHeaders && new Set(options.allowHeaders);
  const origins = options.allowOrigins && new Set(options.allowOrigins);
  const wildCardOrigin = origins && origins.has("*");
  const credentials = options.allowCredentials;
  const maxAge = options.maxAge;
  const exposeHeaders = options.exposeHeaders
    ? options.exposeHeaders.join(", ")
    : undefined;
  return (pr: ProcessedRequest) => {
    if (origins) {
      const origin_ = pr.request.headers.get("origin");
      const referer = pr.request.headers.get("referer");
      const origin = origin_ || (referer && new URL(referer).origin);
      if (origin != null) {
        if (origins.has(origin)) {
          pr.headers.set("Access-Control-Allow-Origin", origin);
        } else if (wildCardOrigin) {
          pr.headers.set("Access-Control-Allow-Origin", "*");
        } else {
          return pr.end(StatusCode.Forbidden);
        }
      }
    }
    if (methodsSet) {
      pr.headers.set("Access-Control-Allow-Methods", methods);
    }
    if (headers) {
      pr.headers.set("Access-Control-Allow-Headers", headers);
    }
    if (credentials) {
      pr.headers.set("Access-Control-Allow-Credentials", "true");
    }
    if (maxAge) {
      pr.headers.set("Access-Control-Allow-Max-Age", maxAge.toFixed());
    }
    if (exposeHeaders) {
      pr.headers.set("Access-Control-Allow-Expose-Headers", exposeHeaders);
    }
    if (methodsSet && pr.method != "OPTIONS" && !methodsSet.has(pr.method)) {
      return pr.end(StatusCode.MethodNotAllowed);
    }
    if (headersSet) {
      let forbiddenHeader: string | null = null;
      try {
        pr.request.headers.forEach((_value, header) => {
          if (!headersSet.has(header)) {
            forbiddenHeader = header;
            throw header;
          }
        });
      } catch (_err) {
        if (forbiddenHeader)
          return pr.send(
            `Forbidden header: ${forbiddenHeader}`,
            StatusCode.BadRequest
          );
      }
    }
    if (pr.method === "OPTIONS") return pr.end(StatusCode.NoContent, true);
  };
}

export const filter = {
  rateLimit,
  accessControl,
};

export default filter;
