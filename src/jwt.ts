import { sign, verify, type JwtPayload } from "npm:jsonwebtoken@9.0.2";

export enum JWTStatus {
  ERROR = -1,
  VALID = 0,
  EXPIRED = 1,
  NOT_YET = 2,
  INVALID = 3,
}

export type JWTAlgorithm =
  | "HS256"
  | "HS384"
  | "HS512"
  | "RS256"
  | "RS384"
  | "RS512";
export type JWTResult = {
  payload: JwtPayload | null;
  status: JWTStatus;
  error?: Error;
};

type JWTVerifyPredicate = (payload: JwtPayload) => boolean;

export type JWTVerifyOptions = {
  expLeeway?: number;
  nbfLeeway?: number;
  audience?: string;
  predicates?: JWTVerifyPredicate[];
};

export class JWT {
  algorithm: JWTAlgorithm;
  secret: string;

  constructor(secret: string, algorithm: JWTAlgorithm = "HS256") {
    this.algorithm = algorithm;
    this.secret = secret;
  }

  sign(payload: object): string {
    return sign(payload, this.secret, { algorithm: this.algorithm });
  }

  verify(token: string, options: JWTVerifyOptions = {}): JWTResult {
    try {
      const payload = verify(token, this.secret, {
        algorithms: [this.algorithm],
        audience: options.audience,
      }) as JwtPayload;
      const currentTime = Math.floor(Date.now() / 1000);
      // Check expiration (`exp`)
      if (payload.exp && payload.exp + (options.expLeeway || 0) < currentTime) {
        return { payload: null, status: JWTStatus.EXPIRED };
      }
      // Check "not before" (`nbf`)
      if (payload.nbf && payload.nbf > currentTime + (options.nbfLeeway || 0)) {
        return { payload: null, status: JWTStatus.NOT_YET };
      }
      // Custom predicates (extra validation)
      if (options.predicates) {
        for (const predicate of options.predicates) {
          if (!predicate(payload)) {
            return { payload: null, status: JWTStatus.INVALID };
          }
        }
      }
      return { payload, status: JWTStatus.VALID };
    } catch (error) {
      return { payload: null, status: JWTStatus.ERROR, error: error as Error };
    }
  }
}
