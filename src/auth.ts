import { type JWT, JWTStatus, type JWTVerifyOptions } from "./jwt.ts";
import { StatusCode } from "./status/code.ts";
import type { ProcessedRequest } from "./processed-request.ts";
import type { Handler, HandlerResult } from "./types.ts";
import type { CookieValue } from "./util/cookie.ts";

export type UsernamePasswordOptions = {
  username: string;
  password: string;
};

export type AuthBasicCredentialFn<UserData> = (
  { username, password }: UsernamePasswordOptions,
  pr: ProcessedRequest & UserData
) => HandlerResult;

export type AuthBasicParams<UserData> = {
  credentials:
    | {
        username: string;
        password: string;
      }
    | AuthBasicCredentialFn<UserData>;
  donotReturn?: boolean;
};

function basic<UserData extends Record<string, unknown>>(
  options: AuthBasicParams<UserData>,
  status?: number
): Handler<UserData> {
  status = status || StatusCode.Unauthorized;
  const credentials = options.credentials;
  const donotReturn = options.donotReturn;
  const credentialsIsAFunction = typeof credentials === "function";
  return function (pr: ProcessedRequest & UserData) {
    const authorizationHeader = pr.request.headers.get("authorization");
    if (authorizationHeader) {
      const [scheme, params] = authorizationHeader.split(" ");
      if (scheme.toLowerCase() === "basic") {
        const [username, password] = atob(params).split(":");
        if (credentialsIsAFunction) {
          const response = credentials({ username, password }, pr);
          if (response) return response;
          return;
        } else if (
          username === credentials.username &&
          password === credentials.password
        ) {
          return;
        }
      }
    }
    if (donotReturn) {
      pr.status(status);
    } else {
      return pr.end(status);
    }
  };
}

export type AuthApiKeyCredentialFn<UserData> = (
  key: string,
  pr: ProcessedRequest & UserData
) => HandlerResult;

export type AuthApiKeyParams<UserData> = {
  key: string | AuthApiKeyCredentialFn<UserData>;
  donotReturn?: boolean;
};

function apiKey<UserData extends Record<string, unknown>>(
  options: AuthApiKeyParams<UserData>,
  status?: number
): Handler<UserData> {
  status = status || StatusCode.Unauthorized;
  const key = options.key;
  const donotReturn = options.donotReturn;
  const keyIsAFunction = typeof key === "function";
  return function (pr: ProcessedRequest & UserData) {
    const xApiKeyHeader = pr.request.headers.get("X-API-Key");
    if (xApiKeyHeader && keyIsAFunction) {
      const response = key(xApiKeyHeader, pr);
      if (response) return response;
      return;
    } else if (xApiKeyHeader && xApiKeyHeader == key) {
      return;
    } else if (donotReturn) {
      pr.status(status);
    } else {
      return pr.end(status);
    }
  };
}

export type AuthBearerTokenFn = (
  token: string,
  pr: ProcessedRequest
) => boolean | Promise<boolean>;

export type AuthBearerTokenParams = {
  token: string | AuthBearerTokenFn;
  scheme?: string | "Bearer";
  donotReturn?: boolean;
};

function bearerToken<UserData extends Record<string, unknown>>(
  options: AuthBearerTokenParams,
  status?: number
): Handler<UserData> {
  status = status || StatusCode.Unauthorized;
  const scheme = options.scheme?.toLowerCase() || "bearer";
  const token = options.token;
  const donotReturn = options.donotReturn;
  return async function (pr: ProcessedRequest) {
    const authorizationHeader = pr.request.headers.get("Authorization");
    if (authorizationHeader) {
      const [hScheme, hToken] = authorizationHeader.split(" ").filter(Boolean);
      const schemesMatch = hScheme.toLowerCase() === scheme;
      if (schemesMatch) {
        if (typeof token === "function") {
          let result = token(hToken, pr);
          if (result instanceof Promise) result = await result;
          if (result) return;
        } else if (hToken === token) {
          return;
        }
      }
    }
    if (donotReturn) {
      pr.status(status);
    } else {
      return pr.end(status);
    }
  };
}

export type AuthJsonWebTokenFn<UserData> = (
  payload: Record<string, unknown>,
  pr: ProcessedRequest & UserData
) => boolean | Promise<boolean>;

export type AuthJsonWebTokenParams<UserData extends Record<string, unknown>> = {
  jwt: JWT;
  payload?: AuthJsonWebTokenFn<UserData>;
  scheme?: string | "Bearer";
  donotReturn?: boolean;
};

function jsonwebtoken<UserData extends Record<string, unknown>>(
  options: AuthJsonWebTokenParams<UserData> & JWTVerifyOptions,
  status?: number
): Handler<UserData> {
  status = status || StatusCode.Unauthorized;
  const scheme = options.scheme?.toLowerCase() || "bearer";
  const jwt = options.jwt;
  const donotReturn = options.donotReturn;
  const acceptPayload = options.payload;
  return async function (pr: ProcessedRequest & UserData) {
    const authorizationHeader = pr.request.headers.get("Authorization");
    if (authorizationHeader) {
      const [hScheme, hToken] = authorizationHeader.split(" ").filter(Boolean);
      const schemesMatch = hScheme.toLowerCase() === scheme;
      if (schemesMatch) {
        const verifyOptions: JWTVerifyOptions = {
          expLeeway: options.expLeeway,
          nbfLeeway: options.nbfLeeway,
          audience: options.audience,
          predicates: options.predicates,
        };
        const jwtResult = await jwt.verify(hToken, verifyOptions);
        const payload = jwtResult.payload;
        let error = null;
        switch (jwtResult.status) {
          case JWTStatus.EXPIRED:
            error = "token expired";
            break;
          case JWTStatus.NOT_YET:
            error = "token not yet valid";
            break;
          case JWTStatus.ERROR:
          case JWTStatus.INVALID:
            error = "token invalid";
            break;
        }
        if (payload == null) {
          if (donotReturn) {
            pr.status(status);
            return;
          } else if (error) {
            return pr.status(status).json({ error: error || "token invalid" });
          } else {
            return pr.end(status);
          }
        }
        if (acceptPayload) {
          let result = acceptPayload(payload, pr);
          if (result instanceof Promise) result = await result;
          if (!result) {
            return pr.status(status).json({ error: "token rejected" });
          }
        }
      }
    }
  };
}

export type AuthCookieFn<UserData> = (
  cookie: CookieValue,
  pr: ProcessedRequest & UserData
) => boolean | Promise<boolean>;

export type AuthCookieParams<UserData extends Record<string, unknown>> = {
  name: string;
  cookie: CookieValue | AuthCookieFn<UserData>;
  donotReturn?: boolean;
};

function cookie<UserData extends Record<string, unknown>>(
  options: AuthCookieParams<UserData>,
  status?: number
): Handler<UserData> {
  const cookieName = options.name;
  const acceptCookie = options.cookie;
  const donotReturn = options.donotReturn;
  status = status || StatusCode.Unauthorized;
  return async function (pr: ProcessedRequest & UserData) {
    const cookie = pr.cookies && pr.cookies[cookieName];
    if (cookie != null) {
      if (typeof acceptCookie === "function") {
        let result = acceptCookie(cookie, pr);
        if (result instanceof Promise) result = await result;
        if (result) {
          return;
        }
      } else if (cookie === acceptCookie) {
        return;
      }
      return;
    }
    if (donotReturn) {
      pr.status(status);
    } else {
      return pr.end(status);
    }
  };
}

export const auth = {
  basic,
  apiKey,
  bearerToken,
  jsonwebtoken,
  cookie,
};

export default auth;
