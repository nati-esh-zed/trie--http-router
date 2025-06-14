/**
 * File: src/handlers.ts
 *
 * HTTP request handler utilities for serving static files and other resources.
 *
 * Provides main handler functions for use in the router.
 */

import { checkFileSync, fileExtension } from "./util/file.ts";
import { EXT_CONTENT_TYPE_MAP } from "./defs.ts";
import { compress } from "./util/crypto.ts";
import type { ProcessedRequest } from "./processed-request.ts";
import { StatusCode } from "./index.ts";
import type { Handler } from "./types.ts";

export type HandleStaticFilesOptions = {
  path?: string;
  indexFiles?: Array<string>;
  extensions?: Array<string>;
  cache?: boolean;
  eTag?: boolean;
  // mtime?: Date;
  compressionTreshold?: number;
};

export function staticFiles<UserData extends Record<string, unknown>>(
  options?: HandleStaticFilesOptions
): Handler<UserData> {
  const cache = new Map();
  const rootPath = options?.path || "./public";
  const indexFiles = options?.indexFiles;
  const extensions = options?.extensions;
  const cacheFiles = Boolean(options?.cache);
  const useETag = Boolean(options?.eTag);
  const compressionTreshold = options?.compressionTreshold;

  return async (pr: ProcessedRequest) => {
    const acceptEncoding = pr.request.headers.get("Accept-Encoding") || "";
    let cacheHit = cacheFiles && cache.get(pr.url.pathname);
    let fileContent;
    let contentType;
    let compressed: Record<string, Uint8Array | undefined> = {};
    let eTag = undefined;
    // let cacheControl = undefined;
    // pr.headers.set("content-encoding", "");
    if (cacheHit) {
      fileContent = cacheHit.fileContent;
      // check for modification
      const filePath = cacheHit.filePath;
      const fileStats = checkFileSync(filePath);
      // file deleted
      if (!fileStats?.isFile) {
        pr.status(StatusCode.NotFound);
        return;
      }
      const mtime = cacheHit.mtime;
      const curMtime = fileStats.mtime;
      const modified = curMtime?.getTime() !== mtime.getTime();
      if (
        modified ||
        (useETag && eTag != `"${fileStats.size}-${curMtime?.getTime()}"`)
      ) {
        fileContent = undefined;
        delete cacheHit.fileContent;
        delete cacheHit.compressed;
        delete cacheHit.contentType;
        cacheHit = undefined;
      } else {
        compressed = cacheHit.compressed;
        contentType = cacheHit.contentType;
        eTag = useETag && cacheHit.eTag;
      }
      // cacheControl = cacheHit.cacheControl;
    }
    if (!cacheHit) {
      const basePath = rootPath + decodeURIComponent(pr.url.pathname);
      let filePath = basePath;
      let fileStats = checkFileSync(filePath);
      if (fileStats?.isDirectory) {
        // check for index files
        if (indexFiles != null) {
          for (const indexFile of indexFiles) {
            filePath = basePath + "/" + indexFile;
            fileStats = checkFileSync(filePath);
            if (fileStats?.isFile) break;
          }
        }
      } else if (!fileStats?.isFile) {
        // append extension and try again
        if (extensions != null) {
          for (const ext of extensions) {
            filePath = basePath + "." + ext;
            fileStats = checkFileSync(filePath);
            if (fileStats?.isFile) break;
          }
        }
      }
      if (!fileStats?.isFile) {
        pr.status(StatusCode.NotFound);
        return;
      }
      fileContent = Deno.readFileSync(filePath);
      const fileExt = fileExtension(filePath);
      const mtime = fileStats.mtime;
      contentType =
        EXT_CONTENT_TYPE_MAP.get(fileExt) || "application/octet-stream";
      eTag = useETag && `"${fileStats.size}-${mtime?.getTime()}"`;
      // cacheControl = cacheFiles
      //   ? "public, max-age=31536000, immutable"
      //   : "no-store";
      if (cacheFiles) {
        cache.set(pr.url.pathname, {
          filePath,
          fileContent,
          compressed,
          contentType,
          eTag,
          mtime,
          // cacheControl,
        });
      }
    }
    // Check for If-None-Match to handle 304 Not Modified
    if (useETag) {
      const ifNoneMatch = pr.request.headers.get("If-None-Match");
      if (ifNoneMatch && ifNoneMatch === eTag) {
        return pr.end(StatusCode.NotModified, true);
      }
    }
    const smallestEncoding = {
      name: "",
      content: fileContent,
    };
    if (!compressionTreshold || fileContent.byteLength >= compressionTreshold) {
      if (acceptEncoding.includes("gzip")) {
        if (!compressed.gzip) {
          compressed.gzip = await compress(fileContent, "gzip");
        }
        smallestEncoding.content = compressed.gzip;
        smallestEncoding.name = "gzip";
      }
      if (acceptEncoding.includes("deflate")) {
        if (!compressed.deflate) {
          compressed.deflate = await compress(fileContent, "deflate");
        }
        if (
          compressed.deflate &&
          compressed.deflate.byteLength < smallestEncoding.content.byteLength
        ) {
          smallestEncoding.content = compressed.deflate;
          smallestEncoding.name = "deflate";
        }
      }
      if (acceptEncoding.includes("br")) {
        if (!compressed.brotli) {
          compressed.brotli = await compress(fileContent, "brotli");
        }
        if (
          compressed.brotli &&
          compressed.brotli.byteLength < smallestEncoding.content.byteLength
        ) {
          smallestEncoding.content = compressed.brotli;
          smallestEncoding.name = "br";
        }
      }
      switch (smallestEncoding.name) {
        case "gzip":
        case "deflate":
        case "br":
          pr.headers.set("content-encoding", smallestEncoding.name);
          break;
      }
    }
    if (eTag) pr.headers.set("ETag", eTag);
    // if (cacheControl) pr.headers.set("Cache-Control", cacheControl);
    return pr.send(smallestEncoding.content, 200, contentType);
  };
}

export const handle = {
  staticFiles,
};

export default handle;
