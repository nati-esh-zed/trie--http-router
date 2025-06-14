import type { RequestLoggerFn } from "../index.ts";
import { methodColor, statusColor } from "./index.ts";

/**
 * Logs requests via the specified logger function.
 *
 * @param loggerFn Logger function. such as console.log
 * @returns
 */
export function requestLogger(
  loggerFn: (...args: unknown[]) => void
): RequestLoggerFn {
  return function ({ processedRequest, responseTime, status, statusText }) {
    loggerFn(
      `%c${(processedRequest.time * 1e6).toFixed(0)} %c${
        processedRequest.method
      } ${
        processedRequest.url.href
      } %c${status} ${statusText} %c${responseTime.toFixed(3)} -- %c${
        processedRequest.clientAddress
      }:${processedRequest.clientPort}`,
      "color:gray",
      methodColor(processedRequest.method),
      statusColor(status),
      "color:gray",
      "color:gray"
    );
  } as RequestLoggerFn;
}
