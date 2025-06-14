import type { JWT, JWTResult, JWTVerifyOptions } from "./jwt.ts";
import { JWTStatus } from "./jwt.ts";
import { StatusCode } from "./status/code.ts";
import type { ProcessedRequest } from "./processed-request.ts";
import type { Handler, HandlerResult } from "./types.ts";
import { RouterError } from "./error.ts";

export type UsernamePasswordOptions = {
  username: string;
  password: string;
};

export type AuthBasicCredentialFn<UserData> = (
  { username, password }: UsernamePasswordOptions,
  pr: ProcessedRequest & UserData
) => HandlerResult;

export type AuthBasicParams<UserData> = {
  acceptCredentials: AuthBasicCredentialFn<UserData>;
};

function basic<UserData extends Record<string, unknown>>(
  options: AuthBasicParams<UserData>,
  status?: number
): Handler<UserData> {
  status = status || StatusCode.Unauthorized;
  const acceptCredentials = options.acceptCredentials;
  return async function (pr: ProcessedRequest & UserData) {
    const authorizationHeader = pr.request.headers.get("authorization");
    if (authorizationHeader) {
      const [scheme, creds] = authorizationHeader.split(" ", 2);
      const schemesMatch = scheme.toLowerCase() === "basic";
      if (!schemesMatch) return pr.end();
      const [username, password] = atob(creds).split(":", 2);
      let result = acceptCredentials({ username, password }, pr);
      if (result) {
        if (result instanceof Promise) result = await result;
        if (result instanceof Response) return result;
      }
      pr.status(200);
    }
  };
}

export type AuthApiKeyCredentialFn<UserData> = (
  key: string,
  pr: ProcessedRequest & UserData
) => HandlerResult;

export type AuthApiKeyParams<UserData> = {
  accpetKey: AuthApiKeyCredentialFn<UserData>;
};

function apiKey<UserData extends Record<string, unknown>>(
  options: AuthApiKeyParams<UserData>,
  status?: number
): Handler<UserData> {
  status = status || StatusCode.Unauthorized;
  const accpetKey = options.accpetKey;
  return async function (pr: ProcessedRequest & UserData) {
    pr.status(status);
    const xApiKey = pr.request.headers.get("X-API-Key");
    if (!xApiKey) return pr.end();
    let result = accpetKey(xApiKey, pr);
    if (result) {
      if (result instanceof Promise) result = await result;
      if (result instanceof Response) return result;
    }
    pr.status(200);
  };
}

export type AuthBearerTokenFn = (
  token: string,
  pr: ProcessedRequest
) => HandlerResult;

export type AuthBearerTokenParams = {
  acceptToken: AuthBearerTokenFn;
  scheme?: string | "Bearer";
};

function bearerToken<UserData extends Record<string, unknown>>(
  options: AuthBearerTokenParams,
  status?: number
): Handler<UserData> {
  status = status || StatusCode.Unauthorized;
  const scheme = options.scheme?.toLowerCase() || "bearer";
  const acceptToken = options.acceptToken;
  return async function (pr: ProcessedRequest) {
    pr.status(status);
    const authorizationHeader = pr.request.headers.get("Authorization");
    if (!authorizationHeader) return pr.end();
    const [hScheme, hToken] = authorizationHeader.split(" ").filter(Boolean);
    const schemesMatch = hScheme.toLowerCase() === scheme;
    if (!schemesMatch) return pr.end();
    let result = acceptToken(hToken, pr);
    if (result) {
      if (result instanceof Promise) result = await result;
      if (result instanceof Response) return result;
    }
    pr.status(200);
  };
}

export type AuthJsonWebTokenFn<
  Payload extends Record<string, unknown>,
  UserData extends Record<string, unknown>
> = (
  payload: JWTResult<Payload>,
  pr: ProcessedRequest & UserData
) => HandlerResult;

export type AuthJsonWebTokenParams<
  Payload extends Record<string, unknown>,
  UserData extends Record<string, unknown>
> = {
  jwt: JWT<Payload>;
  acceptJWT: AuthJsonWebTokenFn<Payload, UserData>;
  scheme?: string | "Bearer";
  donotReturn?: boolean;
};

function jsonWebToken<
  Payload extends Record<string, unknown>,
  UserData extends Record<string, unknown>
>(
  options: AuthJsonWebTokenParams<Payload, UserData> &
    JWTVerifyOptions<Payload>,
  status?: number
): Handler<UserData> {
  status = status || StatusCode.Unauthorized;
  const scheme = options.scheme?.toLowerCase() || "bearer";
  const jwt = options.jwt;
  const acceptJWT = options.acceptJWT;
  return async function (pr: ProcessedRequest & UserData) {
    pr.status(status);
    const authorizationHeader = pr.request.headers.get("Authorization");
    if (authorizationHeader) {
      const [hScheme, hToken] = authorizationHeader.split(" ").filter(Boolean);
      const schemesMatch = hScheme.toLowerCase() === scheme;
      if (schemesMatch) {
        const verifyOptions: JWTVerifyOptions<Payload> = {
          expLeeway: options.expLeeway,
          nbfLeeway: options.nbfLeeway,
          audience: options.audience,
          predicates: options.predicates,
        };
        const jwtResult = await jwt.verify(hToken, verifyOptions);
        switch (jwtResult.status) {
          case JWTStatus.EXPIRED:
            jwtResult.error = new Error("token expired");
            break;
          case JWTStatus.NOT_YET:
            jwtResult.error = new Error("token not valid yet");
            break;
          case JWTStatus.ERROR:
          case JWTStatus.INVALID:
            jwtResult.error = new Error("invalid token");
            break;
        }
        let result = acceptJWT(jwtResult, pr);
        if (result) {
          if (result instanceof Promise) result = await result;
          if (result instanceof Response) return result;
        }
        pr.status(200);
      }
    }
  };
}

export type AuthCookieFn<
  Payload extends Record<string, unknown>,
  UserData extends Record<string, unknown>
> = (cookie: Payload, pr: ProcessedRequest & UserData) => HandlerResult;

export type AuthCookieParams<
  Payload extends Record<string, unknown>,
  UserData extends Record<string, unknown>
> = {
  name: string;
  secret?: string;
  acceptPayload: AuthCookieFn<Payload, UserData>;
};

function signedCookie<
  Payload extends Record<string, unknown>,
  UserData extends Record<string, unknown>
>(
  options: AuthCookieParams<Payload, UserData>,
  status?: number
): Handler<UserData> {
  const cookieName = options.name;
  const cookieSecret = options.secret;
  const acceptPayload = options.acceptPayload;
  if (!cookieSecret) {
    throw new RouterError("null secret key");
  }
  status = status || StatusCode.Unauthorized;
  return async function (pr: ProcessedRequest & UserData) {
    pr.status(status);
    const cookies = await pr.signedCookies<Payload>([cookieName], {
      secret: cookieSecret,
    });
    const cookie = cookies[cookieName];
    if (cookie == null) return pr.end();
    let result = acceptPayload(cookie, pr);
    if (result) {
      if (result instanceof Promise) result = await result;
      if (result instanceof Response) return result;
    }
    pr.status(200);
  };
}

export const auth = {
  basic,
  apiKey,
  bearerToken,
  jsonWebToken,
  signedCookie,
};

export default auth;
