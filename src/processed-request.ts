/**
 * File: src/processed-request.ts
 *
 * ProcessedRequest: Encapsulates request/response state, cookies, status, and helpers for HTTP request processing.
 *
 * Used internally by the router and handlers to manage request lifecycle and metadata.
 */

import { type HttpError, RouterError } from "./error.ts";
import { StatusText } from "./status/text.ts";
import { StatusCode, type StatusCode3 } from "./status/code.ts";
import {
  clearCookie,
  type ClearCookieOptions,
  clearCookies,
  type CookieDecoder,
  type CookieEncoder,
  type CookieOptions,
  type CookieValue,
  parseCookieFromHeader,
  setCookie,
} from "./util/cookie.ts";
import type {
  Content,
  ContentTypes,
  HandlerResult,
  RequestMethod,
  SecureProtocols,
} from "./types.ts";
import type RenderEngine from "./render-engine.ts";
import { SECURE_PROTOCOLS_SET } from "./defs.ts";
import type { JWT } from "@trie/http-router/jwt";

export type ProRequest = ProcessedRequest;

export class ProcessedRequest {
  responseTime = 0;
  callCount = 0;
  filterCount = 0;
  hookCount = 0;
  handleCount = 0;
  fallbackCount = 0;
  catchCount = 0;
  headers: Headers = new Headers();
  statusCode = 0;
  error?: Error | HttpError;

  constructor(
    public info: Deno.ServeHandlerInfo<Deno.NetAddr>,
    public time: number,
    public method: RequestMethod,
    public url: URL,
    public request: Request,
    public clientAddress: string,
    public clientPort: number,
    public params: Record<string, string>,
    public contentType?: string,
    public content?: Content,
    public renderEngine?: RenderEngine // public cookies?: Record<string, CookieValue>, // public cookieEncoder?: CookieEncoder, // public cookieDecoder?: CookieDecoder
  ) {
    this.query = this.query.bind(this);
    this.body = this.body.bind(this);
    this.cookies = this.cookies.bind(this);
    this.cookie = this.cookie.bind(this);
    this.expire = this.expire.bind(this);
    this.expireAll = this.expireAll.bind(this);
    this.status = this.status.bind(this);
    this.send = this.send.bind(this);
    this.text = this.text.bind(this);
    this.html = this.html.bind(this);
    this.json = this.json.bind(this);
    this.render = this.render.bind(this);
    this.end = this.end.bind(this);
    this.redirect = this.redirect.bind(this);
    this.forward = this.forward.bind(this);
  }

  cookies(cookieDecoder?: CookieDecoder): Promise<Record<string, CookieValue>> {
    return new Promise<Record<string, CookieValue>>((resolve) => {
      const cookieHeader = this.request.headers.get("cookie");
      if (!cookieHeader) return resolve({});
      const decode = cookieDecoder;
      const cookies: Record<string, CookieValue> = Object.fromEntries(
        parseCookieFromHeader(cookieHeader, { decode })
      );
      resolve(cookies);
    });
  }

  signedCookies<Payload extends Record<string, unknown>>(
    select: string[],
    options: { jwt: JWT<Payload> },
    cookieDecoder?: CookieDecoder
  ): Promise<Record<string, Payload>> {
    return new Promise<Record<string, Payload>>((resolve) => {
      const cookieHeader = this.request.headers.get("cookie");
      if (!cookieHeader) return resolve({});
      const jwt = options.jwt;
      const decode = cookieDecoder;
      const cookies = parseCookieFromHeader(cookieHeader, {
        select,
        decode,
      }).map(([name, cookie]) => {
        if (typeof cookie === "string") {
          const payload = jwt.decode(cookie);
          if (!payload) {
            throw new Error("invalid auth cookie");
          }
          return [name, payload];
        } else {
          throw new Error("invalid auth cookie");
        }
      });
      const signedCookies: Promise<Record<string, Payload>> =
        Object.fromEntries(cookies);
      resolve(signedCookies);
    });
  }

  query(): Promise<Record<string, string>> {
    return new Promise<Record<string, string>>((resolve) => {
      const query: Record<string, string> = {};
      this.url.searchParams.forEach((value, key) => {
        query[key] = value;
      });
      resolve(query);
    });
  }

  body(): Promise<Record<string, unknown>> {
    switch (this.contentType) {
      case "application/json": {
        return new Promise<Record<string, unknown>>((resolve, reject) => {
          resolve(this.request.json().catch((err) => reject(err)));
        });
      }
      case "application/x-www-form-urlencoded": {
        return new Promise<Record<string, unknown>>((resolve, reject) => {
          this.request
            .formData()
            .then((formData) => {
              const body: Record<string, unknown> = {};
              formData.forEach((value, key) => {
                body[key] = value;
              });
              resolve(body);
            })
            .catch((err) => reject(err));
        });
      }
      default: {
        return new Promise((resolve) => resolve({}));
      }
    }
  }

