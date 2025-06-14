/**
 * File: src/jwt.ts
 *
 * JWT utilities and helpers for signing, verifying, and handling JWT tokens.
 *
 * Exports JwtAlgorithmEnum, JwtHeader, JwtPayload, Jwt, JWTVeryfyOptions, and
 * JWT class with sign, verifySignature, verify, decode methods.
 */

import { Buffer } from "node:buffer";
import { createHmac, sign } from "node:crypto";
import { RouterError } from "./error.ts";
import { verify } from "node:crypto";

export type JwtSymmetricAlgorithm = "HS256" | "HS384" | "HS512";

export type JwtAsymmetricAlgorithm =
  | "RS256"
  | "RS384"
  | "RS512"
  | "ES256"
  | "ES384"
  | "ES512"
  | "PS256"
  | "PS384"
  | "PS512";

/**
 * SecureHashAlgorithm standard cryptographic hash algorithms used for signing.
 *
 * - **HMAC-Based (Symmetric, Fast)**: Used for shared-secret authentication.
 *   - HS256: Most common and secure.
 *   - HS384: Slightly stronger but less common.
 *   - HS512: High-security option for robust applications.
 *
 * - **RSA-Based (Asymmetric, Public-Private Key)**: Used for OAuth, OpenID, and other key-based authentication.
 *   - RS256: Widely used.
 *   - RS384: Stronger but heavier.
 *   - RS512: Computationally expensive but highly secure.
 *   - PS256: RSA-PSS variant with SHA-256.
 *   - PS384: RSA-PSS variant with SHA-384.
 *   - PS512: RSA-PSS variant with SHA-512.
 *
 * - **ECDSA-Based (Asymmetric, Efficient)**: Faster than RSA, great for modern applications.
 *   - ES256: Recommended alternative to RSA.
 *   - ES384: Stronger cryptographic security.
 *   - ES512: Best for ultra-secure environments.
 */
export type JwtAlgorithm =
  | JwtSymmetricAlgorithm
  | JwtAsymmetricAlgorithm
  | "none";

export enum JwtSymmetricAlgorithmEnum {
  HS256 = "sha256",
  HS384 = "sha384",
  HS512 = "sha512",
}

export enum JwtAsymmetricAlgorithmEnum {
  RS256 = "RSA-SHA256",
  RS384 = "RSA-SHA384",
  RS512 = "RSA-SHA512",
  PS256 = "RSA-PSS-SHA256",
  PS384 = "RSA-PSS-SHA384",
  PS512 = "RSA-PSS-SHA512",
  ES256 = "sha3-256",
  ES384 = "sha3-384",
  ES512 = "sha3-512",
}

export enum JwtAlgorithmEnum {
  HS256 = "sha256",
  HS384 = "sha384",
  HS512 = "sha512",
  RS256 = "RSA-SHA256",
  RS384 = "RSA-SHA384",
  RS512 = "RSA-SHA512",
  PS256 = "RSA-PSS-SHA256",
  PS384 = "RSA-PSS-SHA384",
  PS512 = "RSA-PSS-SHA512",
  ES256 = "sha3-256",
  ES384 = "sha3-384",
  ES512 = "sha3-512",
  none = "none",
}

export const ValidJwtSymmetricAlgorithms: Set<JwtSymmetricAlgorithm> = new Set([
  "HS256",
  "HS384",
  "HS512",
]);

export const ValidJwtAsymmetricAlgorithms: Set<JwtAsymmetricAlgorithm> =
  new Set([
    "RS256",
    "RS384",
    "RS512",
    "PS256",
    "PS384",
    "PS512",
    "ES256",
    "ES384",
    "ES512",
  ]);

export const ValidJwtAlgorithms: Set<JwtAlgorithm> = new Set([
  "HS256",
  "HS384",
  "HS512",
  "RS256",
  "RS384",
  "RS512",
  "PS256",
  "PS384",
  "PS512",
  "ES256",
  "ES384",
  "ES512",
]);

export type JwtNameAndHash = { name: string; hash: string };

