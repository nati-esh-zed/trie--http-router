const SEMICOLON_CODE = encodeURIComponent(";");

export type CookieValue = string | Date | number | boolean | null;

export type Cookie = {
  value: CookieValue;
} & Record<string, CookieValue>;

export type CookieEncoder = { (val: CookieValue): string };
export type CookieDecoder = { (val: string): CookieValue };

export interface CookieOptions {
  expires?: Date | number | string;
  maxAge?: number;
  domain?: string;
  path?: string;
  secure?: boolean;
  httpOnly?: boolean;
  sameSite?: "Strict" | "LAX" | "None";
}

export interface ClearCookieOptions {
  domain?: string;
  path?: string;
}

export type ParseCookieOptions = {
  select?: string[];
  decode?: CookieDecoder;
};

export function splitCookieKeyValue(cookie: string) {
  const i_ = cookie.indexOf("=");
  const i = i_ === -1 ? cookie.length : i_;
  const key = cookie.substring(0, i);
  const value = cookie.substring(i + 1);
  return [key, value];
}

export function parseCookieFromHeader(
  cookieHeader: string,
  options?: ParseCookieOptions
): Array<[string, CookieValue]> {
  const select = options?.select;
  const decode = options?.decode;
  const cookies = cookieHeader.split(";").map((ckPair) => {
    const [key, value] = splitCookieKeyValue(ckPair.trim());
    const value_ = value.replaceAll(SEMICOLON_CODE, ";");
    const decodedValue = decode ? decode(value_) : value_;
    return [key, decodedValue];
  }) as Array<[string, CookieValue]>;
  return select ? cookies.filter(([key]) => select.includes(key)) : cookies;
}

export function parseCookieOption(key: string, val: unknown) {
  switch (key) {
    case "expires":
      return `Expires="${(val instanceof Date
        ? val
        : new Date(val as number | string)
      ).toUTCString()}"`;
    case "maxAge":
      return `Max-Age=${val}`;
    case "domain":
      return `Domain=${val}`;
    case "path":
      return `Path=${val}`;
    case "secure":
      return val ? "Secure" : "";
    case "httpOnly":
      return val ? "HttpOnly" : "";
    case "sameSite":
      return `SameSite=${val}`;
    default:
      return `${key}=${val}`;
  }
}

export function setCookie(
  headers: Headers,
  name: string,
  value: CookieValue,
  options?: CookieOptions,
  cookieEncoder?: CookieEncoder
) {
  const encode = cookieEncoder;
  const optionStr = !options
    ? "Path=/"
    : Object.entries(options)
        .map(([key, val]) => parseCookieOption(key, val))
        .join("; ");
  const encodedValue = (
    encode ? encode(value) : value?.toString() || ""
  ).replaceAll(";", SEMICOLON_CODE);
  const cookieHeader = `${name}=${encodedValue}; ${optionStr}`;
  headers.append("Set-Cookie", cookieHeader);
}

export function clearCookie(
  headers: Headers,
  name: string,
  options?: ClearCookieOptions
) {
  const optionStr = !options
    ? "Path=/"
    : Object.entries(options)
        .map(([key, val]) => parseCookieOption(key, val))
        .join("; ");
  const epoch = new Date(0).toUTCString();
  const cookieHeader = `${name}=; Expires=${epoch}; ${optionStr}`;
  headers.append("Set-Cookie", cookieHeader);
}

export function clearCookies(
  request: Request,
  headers: Headers,
  options?: ClearCookieOptions
) {
  const optionStr = !options
    ? "Path=/"
    : Object.entries(options)
        .map(([key, val]) => parseCookieOption(key, val))
        .join("; ");
  const reqCookieHeader = request.headers.get("cookie");
  if (reqCookieHeader) {
    const epoch = new Date(0).toUTCString();
    const cookies = parseCookieFromHeader(reqCookieHeader);
    for (const [name] of cookies) {
      const cookieHeader = `${name}=; Expires=${epoch}; ${optionStr}`;
      headers.append("Set-Cookie", cookieHeader);
    }
  }
}

export function defaultCookieEncoder(val: CookieValue): string {
  if (typeof val === "string") return `"${val}"`;
  else if (typeof val === "number") return val.toString();
  else if (typeof val === "boolean") return val ? "true" : "false";
  else if (val instanceof Date) return "Date" + JSON.stringify(val);
  else if (val == null) return "null";
  return val;
}

export function defaultCookieDecoder(val: string): CookieValue {
  const dateStringMatch = val.match(/^(Date)?"(.*)"$/);
  if (dateStringMatch) {
    return dateStringMatch[1]
      ? new Date(dateStringMatch[2])
      : dateStringMatch[2];
  } else if (/^true|false$/.test(val)) return val === "true";
  else if (/^null$/.test(val)) return null;
  if (/^\d*(?:\.\d+)?$/.test(val)) return Number(val);
  return val;
}
