/**
 * File: src/router.ts
 *
 * HTTP router for registering, organizing, and handling routes, hooks, filters, and error handlers.
 *
 * Provides the main routing logic and request dispatch for the framework.
 */

import type {
  ContentTypes,
  Handler,
  RequestMethod,
  RouteTypes,
} from "./types.ts";
import { ProcessedRequest } from "./processed-request.ts";
import { StatusText } from "./status/text.ts";
import { joinPath, splitMethodPath } from "./util/index.ts";
import { PathTrie, type PathTrieNode } from "./util/path-trie.ts";
import { type HttpError, RouterError } from "./error.ts";
import { REQUEST_METHODS_SET } from "./defs.ts";
import { StatusCode } from "./index.ts";
import type RenderEngine from "./render-engine.ts";

function initRoutes<UserData extends Record<string, unknown>>(): Record<
  RequestMethod,
  PathTrie<UserData>
> {
  return {
    HEAD: new PathTrie(),
    OPTIONS: new PathTrie(),
    GET: new PathTrie(),
    POST: new PathTrie(),
    PUT: new PathTrie(),
    PATCH: new PathTrie(),
    DELETE: new PathTrie(),
  };
}
export type RouterEnginesType = {
  render?: RenderEngine;
};

export type RequestLoggerFn = (requestInfo: {
  processedRequest: ProcessedRequest;
  responseTime: number;
  status: number;
  statusText?: string;
}) => void;

export interface RouteLogParams {
  requests?: RequestLoggerFn;
}

export interface RouterParams {
  engines?: RouterEnginesType;
  log?: RouteLogParams;
  usingReverseProxy?: boolean;
}

