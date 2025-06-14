import type {
  ApplicationContentTypes,
  AudioContentTypes,
  ContentTypeCategories,
  ContentTypes,
  ImageContentTypes,
  InsecureProtocols,
  MultipartContentTypes,
  RequestMethod,
  SecureProtocols,
  TextContentTypes,
  VideoContentTypes,
} from "./types.ts";

export const INSECURE_PROTOCOLS_LIST: Array<InsecureProtocols> = ["http", "ws"];

export const INSECURE_PROTOCOLS_SET: Set<InsecureProtocols> = new Set(
  INSECURE_PROTOCOLS_LIST
);

export const SECURE_PROTOCOLS_LIST: Array<SecureProtocols> = ["https", "wss"];

export const SECURE_PROTOCOLS_SET: Set<SecureProtocols> = new Set(
  SECURE_PROTOCOLS_LIST
);

export const REQUEST_METHODS_LIST: Array<RequestMethod> = [
  "HEAD",
  "OPTIONS",
  "GET",
  "POST",
  "PUT",
  "PATCH",
  "DELETE",
];

export const REQUEST_METHODS_SET: Set<RequestMethod> = new Set(
  REQUEST_METHODS_LIST
);

export type RequestMethodWithBody = Exclude<RequestMethod, "GET" | "HEAD">;

export const REQUEST_METHODS_WITH_BODY_LIST: Array<RequestMethodWithBody> = [
  "OPTIONS",
  "POST",
  "PUT",
  "PATCH",
  "DELETE",
];

export const REQUEST_METHODS_WITH_BODY_SET: Set<RequestMethodWithBody> =
  new Set(REQUEST_METHODS_WITH_BODY_LIST);

export const CONTENT_TYPE_CATEGORIES_LIST: Array<ContentTypeCategories> = [
  "text",
  "application",
  "image",
  "audio",
  "video",
  "multipart",
];

export const CONTENT_TYPE_CATEGORIES_SET: Set<ContentTypeCategories> = new Set(
  CONTENT_TYPE_CATEGORIES_LIST
);

export const TEXT_CONTENT_TYPES_LIST: Array<TextContentTypes> = [
  "text/plain",
  "text/html",
  "text/css",
  "text/javascript",
  "text/csv",
  "text/xml",
];

export const APPLICATION_CONTENT_TYPES_LIST: Array<ApplicationContentTypes> = [
  "application/json",
  "application/x-www-form-urlencoded",
  "application/xml",
  "application/pdf",
  "application/zip",
  "application/octet-stream",
  "application/graphql",
  "application/ld+json",
];

export const IMAGE_CONTENT_TYPES_LIST: Array<ImageContentTypes> = [
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "image/svg+xml",
];

export const AUDIO_CONTENT_TYPES_LIST: Array<AudioContentTypes> = [
  "audio/mpeg",
  "audio/ogg",
  "audio/wav",
];

export const VIDEO_CONTENT_TYPES_LIST: Array<VideoContentTypes> = [
  "video/mp4",
  "video/ogg",
  "video/webm",
];

export const MULTIPART_CONTENT_TYPES_LIST: Array<MultipartContentTypes> = [
  "multipart/form-data",
];

export const CONTENT_TYPES_LIST: Array<ContentTypes> = [
  ...TEXT_CONTENT_TYPES_LIST,
  ...APPLICATION_CONTENT_TYPES_LIST,
  ...IMAGE_CONTENT_TYPES_LIST,
  ...AUDIO_CONTENT_TYPES_LIST,
  ...VIDEO_CONTENT_TYPES_LIST,
  ...MULTIPART_CONTENT_TYPES_LIST,
];

export const TEXT_CONTENT_TYPES_SET: Set<TextContentTypes> = new Set(
  TEXT_CONTENT_TYPES_LIST
);

export const APPLICATION_CONTENT_TYPES_SET: Set<ApplicationContentTypes> =
  new Set(APPLICATION_CONTENT_TYPES_LIST);

export const IMAGE_CONTENT_TYPES_SET: Set<ImageContentTypes> = new Set(
  IMAGE_CONTENT_TYPES_LIST
);

export const AUDIO_CONTENT_TYPES_SET: Set<AudioContentTypes> = new Set(
  AUDIO_CONTENT_TYPES_LIST
);

export const VIDEO_CONTENT_TYPES_SET: Set<VideoContentTypes> = new Set(
  VIDEO_CONTENT_TYPES_LIST
);

export const MULTIPART_CONTENT_TYPES_SET: Set<MultipartContentTypes> = new Set(
  MULTIPART_CONTENT_TYPES_LIST
);

export const CONTENT_TYPES_SET: Set<ContentTypes> = new Set(CONTENT_TYPES_LIST);

export const CATEGORIZED_CONTENT_TYPES = {
  text: TEXT_CONTENT_TYPES_SET,
  application: APPLICATION_CONTENT_TYPES_SET,
  image: IMAGE_CONTENT_TYPES_SET,
  audio: AUDIO_CONTENT_TYPES_SET,
  video: VIDEO_CONTENT_TYPES_SET,
  multipart: MULTIPART_CONTENT_TYPES_SET,
};

export const EXT_CONTENT_TYPE_MAP: Map<string, string> = new Map([
  ["html", "text/html"],
  ["xhtml", "text/html"],
  ["htm", "text/html"],
  ["xhtm", "text/html"],
  ["css", "text/css"],
  ["js", "application/javascript"],
  ["json", "application/json"],
  ["png", "image/png"],
  ["jpg", "image/jpeg"],
  ["jpeg", "image/jpeg"],
  ["gif", "image/gif"],
  ["svg", "image/svg+xml"],
  ["ico", "image/x-icon"],
  ["pdf", "application/pdf"],
  ["xml", "application/xml"],
  ["txt", "text/plain"],
  ["csv", "text/csv"],
  ["mp4", "video/mp4"],
  ["webm", "video/webm"],
]);