export const JwtAlgorithmNameAndHash: Record<JwtAlgorithm, JwtNameAndHash> = {
  HS256: { name: "HMAC", hash: "SHA-256" },
  HS384: { name: "HMAC", hash: "SHA-384" },
  HS512: { name: "HMAC", hash: "SHA-512" },
  RS256: { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
  RS384: { name: "RSASSA-PKCS1-v1_5", hash: "SHA-384" },
  RS512: { name: "RSASSA-PKCS1-v1_5", hash: "SHA-512" },
  PS256: { name: "RSA-PSS", hash: "SHA-256" },
  PS384: { name: "RSA-PSS", hash: "SHA-384" },
  PS512: { name: "RSA-PSS", hash: "SHA-512" },
  ES256: { name: "ECDSA", hash: "SHA-256" },
  ES384: { name: "ECDSA", hash: "SHA-384" },
  ES512: { name: "ECDSA", hash: "SHA-512" },
  none: { name: "", hash: "" },
} as const;

export const JwtSymmetricAlgorithmNameAndHash: Record<
  JwtSymmetricAlgorithm,
  JwtNameAndHash
> = {
  HS256: { name: "HMAC", hash: "SHA-256" },
  HS384: { name: "HMAC", hash: "SHA-384" },
  HS512: { name: "HMAC", hash: "SHA-512" },
} as const;

export const JwtAsymmetricAlgorithmNameAndHash: Record<
  JwtAsymmetricAlgorithm,
  JwtNameAndHash
> = {
  RS256: { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
  RS384: { name: "RSASSA-PKCS1-v1_5", hash: "SHA-384" },
  RS512: { name: "RSASSA-PKCS1-v1_5", hash: "SHA-512" },
  PS256: { name: "RSA-PSS", hash: "SHA-256" },
  PS384: { name: "RSA-PSS", hash: "SHA-384" },
  PS512: { name: "RSA-PSS", hash: "SHA-512" },
  ES256: { name: "ECDSA", hash: "SHA-256" },
  ES384: { name: "ECDSA", hash: "SHA-384" },
  ES512: { name: "ECDSA", hash: "SHA-512" },
} as const;

export interface JwtHeader {
  alg: string | Algorithm;
  typ?: string | undefined;
  cty?: string | undefined;
  crit?: Array<string | Exclude<keyof JwtHeader, "crit">> | undefined;
  kid?: string | undefined;
  jku?: string | undefined;
  x5u?: string | string[] | undefined;
  "x5t#S256"?: string | undefined;
  x5t?: string | undefined;
  x5c?: string | string[] | undefined;
}

export type JwtPayload<CustomData extends Record<string, unknown>> = {
  [key: string]: unknown;
  iss?: string | undefined;
  sub?: string | undefined;
  aud?: string | string[] | undefined;
  exp?: number | undefined;
  nbf?: number | undefined;
  iat?: number | undefined;
  jti?: string | undefined;
} & CustomData;

export type Jwt<CustomPayload extends Record<string, unknown>> = {
  header: JwtHeader;
  payload: JwtPayload<CustomPayload> | string;
  signature: string;
};

export type JWTVeryfyOptions = {
  verifyIss?: string;
  verifySub?: string;
  verifyExp?: boolean;
  verifyNbf?: boolean;
  expLeeway?: number;
  nbfLeeway?: number;
};

export class JWT<CustomPayload extends Record<string, unknown>> {
  #alg: JwtAlgorithm;
  #algorithm: JwtAlgorithmEnum;
  #privateKey: string;
  #publicKey: string;
  #asymetric: boolean = false;

  get alg(): JwtAlgorithm {
    return this.#alg;
  }

  get algorithm(): JwtAlgorithmEnum {
    return this.#algorithm;
  }

  get asymetric(): boolean {
    return this.#asymetric;
  }

  static create<CustomPayload extends Record<string, unknown>>(
    secret: string | undefined,
    alg: JwtAlgorithm = "HS256"
  ): JWT<CustomPayload> {
    return new JWT<CustomPayload>(secret, secret, alg, false);
  }

  static createAsymetric<CustomPayload extends Record<string, unknown>>(
    privateKey: string | undefined,
    publicKey: string | undefined,
    alg: JwtAlgorithm = "HS256"
  ): JWT<CustomPayload> {
    return new JWT<CustomPayload>(privateKey, publicKey, alg, true);
  }

  private constructor(
    privateKey: string | undefined,
    publicKey: string | undefined,
    alg: JwtAlgorithm = "HS512",
    asymetric: boolean
  ) {
    if (!privateKey) {
      throw new RouterError("null JWT private key");
    }
    if (!publicKey) {
      throw new RouterError("null JWT public key");
    }
    if (!ValidJwtAlgorithms.has(alg)) {
      throw new RouterError("Invalid or unsupported JWT algorithm");
    }
    this.#alg = alg;
    this.#algorithm = JwtAlgorithmEnum[alg];
    this.#privateKey = privateKey;
    this.#publicKey = publicKey;
    this.#asymetric = asymetric;
  }

  sign(payload: JwtPayload<CustomPayload>): string | undefined {
    const alg = this.#alg;
    if (!ValidJwtAlgorithms.has(alg)) return;
    const algorithm = this.#algorithm;
    const header = Buffer.from(JSON.stringify({ typ: "JWT", alg })).toString(
      "base64url"
    );
    const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
    const dataToSign = `${header}.${body}`;
    const signature = this.#asymetric
      ? sign(algorithm, Buffer.from(dataToSign), this.#privateKey).toString(
          "base64url"
        )
      : createHmac(algorithm, this.#privateKey)
          .update(dataToSign)
          .digest("base64url");
    return `${dataToSign}.${signature}`;
  }

  verifySignature(token: string): boolean {
    const [header, body, signature] = token.split(".");
    if (!(header && body && signature)) return false;
    const { typ, alg } = JSON.parse(
      Buffer.from(header, "base64url").toString()
    );
    if (typ !== "JWT" || !ValidJwtAlgorithms.has(alg)) return false;
    const algorithm = JwtAlgorithmEnum[alg as JwtAlgorithm];
    const dataToSign = `${header}.${body}`;
    return this.#asymetric
      ? verify(
          algorithm,
          Buffer.from(dataToSign),
          this.#publicKey,
          Buffer.from(signature, "base64url")
        )
      : createHmac(algorithm, this.#publicKey)
          .update(dataToSign)
          .digest("base64url") === signature;
  }

  verify(token: string, options?: JWTVeryfyOptions): boolean {
    const [header, body, signature] = token.split(".");
    if (!(header && body && signature)) return false;
    const { typ, alg } = JSON.parse(
      Buffer.from(header, "base64url").toString()
    );
    if (typ !== "JWT" || !ValidJwtAlgorithms.has(alg)) return false;
    const algorithm = JwtAlgorithmEnum[alg as JwtAlgorithm];
    const dataToSign = `${header}.${body}`;
    const signatureMatch = this.#asymetric
      ? verify(
          algorithm,
          Buffer.from(dataToSign),
          this.#publicKey,
          Buffer.from(signature, "base64url")
        )
      : createHmac(algorithm, this.#publicKey)
          .update(dataToSign)
          .digest("base64url") === signature;
    if (!signatureMatch) return false;
    const payload = JSON.parse(Buffer.from(body, "base64url").toString());
    const now = Math.floor(Date.now() / 1000);
    if (options?.verifyExp && payload.exp + (options?.expLeeway ?? 0) < now) {
      return false;
    }
    if (options?.verifyNbf && payload.nbf - (options?.nbfLeeway ?? 0) > now) {
      return false;
    }
    if (options?.verifyIss && payload.iss !== options.verifyIss) {
      return false;
    }
    if (options?.verifySub && payload.sub !== options.verifySub) {
      return false;
    }
    return true;
  }

  decode(
    token: string,
    options?: JWTVeryfyOptions
  ): JwtPayload<CustomPayload> | undefined {
    const [header, body, signature] = token.split(".");
    if (!(header && body && signature)) return;
    const { typ, alg } = JSON.parse(
      Buffer.from(header, "base64url").toString()
    );
    if (typ !== "JWT" || !ValidJwtAlgorithms.has(alg)) return;
    const algorithm = JwtAlgorithmEnum[alg as JwtAlgorithm];
    const dataToSign = `${header}.${body}`;
    const signatureMatch = this.#asymetric
      ? verify(
          algorithm,
          Buffer.from(dataToSign),
          this.#publicKey,
          Buffer.from(signature, "base64url")
        )
      : createHmac(algorithm, this.#publicKey)
          .update(dataToSign)
          .digest("base64url") === signature;
    if (!signatureMatch) return;
    const payload = JSON.parse(Buffer.from(body, "base64url").toString());
    const now = Math.floor(Date.now() / 1000);
    if (options?.verifyExp && payload.exp + (options?.expLeeway ?? 0) < now) {
      return;
    }
    if (options?.verifyNbf && payload.nbf - (options?.nbfLeeway ?? 0) > now) {
      return;
    }
    if (options?.verifyIss && payload.iss !== options.verifyIss) {
      return;
    }
    if (options?.verifySub && payload.sub !== options.verifySub) {
      return;
    }
    return payload;
  }
}