export class Router<UserData extends Record<string, unknown>> {
  #routes: Record<RouteTypes, Record<RequestMethod, PathTrie<UserData>>> = {
    filter: initRoutes<UserData>(),
    hook: initRoutes<UserData>(),
    handler: initRoutes<UserData>(),
    fallback: initRoutes<UserData>(),
    catcher: initRoutes<UserData>(),
  };
  #engines: RouterEnginesType = {
    render: undefined,
  };
  #sets: Record<RouteTypes, Array<[string, Array<Handler<UserData>>]>> = {
    filter: [],
    hook: [],
    handler: [],
    fallback: [],
    catcher: [],
  };
  #options?: RouterParams;

  get options(): RouterParams | undefined {
    return this.#options;
  }

  get engines(): RouterEnginesType {
    return this.#engines;
  }

  get routes(): Record<RouteTypes, Record<RequestMethod, PathTrie<UserData>>> {
    return this.#routes;
  }

  get routeSets(): Record<
    RouteTypes,
    Array<[string, Array<Handler<UserData>>]>
  > {
    return this.#sets;
  }

  get routeTree(): Record<
    RouteTypes,
    Record<RequestMethod, PathTrieNode<UserData>>
  > {
    return Object.fromEntries(
      Object.entries(this.#routes).map(([key, val]) => [
        key,
        Object.fromEntries(
          Object.entries(val)
            .map(([method, mval]) => [
              method,
              mval.root.handlers || mval.root.children.size > 0
                ? mval.root
                : null,
            ])
            .filter(([, val]) => !!val)
        ) as Record<RequestMethod, PathTrieNode<UserData>>,
      ])
    ) as Record<RouteTypes, Record<RequestMethod, PathTrieNode<UserData>>>;
  }

  constructor(options?: RouterParams) {
    this.#engines = options?.engines ?? {};
    this.#options = options;
    this.handleRequest = this.handleRequest.bind(this);
  }

  /**
   * Set filter handlers for this router for the methods and paths defined by
   *  `methodPath`.
   *
   * The filter handlers are called first. Use them to filter requests.
   *   Use them to filter requests. Eg. **_rate limits_** and **_access control (CORS)_**.
   *
   * @param methodPaths
   * @returns
   */
  filter(
    ...methodPaths: string[]
  ): (
    catchers: Handler<UserData> | Array<Handler<UserData>>
  ) => Router<UserData> {
    return (filters: Handler<UserData> | Array<Handler<UserData>>) => {
      for (const methodPath of methodPaths) {
        const [methods, paths] = splitMethodPath(methodPath.trim());
        const filtersList = Array.isArray(filters) ? filters : [filters];
        this.#sets.filter.push([methodPath, filtersList]);
        for (const method of methods) {
          const routes = this.#routes.filter[method];
          for (const path of paths) {
            routes.set(path, (route) => {
              if (route.handlers != null) {
                const wPath = "/" + paths.join("/");
                throw new RouterError(
                  `Overriding filter ${method} ${route.path} with ${method} ${wPath}`
                );
              }
              route.handlers = filtersList;
            });
          }
        }
      }
      return this;
    };
  }

  /**
   * Set hook handlers for this router for the methods and paths defined by
   *  `methodPath`.
   *
   * The hook handlers are called second. Use them to hook into requests.
   *
   * **NOTE:** All matched hook handlers along the path trie will be called.
   *  eg: hook at `/api/**` will be called when handling `/api/user/...`
   *
   * @param methodPaths
   * @returns
   */
  hook(
    ...methodPaths: string[]
  ): (
    catchers: Handler<UserData> | Array<Handler<UserData>>
  ) => Router<UserData> {
    return (hooks: Handler<UserData> | Array<Handler<UserData>>) => {
      for (const methodPath of methodPaths) {
        const [methods, paths] = splitMethodPath(methodPath.trim());
        const hooksList = Array.isArray(hooks) ? hooks : [hooks];
        this.#sets.hook.push([methodPath, hooksList]);
        for (const method of methods) {
          const routes = this.#routes.hook[method];
          for (const path of paths) {
            routes.set(path, (route) => {
              if (route.handlers != null) {
                const wPath = "/" + paths.join("/");
                throw new RouterError(
                  `Overriding hook ${method} ${route.path} with ${method} ${wPath}`
                );
              }
              route.handlers = hooksList;
            });
          }
        }
      }
      return this;
    };
  }

  /**
   * Set main handlers for this router for the methods and paths defined by
   *  `methodPath`.
   *
   * The main handlers are called third. Use them to handle the requests.
   *
   * @param methodPaths
   * @returns
   */
  handle(
    ...methodPaths: string[]
  ): (
    catchers: Handler<UserData> | Array<Handler<UserData>>
  ) => Router<UserData> {
    return (handlers: Handler<UserData> | Array<Handler<UserData>>) => {
      for (const methodPath of methodPaths) {
        const [methods, paths] = splitMethodPath(methodPath.trim());
        const handlersList = Array.isArray(handlers) ? handlers : [handlers];
        this.#sets.handler.push([methodPath, handlersList]);
        for (const method of methods) {
          const routes = this.#routes.handler[method];
          for (const path of paths) {
            routes.set(path, (route) => {
              if (route.handlers != null) {
                const wPath = "/" + paths.join("/");
                throw new RouterError(
                  `Overriding handler ${method} ${route.path} with ${method} ${wPath}`
                );
              }
              route.handlers = handlersList;
            });
          }
        }
      }
      return this;
    };
  }

  /**
   * Set fallback handlers for this router for the methods and paths defined by
   *  `methodPath`.
   *
   * The fallback handlers will be called fourth after handlers, but only if
   *   no handler has returned a response so far.
   *
   * @param methodPaths
   * @returns
   */
  fallback(
    ...methodPaths: string[]
  ): (
    catchers: Handler<UserData> | Array<Handler<UserData>>
  ) => Router<UserData> {
    return (fallbacks: Handler<UserData> | Array<Handler<UserData>>) => {
      for (const methodPath of methodPaths) {
        const [methods, paths] = splitMethodPath(methodPath.trim());
        const fallbacksList = Array.isArray(fallbacks)
          ? fallbacks
          : [fallbacks];
        this.#sets.fallback.push([methodPath, fallbacksList]);
        for (const method of methods) {
          const routes = this.#routes.fallback[method];
          for (const path of paths) {
            routes.set(path, (route) => {
              if (route.handlers != null) {
                const wPath = "/" + paths.join("/");
                throw new RouterError(
                  `Overriding fallback ${method} ${route.path} with ${method} ${wPath}`
                );
              }
              route.handlers = fallbacksList;
            });
          }
        }
      }
      return this;
    };
  }

  /**
   * Set catch handlers for this router for the methods and paths defined by
   *  `methodPath`.
   *
   * The catch handlers will be called when uncaught errors are thrown.
   *   Use them to handle errors.
   *
   * **NOTE:** They only catch errors when a request is being handled and
   *   the handlers are being called.
   *
   * @param methodPaths
   * @returns
   */
  catch(
    ...methodPaths: string[]
  ): (
    catchers: Handler<UserData> | Array<Handler<UserData>>
  ) => Router<UserData> {
    return (catchers: Handler<UserData> | Array<Handler<UserData>>) => {
      for (const methodPath of methodPaths) {
        const [methods, paths] = splitMethodPath(methodPath.trim());
        const catchersList = Array.isArray(catchers) ? catchers : [catchers];
        this.#sets.catcher.push([methodPath, catchersList]);
        for (const method of methods) {
          const routes = this.#routes.catcher[method];
          for (const path of paths) {
            routes.set(path, (route) => {
              if (route.handlers != null) {
                const wPath = "/" + paths.join("/");
                throw new RouterError(
                  `Overriding catcher ${method} ${route.path} with ${method} ${wPath}`
                );
              }
              route.handlers = catchersList;
            });
          }
        }
      }
      return this;
    };
  }

  /**
   * Add all handlers from router with paths appended to `basePath` to this router.
   *
   * @param basePath
   * @param router
   * @returns
   */
  append(basePath: string, router: Router<UserData>): Router<UserData> {
    // include filter routes
    for (const [methodPath, filters] of router.#sets.filter) {
      this.filter(joinPath(basePath, methodPath))(filters);
    }
    // include hook routes
    for (const [methodPath, hooks] of router.#sets.hook) {
      this.hook(joinPath(basePath, methodPath))(hooks);
    }
    // include handler routes
    for (const [methodPath, handlers] of router.#sets.handler) {
      this.handle(joinPath(basePath, methodPath))(handlers);
    }
    // include fallback routes
    for (const [methodPath, fallbacks] of router.#sets.fallback) {
      this.fallback(joinPath(basePath, methodPath))(fallbacks);
    }
    // include catcher routes
    for (const [methodPath, catchers] of router.#sets.catcher) {
      this.catch(joinPath(basePath, methodPath))(catchers);
    }
    return this;
  }

  /**
   * Get the filter handlers on the specified method and path
   *
   * @param methodPath a simple method and path like GET /a/b
   * @returns Array of handlers or throws RouterError if none found
   */
  getFilter(methodPath: `${string} /${string}`): Array<Handler<UserData>> {
    return this.get("filter", methodPath);
  }

  /**
   * Get the hook handlers on the specified method and path
   *
   * @param methodPath a simple method and path like GET /a/b
   * @returns Array of handlers or throws RouterError if none found
   */
  getHook(methodPath: `${string} /${string}`): Array<Handler<UserData>> {
    return this.get("hook", methodPath);
  }

  /**
   * Get the main handlers on the specified method and path
   *
   * @param methodPath a simple method and path like GET /a/b
   * @returns Array of handlers or throws RouterError if none found
   */
  getHandler(methodPath: `${string} /${string}`): Array<Handler<UserData>> {
    return this.get("handler", methodPath);
  }

  /**
   * Get the fallback handlers on the specified method and path
   *
   * @param methodPath a simple method and path like GET /a/b
   * @returns Array of handlers or throws RouterError if none found
   */
  getFallback(methodPath: `${string} /${string}`): Array<Handler<UserData>> {
    return this.get("fallback", methodPath);
  }

  /**
   * Get the error handlers on the specified method and path
   *
   * @param methodPath a simple method and path like GET /a/b
   * @returns Array of handlers or throws RouterError if none found
   */
  getCatcher(methodPath: `${string} /${string}`): Array<Handler<UserData>> {
    return this.get("catcher", methodPath);
  }

  /**
   * Get the handlers on the specified route type, method and path
   *
   * @param routeType one of the route types
   * @param methodPath a simple method and path like GET /a/b
   * @returns Array of handlers or throws RouterError if none found
   */
  get(
    routeType: RouteTypes,
    methodPath: `${string} /${string}`
  ): Array<Handler<UserData>> {
    const spaceIdx = methodPath.indexOf(" ");
    if (spaceIdx === -1) {
      throw new RouterError(`invalid methodPath ${methodPath}`);
    }
    const method = methodPath
      .substring(0, spaceIdx)
      .toUpperCase() as RequestMethod;
    const path = methodPath.substring(spaceIdx + 1);
    const pathParts = path?.split("/").filter(Boolean);
    let route = undefined;
    switch (routeType) {
      case "filter": {
        route = this.routes.filter[method].get(pathParts);
        break;
      }
      case "hook": {
        route = this.routes.hook[method].get(pathParts);
        break;
      }
      case "handler": {
        route = this.routes.handler[method].get(pathParts);
        break;
      }
      case "fallback": {
        route = this.routes.fallback[method].get(pathParts);
        break;
      }
      case "catcher": {
        route = this.routes.catcher[method].get(pathParts);
        break;
      }
      default:
        throw new RouterError(`Invalid route type ${routeType}`);
    }
    if (route?.handlers == null) {
      throw new RouterError(`No handler found for ${methodPath} ${routeType}`);
    }
    return route.handlers;
  }

  /**
   * Main request handler.
   * Use this to handle requests like:
   * ```
   *   Deno.serve(router.handleRequest)
   * ```
   *
   * @param request
   * @param info
   * @returns
   */
  async handleRequest(
    request: Request,
    info: Deno.ServeHandlerInfo<Deno.NetAddr>
  ): Promise<Response> {
    let response: undefined | Response = undefined;
    const performanceMark = performance.now();
    const url = new URL(request.url);
    const method = request.method.toUpperCase() as RequestMethod;
    const contentTypeHeaders = request.headers
      .get("content-type")
      ?.split(";") as Array<string> | undefined;
    const contentType =
      contentTypeHeaders && contentTypeHeaders[0].trim().toLocaleLowerCase();
    const content = contentTypeHeaders
      ? {
          type: contentType as ContentTypes,
          length: Number.parseInt(request.headers.get("content-length") || "0"),
          ...(contentTypeHeaders
            ? Object.fromEntries(
                contentTypeHeaders
                  .slice(1)
                  .map((cont) => cont.trim().split("=", 2))
              )
            : {}),
        }
      : null;
    const clientAddress = this.options?.usingReverseProxy
      ? request.headers.get("x-forwarded-for")?.split(",")[0]
      : info.remoteAddr.hostname;
    const clientPort = info.remoteAddr.port;
    if (!clientAddress) {
      throw new RouterError("invalid or null client address", {
        cause: "cannot get a valid client address",
      });
    }
    // process the request
    const processedRequest = new ProcessedRequest(
      info,
      performanceMark,
      method,
      url,
      request,
      clientAddress,
      clientPort,
      {},
      contentType,
      content,
      this.#engines.render
    ) as ProcessedRequest & UserData;
    try {
      if (!REQUEST_METHODS_SET.has(method)) {
        throw new RouterError(`method \`${method}\` not supported`);
      }
      // filter routes
      {
        const [response_, curCallCount] = await this.#handleRoute(
          processedRequest,
          this.#routes.filter[method],
          true
        );
        if (response_ != null) response = response_;
        processedRequest.callCount += curCallCount;
        processedRequest.filterCount = curCallCount;
      }
      // hook routes
      {
        const [response_, curCallCount] = await this.#handleRoute(
          processedRequest,
          this.#routes.hook[method],
          true
        );
        if (response_ != null) response = response_;
        processedRequest.callCount += curCallCount;
        processedRequest.hookCount = curCallCount;
      }
      // handler routes
      if (response == null) {
        const [response_, curCallCount] = await this.#handleRoute(
          processedRequest,
          this.#routes.handler[method]
        );
        if (response_ != null) response = response_;
        processedRequest.callCount += curCallCount;
        processedRequest.handleCount = curCallCount;
      }
      // fallback routes
      if (response == null) {
        const [response_, curCallCount] = await this.#handleRoute(
          processedRequest,
          this.#routes.fallback[method]
        );
        if (response_ != null) response = response_;
        processedRequest.callCount += curCallCount;
        processedRequest.fallbackCount = curCallCount;
      }
    } catch (error) {
      processedRequest.error = !(error instanceof Error)
        ? new Error(error ? "" + error : undefined)
        : error;
      const status =
        (error as HttpError).status ?? StatusCode.InternalServerError;
      processedRequest.status(status);
      const [response_, curCallCount] = await this.#handleRoute(
        processedRequest,
        this.#routes.catcher[method]
      );
      processedRequest.callCount += curCallCount;
      processedRequest.catchCount = curCallCount;
      if (response_ != null) {
        response = response_;
      } else {
        response = processedRequest.end();
        // console.error("%c" + processedRequest.error.stack, "color:red");
      }
    } finally {
      const handlersCalled = processedRequest.handleCount > 0;
      const status =
        response != null
          ? response.status
          : handlersCalled
          ? StatusCode.NoContent
          : StatusCode.NotFound;
      const statusText = StatusText.get(status);
      processedRequest.responseTime = performance.now() - processedRequest.time;
      if (response == null) {
        response = new Response(handlersCalled ? null : statusText, {
          status,
          statusText,
          headers: {
            "Content-Type": "text/plain; charset=UTF-8",
          },
        });
      }
      const logRequests = this.options?.log?.requests;
      if (logRequests) {
        logRequests({
          processedRequest,
          responseTime: processedRequest.responseTime,
          status,
          statusText,
        });
      }
    }
    return response;
  }

  async #handleRoute(
    processedRequest: ProcessedRequest & UserData,
    mRoutes: PathTrie<UserData>,
    callAll?: boolean
  ): Promise<[Response | undefined, number]> {
    const pathParts = processedRequest.url.pathname.split("/").filter(Boolean);
    const routes = callAll
      ? mRoutes.getAll(pathParts)
      : [mRoutes.get(pathParts)];
    let callCount = 0;
    for (const route of routes) {
      if (route != null) {
        const handlers = route.handlers;
        if (route.params) {
          const params: Record<string, string> = {};
          for (const [id, param] of route.params.entries()) {
            params[id] = pathParts[param.index] ?? null;
          }
          processedRequest.params = params;
        }
        if (handlers != null) {
          for (let i = 0; i < handlers.length; i++) {
            callCount += i + 1;
            const handler = handlers[i];
            let response_ = handler.apply(this, [processedRequest]);
            if (response_ instanceof Promise) response_ = await response_;
            if (response_ instanceof Response) {
              return [response_, callCount];
            }
          }
        }
      }
    }
    return [undefined, callCount];
  }
}
