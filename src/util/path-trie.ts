import { RouterError } from "../error.ts";
import type { Handler, RouteTypes } from "../types.ts";
import type { PathParts } from "../types.ts";

export interface PathTrieNodeAttribs<UserData extends Record<string, unknown>> {
  parent?: PathTrieNode<UserData>;
  path?: string;
  id?: string;
  handlers?: Array<Handler<UserData>>;
  params?: Map<string, { value: string; index: number }>;
}

export type RouteType<UserData extends Record<string, unknown>> = Record<
  RouteTypes,
  PathTrieNodeAttribs<UserData>
>;

export class PathTrieNode<UserData extends Record<string, unknown>>
  implements PathTrieNodeAttribs<UserData>
{
  children: Map<string, PathTrieNode<UserData>> = new Map();
  constructor(
    public parent?: PathTrieNode<UserData>,
    public path?: string,
    public id?: string,
    public handlers?: Array<Handler<UserData>>,
    public params?: Map<string, { value: string; index: number }>
  ) {}
}

export class PathTrie<UserData extends Record<string, unknown>> {
  #root: PathTrieNode<UserData>;

  get root(): PathTrieNode<UserData> {
    return this.#root;
  }

  constructor() {
    this.#root = new PathTrieNode<UserData>(undefined, "/");
  }

  has(pathParts: Array<string>): boolean {
    return this.get(pathParts) != null;
  }

  getAll(pathParts: Array<string>): Array<PathTrieNode<UserData>> {
    const nodes: Array<PathTrieNode<UserData>> = [];
    let node: PathTrieNode<UserData> | undefined = this.#root;
    if (pathParts.length === 0) {
      if (node.handlers != null) nodes.push(node);
    } else {
      const lastI = pathParts.length - 1;
      for (let i = 0; node != null && i < pathParts.length; i++) {
        const part = decodeURIComponent(pathParts[i]);
        const child: PathTrieNode<UserData> | undefined =
          node.children.get(part);
        const glob = node.children.get("*");
        const greedyGlob = node.children.get("**");
        if (i === lastI) {
          if (child?.handlers != null) nodes.push(child);
          if (glob?.handlers != null) nodes.push(glob);
          node = child;
        } else {
          if (child == null) node = glob;
          else node = child;
        }
        if (greedyGlob?.handlers != null) nodes.push(greedyGlob);
      }
    }
    return nodes;
  }

  get(pathParts: Array<string>): PathTrieNode<UserData> | undefined {
    let node: PathTrieNode<UserData> | undefined = this.#root,
      child = undefined;
    let bestGreedyGlob: PathTrieNode<UserData> | undefined = undefined;
    for (let i = 0; node != null && i < pathParts.length; i++) {
      const part = decodeURIComponent(pathParts[i]);
      if (bestGreedyGlob == null && node.children.has("**")) {
        bestGreedyGlob = node.children.get("**");
      }
      child = node.children.get(part);
      if (child == null) child = node.children.get("*");
      node = child;
    }
    node = node != null && node.handlers != null ? node : bestGreedyGlob;
    return node;
  }

  set(
    pathParts: PathParts,
    replaceFn: { (node: PathTrieNode<UserData>): void }
  ) {
    const path = "/" + pathParts.map(([p]) => p).join("/");
    const params = new Map();
    const parts: Array<{
      path?: string;
      id: string;
      paramId?: string;
      glob?: boolean;
    }> = [];
    // process the path
    {
      for (let i = 0; i < pathParts.length; i++) {
        const [part, paramId] = pathParts[i];
        const partMatch = part.match(/^(?:(?<glob>\*\*?)|(?<id>[\w\-\.%]*))$/);
        if (!partMatch) {
          throw new RouterError(
            `invalid path ${path} at ${
              "/" + pathParts.slice(0, i + 1).join("/")
            } <--`
          );
        }
        const id = partMatch.groups?.id ?? partMatch.groups?.glob ?? "";
        if (paramId != null) params.set(paramId, { value: id, index: i });
        const subPath =
          "/" +
          pathParts
            .slice(0, i + 1)
            .map(([p]) => p)
            .join("/");
        parts.push({
          path: subPath,
          id,
        });
      }
    }
    // find the insertion point and insert the node
    {
      const lastI = parts.length - 1;
      for (let i = 0, node = this.#root, child = null; i < parts.length; i++) {
        const part = parts[i];
        if (!part.id) {
          if (i === lastI) {
            replaceFn(node);
            node.params = params;
            node.id = "";
            break;
          } else {
            part.id = "*";
          }
        }
        {
          child = node.children.get(part.id);
          if (i === lastI) {
            if (child != null && child.handlers != null) {
              replaceFn(child);
              break;
            }
            if (child == null) {
              child = new PathTrieNode(
                node,
                part.path,
                part.id,
                undefined,
                params
              );
              node.children.set(part.id, child);
              replaceFn(child);
            } else {
              replaceFn(child);
            }
          } else {
            if (child == null) {
              child = new PathTrieNode(node, part.path, part.id);
              node.children.set(part.id, child);
            }
            node = child;
          }
        }
      }
    }
  }
}
