/**
 * File: src/validators.ts
 *
 * Request query and body validation utilities for HTTP handlers.
 *
 * Provides helpers for validating and extracting query parameters and request bodies.
 */

import { CATEGORIZED_CONTENT_TYPES } from "./defs.ts";
import { StatusCode } from "./index.ts";
import type { ProcessedRequest } from "./processed-request.ts";
import type { ContentTypeCategories, ContentTypes, Handler } from "./types.ts";

export interface QueryValidatorOptions {
  strict?: boolean;
}

export function query<UserData extends Record<string, unknown>>(
  queryPattern: string,
  options?: BodyValidatorOptions
): Handler<UserData> {
  const strict = Boolean(options?.strict);
  const querySpecs = new Map(
    queryPattern.split(",").map((qp) => {
      const [qName, optional] = qp.split("?").map((p) => p.trim());
      return [qName, optional != null];
    })
  );
  const nqOptional = querySpecs.values().reduce((ac, v) => (v ? ac + 1 : 0), 0);
  const allQueriesOptional = nqOptional === querySpecs.size;
  return async (pr: ProcessedRequest) => {
    const query = await pr.query();
    if (query == null) {
      if (allQueriesOptional) {
        return;
      } else {
        return pr.json({ error: `query required` }, StatusCode.BadRequest);
      }
    }
    for (const [qName, optional] of querySpecs.entries()) {
      if (!optional && query && query[qName] == null) {
        return pr.json(
          { error: `missing required query entry \`${qName}\`` },
          StatusCode.BadRequest
        );
      }
    }
    if (strict) {
      for (const qName of Object.keys(query)) {
        if (!querySpecs.has(qName)) {
          return pr.json(
            { error: `query entry \`${qName}\` rejected` },
            StatusCode.BadRequest
          );
        }
      }
    }
  };
}

export interface BodyValidatorOptions {
  strict?: boolean;
}

export function body<UserData extends Record<string, unknown>>(
  bodyPattern: string,
  options?: BodyValidatorOptions
): Handler<UserData> {
  const strict = Boolean(options?.strict);
  const bodySpecs = new Map(
    bodyPattern.split(",").map((qp) => {
      const [beName, optional] = qp.split("?").map((p) => p.trim());
      return [beName, optional != null];
    })
  );
  const nbOptional = bodySpecs.values().reduce((ac, v) => (v ? ac + 1 : 0), 0);
  const allPropsOptional = nbOptional === bodySpecs.size;
  return async (pr: ProcessedRequest) => {
    const body = await pr.body();
    if (body == null) {
      if (allPropsOptional) {
        return;
      } else {
        return pr.json({ error: `body required` }, StatusCode.BadRequest);
      }
    }
    for (const [bName, optional] of bodySpecs.entries()) {
      if (!optional && body && body[bName] == null) {
        return pr.json(
          { error: `missing required body entry \`${bName}\`` },
          StatusCode.BadRequest
        );
      }
    }
    if (strict) {
      for (const bName of Object.keys(body)) {
        if (!bodySpecs.has(bName)) {
          return pr.json(
            { error: `body entry \`${bName}\` rejected` },
            StatusCode.BadRequest
          );
        }
      }
    }
  };
}

export type ValidationContentTypes = ContentTypeCategories | ContentTypes;

export interface ContentValidatorOptions {
  minLength?: number;
  maxLength?: number;
}

export function content<UserData extends Record<string, unknown>>(
  contentTypes: ValidationContentTypes | Array<ValidationContentTypes>,
  options?: ContentValidatorOptions
): Handler<UserData> {
  const minLength = options?.minLength;
  const maxLength = options?.maxLength;
  const contentTypes_ = Array.isArray(contentTypes)
    ? contentTypes
    : [contentTypes];
  const contentTypesSet = new Set();
  for (const contentType of contentTypes_) {
    if (CATEGORIZED_CONTENT_TYPES[contentType as ContentTypeCategories]) {
      const catContentTypes =
        CATEGORIZED_CONTENT_TYPES[contentType as ContentTypeCategories];
      for (const catContentType of catContentTypes.keys()) {
        contentTypesSet.add(catContentType);
      }
    } else {
      contentTypesSet.add(contentType);
    }
  }
  return (pr: ProcessedRequest) => {
    if (pr.content?.type == null) {
      return pr.json({ error: `content required` }, StatusCode.BadRequest);
    }
    if (!contentTypesSet.has(pr.content?.type)) {
      return pr.json({ error: `content type rejected` }, StatusCode.BadRequest);
    }
    if (minLength && pr.content.length < minLength) {
      return pr.json(
        { error: `content length underflow` },
        StatusCode.BadRequest
      );
    }
    if (maxLength && pr.content.length > maxLength) {
      return pr.json(
        { error: `content length overflow` },
        StatusCode.BadRequest
      );
    }
  };
}

export function noContent<
  UserData extends Record<string, unknown>
>(): Handler<UserData> {
  return (pr: ProcessedRequest) => {
    if (
      pr.content?.type != null ||
      (pr.content?.length && pr.content?.length > 0)
    ) {
      return pr.json(
        { error: `content/body not allowed` },
        StatusCode.BadRequest
      );
    }
  };
}

export function noQuery<
  UserData extends Record<string, unknown>
>(): Handler<UserData> {
  return (pr: ProcessedRequest) => {
    if (pr.url.searchParams.size > 0) {
      return pr.json({ error: `query not allowed` }, StatusCode.BadRequest);
    }
  };
}

export const validate = {
  query,
  body,
  content,
  noQuery,
  noContent,
};

export default validate;
