/**
 * File: src/jwt.ts
 *
 * JWT utilities and helpers for signing, verifying, and handling JWT tokens.
 *
 * Exports JWTStatus, JWTPayload, JWTResult, and functions for working with JWTs.
 * Integrates with jsonwebtoken library for cryptographic operations.
 */

import {
  sign,
  verify,
  type JwtPayload,
  type Algorithm,
} from "npm:jsonwebtoken@9.0.2";
import { RouterError } from "./error.ts";

export enum JWTStatus {
  ERROR = -1,
  VALID = 0,
  EXPIRED = 1,
  NOT_YET = 2,
  INVALID = 3,
}

export type JWTPayload<Payload extends Record<string, unknown>> = Payload &
  JwtPayload;
export type JWTResult<Payload extends Record<string, unknown>> = {
  payload: JWTPayload<Payload> | null;
  status: JWTStatus;
  error?: Error;
};

type JWTVerifyPredicate<Payload extends Record<string, unknown>> = (
  payload: JWTPayload<Payload>
) => boolean;

export type JWTVerifyOptions<Payload extends Record<string, unknown>> = {
  expLeeway?: number;
  nbfLeeway?: number;
  audience?: string;
  predicates?: JWTVerifyPredicate<Payload>[];
};

export class JWT<Payload extends Record<string, unknown>> {
  #algorithm: Algorithm;
  #secret: string;

  get algorithm(): Algorithm {
    return this.#algorithm;
  }

  get secret(): string {
    return this.#secret;
  }

  constructor(secret: string | undefined, algorithm: Algorithm = "HS512") {
    if (!secret) {
      throw new RouterError("null JWT secret");
    }
    this.#algorithm = algorithm;
    this.#secret = secret;
  }

  sign(payload: JWTPayload<Payload>): string {
    return sign(payload, this.#secret, { algorithm: this.#algorithm });
  }

  verify(
    token: string,
    options: JWTVerifyOptions<Payload> = {}
  ): JWTResult<Payload> {
    try {
      const payload = verify(token, this.#secret, {
        algorithms: [this.#algorithm],
        audience: options.audience,
      }) as JWTPayload<Payload>;
      const currentTime = Math.floor(Date.now() / 1000);
      // Check expiration (`exp`)
      if (payload.exp && payload.exp + (options.expLeeway || 0) < currentTime) {
        return {
          payload: null,
          status: JWTStatus.EXPIRED,
          error: new Error("token expired"),
        };
      }
      // Check "not before" (`nbf`)
      if (payload.nbf && payload.nbf > currentTime + (options.nbfLeeway || 0)) {
        return {
          payload: null,
          status: JWTStatus.NOT_YET,
          error: new Error("token not active yet"),
        };
      }
      // Custom predicates (extra validation)
      if (options.predicates) {
        for (const predicate of options.predicates) {
          if (!predicate(payload)) {
            return { payload: null, status: JWTStatus.INVALID };
          }
        }
      }
      return { payload, status: JWTStatus.VALID, error: undefined };
    } catch (error) {
      return { payload: null, status: JWTStatus.ERROR, error: error as Error };
    }
  }
}
