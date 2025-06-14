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

export type Handler<UserData extends Record<string, unknown>> = {
  (this: Router<UserData>, pr: ProcessedRequest & UserData):
    | Response
    | Promise<Response>
    | Promise<void>
    | Promise<Response | void>
    | void;
};
