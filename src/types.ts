import type ProcessedRequest from "./processed-request.ts";
import type { Router } from "./router.ts";

export type InsecureProtocols = "http" | "ws";
export type SecureProtocols = "https" | "wss";

export type RequestMethod =
  | "HEAD"
  | "OPTIONS"
  | "GET"
  | "POST"
  | "PUT"
  | "PATCH"
  | "DELETE";

export type RouteTypes = "filter" | "hook" | "handler" | "fallback" | "catcher";

export type TextContentTypes = `text/${
  | "plain"
  | "html"
  | "css"
  | "javascript"
  | "csv"
  | "xml"}`;
export type ApplicationContentTypes = `application/${
  | "json"
  | "x-www-form-urlencoded"
  | "xml"
  | "pdf"
  | "zip"
  | "octet-stream"
  | "graphql"
  | "ld+json"}`;
export type ImageContentTypes = `image/${
  | "jpeg"
  | "png"
  | "gif"
  | "webp"
  | "svg+xml"}`;
export type AudioContentTypes = `audio/${"mpeg" | "ogg" | "wav"}`;
export type VideoContentTypes = `video/${"mp4" | "ogg" | "webm"}`;
export type MultipartContentTypes = "multipart/form-data";

export type ContentTypeCategories =
  | "text"
  | "application"
  | "image"
  | "audio"
  | "video"
  | "multipart";

export type ContentTypes =
  | TextContentTypes
  | ApplicationContentTypes
  | ImageContentTypes
  | AudioContentTypes
  | VideoContentTypes
  | MultipartContentTypes;

export type Content = {
  type: ContentTypes;
  length: number;
  boundary?: string;
} & Record<string, string>;

export type PathParts = Array<[string, string | undefined]>;
export type HandlerResult =
  | Response
  | Promise<Response>
  | Promise<Response | undefined | void>
  | undefined
  | void;
export type Handler<UserData extends Record<string, unknown>> = (
  this: Router<UserData>,
  pr: ProcessedRequest & UserData
) => HandlerResult;

export type HashAlgorithm =
  | "RSA-MD4"
  | "RSA-MD5"
  | "RSA-RIPEMD160"
  | "RSA-SHA1"
  | "RSA-SHA1-2"
  | "RSA-SHA224"
  | "RSA-SHA256"
  | "RSA-SHA3-224"
  | "RSA-SHA3-256"
  | "RSA-SHA3-384"
  | "RSA-SHA3-512"
  | "RSA-SHA384"
  | "RSA-SHA512"
  | "RSA-SHA512/224"
  | "RSA-SHA512/256"
  | "RSA-SM3"
  | "blake2b512"
  | "blake2s256"
  | "id-rsassa-pkcs1-v1_5-with-sha3-224"
  | "id-rsassa-pkcs1-v1_5-with-sha3-256"
  | "id-rsassa-pkcs1-v1_5-with-sha3-384"
  | "id-rsassa-pkcs1-v1_5-with-sha3-512"
  | "md4"
  | "md4WithRSAEncryption"
  | "md5"
  | "md5-sha1"
  | "md5WithRSAEncryption"
  | "ripemd"
  | "ripemd160"
  | "ripemd160WithRSA"
  | "rmd160"
  | "sha1"
  | "sha1WithRSAEncryption"
  | "sha224"
  | "sha224WithRSAEncryption"
  | "sha256"
  | "sha256WithRSAEncryption"
  | "sha3-224"
  | "sha3-256"
  | "sha3-384"
  | "sha3-512"
  | "sha384"
  | "sha384WithRSAEncryption"
  | "sha512"
  | "sha512-224"
  | "sha512-224WithRSAEncryption"
  | "sha512-256"
  | "sha512-256WithRSAEncryption"
  | "sha512WithRSAEncryption"
  | "shake128"
  | "shake256"
  | "sm3"
  | "sm3WithRSAEncryption"
  | "ssl3-md5"
  | "ssl3-sha1";

export type SecureHashNodeAlgorithm =
  | "sha256"
  | "sha384"
  | "sha512"
  | "RSA-SHA256"
  | "RSA-SHA384"
  | "RSA-SHA512"
  | "sha3-256"
  | "sha3-384"
  | "sha3-512";

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
 *
 * - **ECDSA-Based (Asymmetric, Efficient)**: Faster than RSA, great for modern applications.
 *   - ES256: Recommended alternative to RSA.
 *   - ES384: Stronger cryptographic security.
 *   - ES512: Best for ultra-secure environments.
 */
export type SecureHashAlgorithm =
  | "HS256"
  | "HS384"
  | "HS512"
  | "RS256"
  | "RS384"
  | "RS512"
  | "ES256"
  | "ES384"
  | "ES512";

export enum SecureHashAlgorithmEnum {
  HS256 = "sha256",
  HS384 = "sha384",
  HS512 = "sha512",
  RS256 = "RSA-SHA256",
  RS384 = "RSA-SHA384",
  RS512 = "RSA-SHA512",
  ES256 = "sha3-256",
  ES384 = "sha3-384",
  ES512 = "sha3-512",
}