  cookie(
    name: string,
    value: CookieValue,
    options?: CookieOptions,
    cookieEncoder?: CookieEncoder
  ): ProcessedRequest {
    if (
      options?.secure &&
      !SECURE_PROTOCOLS_SET.has(this.url.protocol as SecureProtocols)
    ) {
      throw new RouterError(
        `Trying to set secure cookie \`${name}\` over insecure protocol ${this.url.origin}${this.url.pathname}`
      );
    }
    setCookie(this.headers, name, value, options, cookieEncoder);
    return this;
  }

  signCookie<Payload extends Record<string, unknown>>(
    name: string,
    value: Payload,
    jwt: JWT<Payload>,
    options?: CookieOptions,
    cookieEncoder?: CookieEncoder
  ): ProcessedRequest {
    if (
      options?.secure &&
      !SECURE_PROTOCOLS_SET.has(this.url.protocol as SecureProtocols)
    ) {
      throw new RouterError(
        `Trying to set secure cookie \`${name}\` over insecure protocol ${this.url.origin}${this.url.pathname}`
      );
    }
    // const body = Buffer.from(JSON.stringify(value)).toString("base64url");
    try {
      const token = jwt.sign(value);
      if (!token) throw new Error("try sign auth cookie: sign failed");
      console.log(token);
      setCookie(this.headers, name, token, options, cookieEncoder);
    } catch (err) {
      throw new Error("try sign auth cookie: " + (err as Error).message);
    }
    return this;
  }

  expire(name: string, options?: ClearCookieOptions): ProcessedRequest {
    clearCookie(this.headers, name, options);
    return this;
  }

  expireAll(options?: ClearCookieOptions): ProcessedRequest {
    clearCookies(this.request, this.headers, options);
    return this;
  }

  status(statusCode: number): ProcessedRequest {
    this.statusCode = statusCode;
    return this;
  }

  end(statusCode?: StatusCode | null, noStatusText?: boolean): Response {
    const status = (this.statusCode = statusCode || this.statusCode || 200);
    const statusText = StatusText.get(status);
    const headers = this.headers;
    if (noStatusText) {
      headers.delete("Content-Type");
    } else {
      headers.set("Content-Type", "text/plain; charset=UTF-8");
    }
    return new Response(noStatusText ? null : statusText, {
      headers,
      status,
      statusText,
    });
  }

  send(
    bytes?: BodyInit,
    statusCode?: StatusCode,
    contentType?: ContentTypes
  ): Response {
    const status = (this.statusCode = statusCode || this.statusCode || 200);
    const statusText = StatusText.get(status);
    const headers = this.headers;
    headers.append("Content-Type", contentType || "application/octet-stream");
    return new Response(bytes, { headers, status, statusText });
  }

  text(
    text?: string,
    statusCode?: StatusCode,
    contentType?: ContentTypes
  ): Response {
    const status = (this.statusCode = statusCode || this.statusCode || 200);
    const statusText = StatusText.get(status);
    const headers = this.headers;
    headers.append("Content-Type", contentType || "text/plain; charset=UTF-8");
    return new Response(text, { headers, status, statusText });
  }

  html(
    html?: string,
    statusCode?: StatusCode,
    contentType?: ContentTypes
  ): Response {
    const status = (this.statusCode = statusCode || this.statusCode || 200);
    const statusText = StatusText.get(status);
    const headers = this.headers;
    headers.append("Content-Type", contentType || "text/html; charset=UTF-8");
    return new Response(html, { headers, status, statusText });
  }

  json(
    obj?: unknown,
    statusCode?: StatusCode,
    contentType?: ContentTypes
  ): Response {
    const status = (this.statusCode = statusCode || this.statusCode || 200);
    const statusText = StatusText.get(status);
    const headers = this.headers;
    headers.append(
      "Content-Type",
      contentType || "application/json; charset=UTF-8"
    );
    const jsonText = obj == null ? "null" : JSON.stringify(obj);
    return new Response(jsonText, { headers, status, statusText });
  }

  render(
    filePath: string,
    locals?: Record<string, unknown>,
    statusCode?: StatusCode
  ): HandlerResult {
    if (this.renderEngine == null) {
      throw new RouterError("render engine not set");
    }
    this.statusCode = this.statusCode = statusCode || this.statusCode || 200;
    return this.renderEngine.render(filePath, this, locals);
  }

  redirect(toLocation: string, status?: number | 301 | StatusCode3): Response {
    status = status || StatusCode.MovedPermanently;
    this.headers.append("Location", toLocation);
    return this.end(status);
  }

  forward(toLocation: string, status?: number | 302): Response {
    status = status || StatusCode.Found;
    this.headers.append("Location", toLocation);
    return this.end(status);
  }
}

export default ProcessedRequest;
