/**
 * File: src/util/index.ts
 *
 * Utility functions for splitting and joining HTTP method/path strings, and other helpers.
 *
 * Used by the router and other modules for parsing and manipulating route definitions.
 */

import { REQUEST_METHODS_LIST, REQUEST_METHODS_SET } from "../defs.ts";
import { RouterError } from "../error.ts";
import type { PathParts, RequestMethod } from "../types.ts";

/**
 * @param methodPath `METHOD[|METHOD2|...] PATH[;PATH2;/base/a,b:res/...;...]`
 * @returns array of given methods and all possible sets of paths.
 */
export function splitMethodPath(
  methodPath: string
): [Array<RequestMethod>, Array<PathParts>] {
  const spaceIdx = methodPath.indexOf(" ");
  if (spaceIdx === -1) {
    throw new RouterError(`invalid (method path) ${methodPath}`);
  }
  const methodsStr = methodPath.substring(0, spaceIdx).trim();
  const pathStr = methodPath.substring(spaceIdx);
  const methods = (
    methodsStr === "*" ? REQUEST_METHODS_LIST : methodsStr.split("|")
  )
    .filter(Boolean)
    .map((m) => m.toUpperCase()) as Array<RequestMethod>;
  for (const method of methods) {
    if (!REQUEST_METHODS_SET.has(method)) {
      throw new RouterError(`invalid method ${method}`);
    }
  }
  const paths = splitPath(pathStr);
  // validate
  if (methods.length < 1) {
    throw new RouterError(`method required ${methodPath}`);
  }
  for (const method of methods) {
    if (!REQUEST_METHODS_SET.has(method)) {
      throw new RouterError(`invalid method \`${method}\``);
    }
  }
  if (paths.length < 1) {
    throw new RouterError(`path required ${methodPath}`);
  }
  return [methods, paths];
}

export function splitPath(path: string) {
  const paths_ = path
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean) as Array<string>;
  const paths = splitPathRecursive(paths_);
  return paths;
}

export function splitPathRecursive(paths_: Array<string>) {
  const paths: Array<PathParts> = [];
  for (const path of paths_) {
    const parts = path.split("/").filter(Boolean);
    const distPaths: Array<PathParts> = [[]];
    for (let i = 0; i < parts.length; i++) {
      let part = parts[i];
      const distPathsLen = distPaths.length;
      let paramId = undefined;
      if (part.includes(":")) {
        [part, paramId] = part.split(":", 2).map((p) => p.trim());
      }
      if (part) {
        const subParts = part.split("|");
        for (let k = 0; k < distPathsLen; k++) {
          for (let j = 1; j < subParts.length; j++) {
            const subPart = subParts[j];
            distPaths.push([...distPaths[k], [subPart, paramId]]);
          }
          if (subParts[0] != null) distPaths[k].push([subParts[0], paramId]);
        }
      } else {
        part = "*";
        for (const distPath of distPaths) distPath.push([part, paramId]);
      }
    }
    for (const distPath of distPaths) {
      paths.push(distPath.length === 0 ? [["", undefined]] : distPath);
    }
  }
  return paths;
}

export function joinPath(basePath: string, methodPath: string) {
  const spaceIdx = methodPath.indexOf(" ");
  if (spaceIdx === -1) {
    throw new RouterError(`invalid (method path) ${methodPath}`);
  }
  const methodsStr = methodPath.substring(0, spaceIdx).trim();
  const pathStr = methodPath.substring(spaceIdx);
  const basePaths = basePath
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean) as Array<string>;
  const paths = pathStr
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean) as Array<string>;
  const newPaths = [];
  for (const basepath of basePaths) {
    const bp = trimEnd(basepath, "/");
    for (const path of paths) {
      newPaths.push(bp + path);
    }
  }
  const newMethodPath = `${methodsStr} ${newPaths.join(",")}`;
  return newMethodPath;
}

export function trimEnd(text: string, char: string) {
  return text.endsWith(char) ? text.slice(0, -1) : text;
}

export function methodColor(method: string) {
  switch (method) {
    case "GET":
      return "color:darkmagenta";
    case "POST":
      return "color:lime";
    case "PUT":
      return "color:yellow";
    case "PATCH":
      return "color:green";
    case "DELETE":
      return "color:red";
    case "HEAD":
      return "color:darkcyan";
    case "OPTIONS":
      return "color:cyan";
    default:
      return "color:default";
  }
}

export function statusColor(statusCode: number) {
  if (statusCode < 200) return "color:default";
  else if (statusCode < 300) return "color:lightgreen";
  else if (statusCode < 400) return "color:lightblue";
  else if (statusCode < 500) return "color:orange";
  else if (statusCode < 600) return "color:red";
  return "color:default";
}
