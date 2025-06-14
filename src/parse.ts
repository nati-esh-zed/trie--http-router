import type { ProcessedRequest } from "./processed-request.ts";
import type { Handler } from "./types.ts";
import {
  parseCookieFromHeader,
  type ParseCookieOptions,
} from "./util/cookie.ts";
import { defaultCookieDecoder } from "./util/cookie.ts";

function cookie<UserData extends Record<string, unknown>>(
  options?: ParseCookieOptions
): Handler<UserData> {
  const secret = options?.secret;
  const decode = options?.decode || defaultCookieDecoder;
  return function (pr: ProcessedRequest) {
    const cookieHeader = pr.request.headers.get("cookie");
    if (cookieHeader) {
      if (pr.cookies == null) pr.cookies = {};
      const cookie = parseCookieFromHeader(cookieHeader, { secret, decode });
      for (const [key, value] of cookie) pr.cookies[key] = value;
    }
  };
}

export const parse = {
  cookie,
};

export default parse;
