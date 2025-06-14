import type ProcessedRequest from "./processed-request.ts";
import type { HandlerResult } from "./types.ts";

export abstract class RenderEngine {
  constructor() {}

  abstract render(
    filePath: string,
    processedRequest: ProcessedRequest,
    locals?: Record<string, unknown>
  ): HandlerResult;
}

export default RenderEngine;
