import {
  compileFile,
  type Options,
} from "https://deno.land/x/pug@v0.1.6/mod.ts";
import type RenderEngine from "../../render-engine.ts";

export type PugEngineOptions = Omit<Options, "filename"> & {
  extension?: string;
};

export class PugEngine implements RenderEngine {
  baseDir: string;
  extension: string;

  constructor(
    public options?: PugEngineOptions,
    public locals?: Record<string, unknown>
  ) {
    this.baseDir = this.options?.basedir || "pug";
    this.extension = this.options?.extension || ".pug";
  }

  render(
    filePath: string,
    locals?: Record<string, unknown>
  ): string | undefined {
    locals = { ...this.locals, ...locals };
    const filename = this.baseDir + "/" + filePath + this.extension;
    const compiledTemplate = compileFile(filename, {
      filename,
      ...this.options,
    });
    return compiledTemplate(locals);
  }
}

export default PugEngine;
