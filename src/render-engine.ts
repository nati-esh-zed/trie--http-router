export abstract class RenderEngine {
  constructor() {}

  abstract render(
    filePath: string,
    locals?: Record<string, unknown>
  ): string | undefined;
}

export default RenderEngine;
