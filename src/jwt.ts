import * as djwt from "https://deno.land/x/djwt@v3.0.2/mod.ts";

export enum JWTStatus {
  ERROR = -1,
  VALID = 0,
  EXPIRED = 1,
  NOT_YET = 2,
  INVALID = 3,
}

export type JWTAlgorithm = djwt.Header["alg"];
export type JWTHeader = djwt.Header;
export type JWTResult = {
  payload: djwt.Payload | null;
  status: JWTStatus;
  error?: Error;
};
export type JWTVerifyOptions = Omit<
  djwt.VerifyOptions,
  "ignoreExp" | "ignoreNbf"
>;

function identifyAlgorithm(alg: string) {
  switch (alg) {
    case "HS256":
      return { name: "HMAC", hash: "SHA-256" };
    case "HS384":
      return { name: "HMAC", hash: "SHA-384" };
    case "HS512":
      return { name: "HMAC", hash: "SHA-512" };
    case "RS256":
      return { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" };
    case "RS384":
      return { name: "RSASSA-PKCS1-v1_5", hash: "SHA-384" };
    case "RS512":
      return { name: "RSASSA-PKCS1-v1_5", hash: "SHA-512" };
    case "PS256":
      return { name: "RSA-PSS", hash: "SHA-256" };
    case "PS384":
      return { name: "RSA-PSS", hash: "SHA-384" };
    case "PS512":
      return { name: "RSA-PSS", hash: "SHA-512" };
    case "ES256":
      return { name: "ECDSA", hash: "SHA-256" };
    case "ES384":
      return { name: "ECDSA", hash: "SHA-384" };
    case "ES512":
      return { name: "ECDSA", hash: "SHA-512" };
    default:
      throw new Error(`Unsupported JWT algorithm: ${alg}`);
  }
}

export class JWT {
  algorithm: JWTAlgorithm;
  cryptoKey: CryptoKey;

  static getNumericDate(seconds: number): number {
    return djwt.getNumericDate(seconds);
  }

  static async create(secret: string, algorithm: JWTAlgorithm = "HS256") {
    const nameAndHash = identifyAlgorithm(algorithm);
    const cryptoKey = await crypto.subtle.importKey(
      "jwk",
      { kty: "oct", k: secret, alg: algorithm, use: "sig" },
      nameAndHash,
      false,
      ["sign", "verify"],
    );
    return new JWT(cryptoKey, algorithm);
  }

  constructor(cryptoKey: CryptoKey, algorithm: JWTAlgorithm = "HS256") {
    this.algorithm = algorithm;
    this.cryptoKey = cryptoKey;
  }

  sign(payload: djwt.Payload): Promise<string> {
    return djwt.create({ alg: this.algorithm }, payload, this.cryptoKey);
  }

  async verify(
    token: string,
    options: JWTVerifyOptions = {},
  ): Promise<JWTResult> {
    try {
      // Verify the signature
      const payload = await djwt.verify(token, this.cryptoKey, {
        ignoreExp: true,
        ignoreNbf: true,
        ...options,
      });
      const currentTime = djwt.getNumericDate(0);
      // Check for expiry
      if (payload.exp && payload.exp + (options.expLeeway || 0) < currentTime) {
        return { payload: null, status: JWTStatus.EXPIRED };
      }
      // Check for not before date
      if (payload.nbf && payload.nbf > currentTime + (options.nbfLeeway || 0)) {
        return { payload: null, status: JWTStatus.NOT_YET };
      }
      return { payload, status: JWTStatus.VALID };
    } catch (error) {
      return { payload: null, status: JWTStatus.ERROR, error: error as Error };
    }
  }
}
