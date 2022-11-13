import type { Location, Path, To } from "./history";
import { parsePath } from "./history";

/**
 * Map of routeId -> data returned from a loader/action/error
 */
export interface RouteData {
  [routeId: string]: any;
}

export enum ResultType {
  data = "data",
  deferred = "deferred",
  redirect = "redirect",
  error = "error",
}

/**
 * Successful result from a loader or action
 */
export interface SuccessResult {
  type: ResultType.data;
  data: any;
  statusCode?: number;
  headers?: Headers;
}

/**
 * Successful defer() result from a loader or action
 */
export interface DeferredResult {
  type: ResultType.deferred;
  deferredData: DeferredData;
}

/**
 * Redirect result from a loader or action
 */
export interface RedirectResult {
  type: ResultType.redirect;
  status: number;
  location: string;
  revalidate: boolean;
}

/**
 * Unsuccessful result from a loader or action
 */
export interface ErrorResult {
  type: ResultType.error;
  error: any;
  headers?: Headers;
}

/**
 * Result from a loader or action - potentially successful or unsuccessful
 */
export type DataResult =
  | SuccessResult
  | DeferredResult
  | RedirectResult
  | ErrorResult;

export type FormMethod = "get" | "post" | "put" | "patch" | "delete";
export type FormEncType =
  | "application/x-www-form-urlencoded"
  | "multipart/form-data";

/**
 * @private
 * Internal interface to pass around for action submissions, not intended for
 * external consumption
 */
export interface Submission {
  formMethod: Exclude<FormMethod, "get">;
  formAction: string;
  formEncType: FormEncType;
  formData: FormData;
}

/**
 * @private
 * Arguments passed to route loader/action functions.  Same for now but we keep
 * this as a private implementation detail in case they diverge in the future.
 */
interface DataFunctionArgs {
  request: Request;
  params: Params;
}

/**
 * Arguments passed to loader functions
 */
export interface LoaderFunctionArgs extends DataFunctionArgs {}

/**
 * Arguments passed to action functions
 */
export interface ActionFunctionArgs extends DataFunctionArgs {}

/**
 * Route loader function signature
 */
export interface LoaderFunction {
  (args: LoaderFunctionArgs): Promise<Response> | Response | Promise<any> | any;
}

/**
 * Route action function signature
 */
export interface ActionFunction {
  (args: ActionFunctionArgs): Promise<Response> | Response | Promise<any> | any;
}

/**
 * Route shouldRevalidate function signature.  This runs after any submission
 * (navigation or fetcher), so we flatten the navigation/fetcher submission
 * onto the arguments.  It shouldn't matter whether it came from a navigation
 * or a fetcher, what really matters is the URLs and the formData since loaders
 * have to re-run based on the data models that were potentially mutated.
 */
export interface ShouldRevalidateFunction {
  (args: {
    currentUrl: URL;
    currentParams: AgnosticDataRouteMatch["params"];
    nextUrl: URL;
    nextParams: AgnosticDataRouteMatch["params"];
    formMethod?: Submission["formMethod"];
    formAction?: Submission["formAction"];
    formEncType?: Submission["formEncType"];
    formData?: Submission["formData"];
    actionResult?: DataResult;
    defaultShouldRevalidate: boolean;
  }): boolean;
}

/**
 * Base RouteObject with common props shared by all types of routes
 */
type AgnosticBaseRouteObject = {
  caseSensitive?: boolean;
  path?: string;
  id?: string;
  loader?: LoaderFunction;
  action?: ActionFunction;
  hasErrorBoundary?: boolean;
  shouldRevalidate?: ShouldRevalidateFunction;
  handle?: any;
};

/**
 * Index routes must not have children
 */
export type AgnosticIndexRouteObject = AgnosticBaseRouteObject & {
  children?: undefined;
  index: true;
};

/**
 * Non-index routes may have children, but cannot have index
 */
export type AgnosticNonIndexRouteObject = AgnosticBaseRouteObject & {
  children?: AgnosticRouteObject[];
  index?: false;
};

/**
 * A route object represents a logical route, with (optionally) its child
 * routes organized in a tree-like structure.
 */
export type AgnosticRouteObject =
  | AgnosticIndexRouteObject
  | AgnosticNonIndexRouteObject;

export type AgnosticDataIndexRouteObject = AgnosticIndexRouteObject & {
  id: string;
};

export type AgnosticDataNonIndexRouteObject = AgnosticNonIndexRouteObject & {
  children?: AgnosticDataRouteObject[];
  id: string;
};

/**
 * A data route object, which is just a RouteObject with a required unique ID
 */
export type AgnosticDataRouteObject =
  | AgnosticDataIndexRouteObject
  | AgnosticDataNonIndexRouteObject;

// Recursive helper for finding path parameters in the absence of wildcards
type _PathParam<Path extends string> =
  // split path into individual path segments
  Path extends `${infer L}/${infer R}`
    ? _PathParam<L> | _PathParam<R>
    : // find params after `:`
    Path extends `${string}:${infer Param}`
    ? Param
    : // otherwise, there aren't any params present
      never;

/**
 * Examples:
 * "/a/b/*" -> "*"
 * ":a" -> "a"
 * "/a/:b" -> "b"
 * "/a/blahblahblah:b" -> "b"
 * "/:a/:b" -> "a" | "b"
 * "/:a/b/:c/*" -> "a" | "c" | "*"
 */
type PathParam<Path extends string> =
  // check if path is just a wildcard
  Path extends "*"
    ? "*"
    : // look for wildcard at the end of the path
    Path extends `${infer Rest}/*`
    ? "*" | _PathParam<Rest>
    : // look for params in the absence of wildcards
      _PathParam<Path>;

// Attempt to parse the given string segment. If it fails, then just return the
// plain string type as a default fallback. Otherwise return the union of the
// parsed string literals that were referenced as dynamic segments in the route.
export type ParamParseKey<Segment extends string> =
  // if could not find path params, fallback to `string`
  [PathParam<Segment>] extends [never] ? string : PathParam<Segment>;

/**
 * The parameters that were parsed from the URL path.
 */
export type Params<Key extends string = string> = {
  readonly [key in Key]: string | undefined;
};

/**
 * A RouteMatch contains info about how a route matched a URL.
 */
export interface AgnosticRouteMatch<
  ParamKey extends string = string,
  RouteObjectType extends AgnosticRouteObject = AgnosticRouteObject
> {
  /**
   * The names and values of dynamic parameters in the URL.
   */
  params: Params<ParamKey>;
  /**
   * The portion of the URL pathname that was matched.
   */
  pathname: string;
  /**
   * The portion of the URL pathname that was matched before child routes.
   */
  pathnameBase: string;
  /**
   * The route object that was used to match.
   */
  route: RouteObjectType;
}

export interface AgnosticDataRouteMatch
  extends AgnosticRouteMatch<string, AgnosticDataRouteObject> {}

function isIndexRoute(
  route: AgnosticRouteObject
): route is AgnosticIndexRouteObject {
  return route.index === true;
}

// Walk the route tree generating unique IDs where necessary so we are working
// solely with AgnosticDataRouteObject's within the Router
export function convertRoutesToDataRoutes(
  routes: AgnosticRouteObject[],
  parentPath: number[] = [],
  allIds: Set<string> = new Set<string>()
): AgnosticDataRouteObject[] {
  return routes.map((route, index) => {
    let treePath = [...parentPath, index];
    let id = typeof route.id === "string" ? route.id : treePath.join("-");
    invariant(
      route.index !== true || !route.children,
      `Cannot specify children on an index route`
    );
    invariant(
      !allIds.has(id),
      `Found a route id collision on id "${id}".  Route ` +
        "id's must be globally unique within Data Router usages"
    );
    allIds.add(id);

    if (isIndexRoute(route)) {
      let indexRoute: AgnosticDataIndexRouteObject = { ...route, id };
      return indexRoute;
    } else {
      let pathOrLayoutRoute: AgnosticDataNonIndexRouteObject = {
        ...route,
        id,
        children: route.children
          ? convertRoutesToDataRoutes(route.children, treePath, allIds)
          : undefined,
      };
      return pathOrLayoutRoute;
    }
  });
}
/**
 * 传入 routes 的数组 和 由当前 pathname 路径 的location 
 * 首先是会对 routes 处理，对齐进行扁平化以及附加权重并对其排序
 * 根据传入的 pathname 组成的 location 再取出 pathname 在排除根路径 basename 
 * 最后得到应该要匹配的路径，然后对处理过后的 routes 分别于 pathname 传入 matchRouteBranch
 * 
 */
export function matchRoutes<
  RouteObjectType extends AgnosticRouteObject = AgnosticRouteObject
>(
  routes: RouteObjectType[],
  locationArg: Partial<Location> | string,
  basename = "/"
): AgnosticRouteMatch<string, RouteObjectType>[] | null {
  let location =
    typeof locationArg === "string" ? parsePath(locationArg) : locationArg;

  // 抽离 basename，获取纯粹的 pathname [前天条件: location.pathname 要包含于 basename]
  let pathname = stripBasename(location.pathname || "/", basename);

  if (pathname == null) {
    return null;
  }
  // 扁平化 routes 并附带 权重值 
  let branches = flattenRoutes(routes);
  // 这里对 branches 数组进行排序，权重高的会放在前面，
  rankRouteBranches(branches);

  let matches = null;
  for (let i = 0; matches == null && i < branches.length; ++i) {
    // 权重高的放置了前面 会被优先匹配， 匹配到了就会停止匹配
    // 遍历扁平化的 routes，查看每个 branch 的路径匹配规则是否能匹配到 pathname
    matches = matchRouteBranch<string, RouteObjectType>(
      branches[i],
      // Incoming pathnames are generally encoded from either window.location
      // or from router.navigate, but we want to match against the unencoded
      // paths in the route definitions.  Memory router locations won't be
      // encoded here but there also shouldn't be anything to decode so this
      // should be a safe operation.  This avoids needing matchRoutes to be
      // history-aware.
      // 这里传入当前 locations 的 pathname
      safelyDecodeURI(pathname)
    );
  }

  return matches;
}

interface RouteMeta<
  RouteObjectType extends AgnosticRouteObject = AgnosticRouteObject
> {
  relativePath: string;
  caseSensitive: boolean;
  childrenIndex: number;
  route: RouteObjectType;
}

interface RouteBranch<
  RouteObjectType extends AgnosticRouteObject = AgnosticRouteObject
> {
  path: string;
  score: number;
  routesMeta: RouteMeta<RouteObjectType>[];
}

function flattenRoutes<
  RouteObjectType extends AgnosticRouteObject = AgnosticRouteObject
>(
  // 要打平的数据
  routes: RouteObjectType[],
  // 下面值会在 递归时候使用
  branches: RouteBranch<RouteObjectType>[] = [],
  parentsMeta: RouteMeta<RouteObjectType>[] = [],
  parentPath = ""
): RouteBranch<RouteObjectType>[] {
  routes.forEach((route, index) => {
    // 将每一个 route 对象 都转换成 mete 
    let meta: RouteMeta<RouteObjectType> = {
      relativePath: route.path || "",
      caseSensitive: route.caseSensitive === true,
      childrenIndex: index,
      route,
    };

    // 如果 route 以 / 开头，那么它应该完全包含父 route 的 path，否则报错
    if (meta.relativePath.startsWith("/")) {
      invariant(
        meta.relativePath.startsWith(parentPath),
        `Absolute route path "${meta.relativePath}" nested under path ` +
          `"${parentPath}" is not valid. An absolute child route path ` +
          `must start with the combined path of all its parent routes.`
      );

      // 把父路由的前缀去除，返回相对路径
      meta.relativePath = meta.relativePath.slice(parentPath.length);
    }

    // 完整的 path，合并了父路由的 path 并然后再过滤掉 '//'
    let path = joinPaths([parentPath, meta.relativePath]);
    
    // 存储 meta 对象
    let routesMeta = parentsMeta.concat(meta);

 
    // 遍历路由是深度优先的 所以子路由要提前处理放到下一个路由的前面
    if (route.children && route.children.length > 0) {
      // 当index === true 路由不应该存在子路由时 [索引路由]
      invariant(
        // @ts-expect-error
        route.index !== true,
        `Index routes must not have child routes. Please remove ` +
          `all child routes from route path "${path}".`
      );

      // 递归调用 [会将子路由放置在父路由的前面, 深度优先]
      flattenRoutes(route.children, branches, routesMeta, path);
    }

    //  没有路径的路由（布局路由）不参与路由匹配，除非它是索引路由
    /* 
      注意：递归是在前面进行的，也就是说布局路由的子路由是会参与匹配的
      而子路由会有布局路由的路由信息，这也是布局路由能正常渲染的原因。
    */
    if (route.path == null && !route.index) {
      return;
    }

    // 当前的 router 对象被处理最终的结果保存在 branches 中
    // path: 当前的完整路径
    // score: 权重 
    // routesMeta: 当前的 meta（由route产生）和父 meta
    branches.push({ path, score: computeScore(path, route.index), routesMeta });
  });

  return branches;
}

// 对 路由进行排序 分数高的会优先放在最前面
function rankRouteBranches(branches: RouteBranch[]): void {
  branches.sort((a, b) =>
    a.score !== b.score
      ? b.score - a.score // Higher score first
      : compareIndexes(
          a.routesMeta.map((meta) => meta.childrenIndex),
          b.routesMeta.map((meta) => meta.childrenIndex)
        )
  );
}

const paramRe = /^:\w+$/;
const dynamicSegmentValue = 3;
const indexRouteValue = 2;
const emptySegmentValue = 1;
const staticSegmentValue = 10;
const splatPenalty = -2;
const isSplat = (s: string) => s === "*";

// 计算传入 path 的分值
function computeScore(path: string, index: boolean | undefined): number {
  // 将字符串 拆分成数组
  let segments = path.split("/"); 
  let initialScore = segments.length;
  if (segments.some(isSplat)) {
    initialScore += splatPenalty;
  }

  if (index) {
    initialScore += indexRouteValue;
  }

  return segments
    .filter((s) => !isSplat(s))
    .reduce(
      (score, segment) =>
        score +
        (paramRe.test(segment)
          ? dynamicSegmentValue
          : segment === ""
          ? emptySegmentValue
          : staticSegmentValue),
      initialScore
    );
}

function compareIndexes(a: number[], b: number[]): number {
  let siblings =
    a.length === b.length && a.slice(0, -1).every((n, i) => n === b[i]);

  return siblings
    ? // If two routes are siblings, we should try to match the earlier sibling
      // first. This allows people to have fine-grained control over the matching
      // behavior by simply putting routes with identical paths in the order they
      // want them tried.
      // 兄弟路由 则要按照他们顺序的排列，这里是取出最后一个值相减
      a[a.length - 1] - b[b.length - 1]
    : // Otherwise, it doesn't really make sense to rank non-siblings by index,
      // so they sort equally.
      // === 0 位置保持不变
      0;
}
/**
 * 接收一个处理好的 routes 中的一个(branch) 和一个当前要匹配的路径
 * 取出 branch 中的 routesMeta 这里是存储了当前路径对象以及父路径路由
 * routesMeta 数组最后一个是自己的数组，前面的全部是 parentRoute 
 * 
 * 
 * @param branch 
 * @param pathname 
 * @returns 
 */
function matchRouteBranch<
  ParamKey extends string = string,
  RouteObjectType extends AgnosticRouteObject = AgnosticRouteObject
>(
  branch: RouteBranch<RouteObjectType>,
  pathname: string
): AgnosticRouteMatch<ParamKey, RouteObjectType>[] | null {
  let { routesMeta } = branch;

  let matchedParams = {};
  let matchedPathname = "/";
  let matches: AgnosticRouteMatch<ParamKey, RouteObjectType>[] = [];
  // 遍历 routesMeta 数组 
  for (let i = 0; i < routesMeta.length; ++i) {
    let meta = routesMeta[i];
    // 判断是否是最后一个元素
    let end = i === routesMeta.length - 1;

    // 匹配相对路由的剩余值 也就是过滤掉匹配过的父 pathname 的剩余值
    let remainingPathname =
      matchedPathname === "/"
        ? pathname
        : pathname.slice(matchedPathname.length) || "/";
    
    // 开始单个路由的匹配
    let match = matchPath(
      { path: meta.relativePath, caseSensitive: meta.caseSensitive, end },
      remainingPathname
    );

    if (!match) return null;

    Object.assign(matchedParams, match.params);

    let route = meta.route;

    // 保存
    matches.push({
      // TODO: Can this as be avoided?
      params: matchedParams as Params<ParamKey>,
      pathname: joinPaths([matchedPathname, match.pathname]),
      pathnameBase: normalizePathname(
        joinPaths([matchedPathname, match.pathnameBase])
      ),
      route,
    });

    if (match.pathnameBase !== "/") {
      // matchedPathname 刚开始默认为 / 之后和 路由的父路由结合在一起
      // 这里要和 remainingPathname 变量一起看
      // 因为是在处理 routesMeta 它的层级是逐级递增的所以就会每一次匹配都要去排除上一次的父路由路径
      matchedPathname = joinPaths([matchedPathname, match.pathnameBase]);
    }
  }

  return matches;
}

/**
 * Returns a path with params interpolated.
 *
 * @see https://reactrouter.com/docs/en/v6/utils/generate-path
 */
export function generatePath<Path extends string>(
  path: Path,
  params: {
    [key in PathParam<Path>]: string;
  } = {} as any
): string {
  return path
    .replace(/:(\w+)/g, (_, key: PathParam<Path>) => {
      invariant(params[key] != null, `Missing ":${key}" param`);
      return params[key]!;
    })
    .replace(/(\/?)\*/, (_, prefix, __, str) => {
      const star = "*" as PathParam<Path>;

      if (params[star] == null) {
        // If no splat was provided, trim the trailing slash _unless_ it's
        // the entire path
        return str === "/*" ? "/" : "";
      }

      // Apply the splat
      return `${prefix}${params[star]}`;
    });
}

/**
 * A PathPattern is used to match on some portion of a URL pathname.
 */
export interface PathPattern<Path extends string = string> {
  /**
   * A string to match against a URL pathname. May contain `:id`-style segments
   * to indicate placeholders for dynamic parameters. May also end with `/*` to
   * indicate matching the rest of the URL pathname.
   */
  path: Path;
  /**
   * Should be `true` if the static portions of the `path` should be matched in
   * the same case.
   */
  caseSensitive?: boolean;
  /**
   * Should be `true` if this pattern should match the entire URL pathname.
   */
  end?: boolean;
}

/**
 * A PathMatch contains info about how a PathPattern matched on a URL pathname.
 */
export interface PathMatch<ParamKey extends string = string> {
  /**
   * The names and values of dynamic parameters in the URL.
   */
  params: Params<ParamKey>;
  /**
   * The portion of the URL pathname that was matched.
   */
  pathname: string;
  /**
   * The portion of the URL pathname that was matched before child routes.
   */
  pathnameBase: string;
  /**
   * The pattern that was used to match.
   */
  pattern: PathPattern;
}

type Mutable<T> = {
  -readonly [P in keyof T]: T[P];
};

/**
 * 这里的就是传入 处理每一个 branch 并处理其中的 routesMeta 数组
 * 这里存储的是所有的父路由，去遍历这个数组 传入 routesMeta中的一个父路由，以及路径(父路径)
 * 用传入的路由的 path 去构建出 正则规则 在使用 这个正则规则去匹配传入的路径
 * 
 * @param pattern 传入单个路由 
 * @param pathname 以及要匹配的路径
 * @returns 
 */
export function matchPath<
  ParamKey extends ParamParseKey<Path>,
  Path extends string
>(
  pattern: PathPattern<Path> | Path,
  pathname: string
): PathMatch<ParamKey> | null {
  if (typeof pattern === "string") {
    pattern = { path: pattern, caseSensitive: false, end: true };
  }

  // 构建通过传入的路由来构建正则表达式，并返回 paramNames 数组，这个数组存有动态参数和 *
  let [matcher, paramNames] = compilePath(
    pattern.path,
    pattern.caseSensitive,
    pattern.end
  );

  // 去匹配 
  let match = pathname.match(matcher);
  // 没有就说明不符合此路由就会返回
  if (!match) return null;

  // 如果匹配上就会返回 ['匹配到值',,,, index(索引), input, groups] 

  // 取到匹配到的值
  let matchedPathname = match[0];
  // 将路径中 '/' 之前的字符 将其作为 pathnameBase 
  let pathnameBase = matchedPathname.replace(/(.)\/+$/, "$1");
  let captureGroups = match.slice(1);
  
  // 取出剩余匹配的值，动态参数 * 和 :id 
  let params: Params = paramNames.reduce<Mutable<Params>>(
    (memo, paramName, index) => {
      // We need to compute the pathnameBase here using the raw splat value
      // instead of using params["*"] later because it will be decoded then
      if (paramName === "*") {
        let splatValue = captureGroups[index] || "";
        pathnameBase = matchedPathname
          .slice(0, matchedPathname.length - splatValue.length)
          .replace(/(.)\/+$/, "$1");
      }

      // 将动态参数以及匹配的值captureGroups[index]传入函数内进行解码
      memo[paramName] = safelyDecodeURIComponent(
        captureGroups[index] || "",
        paramName
      );
      return memo;
    },
    {}
  );

  return {
    params,
    pathname: matchedPathname,
    pathnameBase,
    pattern,
  };
}
/**
 * 解析 path 获得其 reg 规则
 * 返回处理好的正则规则以及 路径中 ':' 后的字符
 * @param path 
 * @param caseSensitive 是否兼容大小写
 * @param end 是否匹配到末尾位置
 * @returns 
 */
function compilePath(
  path: string,
  caseSensitive = false,
  end = true 
): [RegExp, string[]] {
  // 当 匹配的路径含有 /foo* 就会报错
  warning(
    path === "*" || !path.endsWith("*") || path.endsWith("/*"),
    `Route path "${path}" will be treated as if it were ` +
      `"${path.replace(/\*$/, "/*")}" because the \`*\` character must ` +
      `always follow a \`/\` in the pattern. To get rid of this warning, ` +
      `please change the route path to "${path.replace(/\*$/, "/*")}".`
  );

  let paramNames: string[] = [];
  // 处理 path 排除一个特殊符号的路径
  let regexpSource =
    "^" +
    path
      .replace(/\/*\*?$/, "") // 排除 path 中 /xxxx**** 这样的路径
      .replace(/^\/*/, "/") // Make sure it has a leading /
      .replace(/[\\.*+^$?{}|()[\]]/g, "\\$&") // 将特殊符号分割 'dadsd^sa.dasda' ==> 'dadsd\\^sa\\.dasda'
      .replace(/:(\w+)/g, (_: string, paramName: string) => {
        paramNames.push(paramName);
        return "([^\\/]+)";
      });
      // 这里会取出 ':' 后面的字符 并将其保存在 paramNames 数组中，原来的字符串':'位置就会使用 `([^\\/]+)`代替
  // 这里要去查看字符最后一个是否是 *
  if (path.endsWith("*")) {
    paramNames.push("*");
    regexpSource +=
      path === "*" || path === "/*"
        ? "(.*)$" // Already matched the initial /, just match the rest
        : "(?:\\/(.+)|\\/*)$"; // https://regex-vis.com/?r=%28%3F%3A%5C%5C%2F%28.%2B%29%7C%5C%5C%2F*%29%24
  } else if (end) {
    // When matching to the end, ignore trailing slashes
    // 当匹配的是最后一个路由时候
    regexpSource += "\\/*$";
  } else if (path !== "" && path !== "/") {
    // If our path is non-empty and contains anything beyond an initial slash,
    // then we have _some_ form of path in our regex so we should expect to
    // match only if we find the end of this path segment.  Look for an optional
    // non-captured trailing slash (to match a portion of the URL) or the end
    // of the path (if we've matched to the end).  We used to do this with a
    // word boundary but that gives false positives on routes like
    // /user-preferences since `-` counts as a word boundary.
    // 这里应该是去找到那些字符边界
    regexpSource += "(?:(?=\\/|$))";
  } else {
    // Nothing to match for "" or "/"
  }
  // 构建 正则 
  let matcher = new RegExp(regexpSource, caseSensitive ? undefined : "i");
  // 返回正则 以及之前 path ':' 后的字符
  return [matcher, paramNames];
}

function safelyDecodeURI(value: string) {
  try {
    // 对一个编码后的 url 经行解码
    return decodeURI(value);
  } catch (error) {
    warning(
      false,
      `The URL path "${value}" could not be decoded because it is is a ` +
        `malformed URL segment. This is probably due to a bad percent ` +
        `encoding (${error}).`
    );
    // 出现异常就返回最初值
    return value;
  }
}

function safelyDecodeURIComponent(value: string, paramName: string) {
  try {
    return decodeURIComponent(value);
  } catch (error) {
    warning(
      false,
      `The value for the URL param "${paramName}" will not be decoded because` +
        ` the string "${value}" is a malformed URL segment. This is probably` +
        ` due to a bad percent encoding (${error}).`
    );

    return value;
  }
}
// 首先判断 basename 和 pathname 的关系，pathname >> basename 的才行
// 进而去判断 basename 最后字符是否是 '/' 然后再反向找到 pathname 如果没有对应上
// 说明 pathname 和 basename 并不是包含关系，反之就会返回 pathname.slice(startIndex) || "/";
/**
 * @private
 */
export function stripBasename(
  pathname: string,
  basename: string
): string | null {
  if (basename === "/") return pathname;

  if (!pathname.toLowerCase().startsWith(basename.toLowerCase())) {
    return null;
  }

  // We want to leave trailing slash behavior in the user's control, so if they
  // specify a basename with a trailing slash, we should support it
  let startIndex = basename.endsWith("/")
    ? basename.length - 1
    : basename.length;
  let nextChar = pathname.charAt(startIndex);
  if (nextChar && nextChar !== "/") {
    // pathname does not start with basename/
    return null;
  }

  return pathname.slice(startIndex) || "/";
}

/**
 * @private
 */
export function invariant(value: boolean, message?: string): asserts value;
export function invariant<T>(
  value: T | null | undefined,
  message?: string
): asserts value is T;
export function invariant(value: any, message?: string) {
  if (value === false || value === null || typeof value === "undefined") {
    throw new Error(message);
  }
}

/**
 * @private
 */
export function warning(cond: any, message: string): void {
  if (!cond) {
    // eslint-disable-next-line no-console
    if (typeof console !== "undefined") console.warn(message);

    try {
      // Welcome to debugging React Router!
      //
      // This error is thrown as a convenience so you can more easily
      // find the source for a warning that appears in the console by
      // enabling "pause on exceptions" in your JavaScript debugger.
      throw new Error(message);
      // eslint-disable-next-line no-empty
    } catch (e) {}
  }
}

/**
 * Returns a resolved path object relative to the given pathname.
 *
 * @see https://reactrouter.com/docs/en/v6/utils/resolve-path
 */
export function resolvePath(to: To, fromPathname = "/"): Path {
  let {
    pathname: toPathname,
    search = "",
    hash = "",
  } = typeof to === "string" ? parsePath(to) : to;

  let pathname = toPathname
    ? toPathname.startsWith("/")
      // 一般的用法就是 path="foo"
      // 直接从当前的位置跳转到 foo 
      ? toPathname
      // 判断 to 是否是 / 开头 也就是说 path="/foo/bar" 类似于这种要先去
      // 和 form 路径组装后再去跳转
      : resolvePathname(toPathname, fromPathname)
    : fromPathname;

  return {
    pathname,
    search: normalizeSearch(search),
    hash: normalizeHash(hash),
  };
}

// 该函数主要是将传入的 to 和 form 解析为数组再遍历 to 数组
// 如果里面存在 .. 就要删除 form 的最后一个
// 如果不是 '.' 就会往 form 中添加最后再转化为字符串返回
function resolvePathname(relativePath: string, fromPathname: string): string {
  // 除去 formPathname 中最后一个 '/'，切割成数组
  let segments = fromPathname.replace(/\/+$/, "").split("/");
  // 将 relativePath 字符串按照 '/' 切割为数组
  let relativeSegments = relativePath.split("/");

  relativeSegments.forEach((segment) => {
    if (segment === "..") {
      // Keep the root "" segment so the pathname starts at /
      // 如果出现了 '..' 那就会使 formPathname 少一个路径也就是往前移动
      if (segments.length > 1) segments.pop();
    } else if (segment !== ".") {
      // 不是点就会往其添加元素
      segments.push(segment);
    }
  });
  // 最后再返回该字符串 
  return segments.length > 1 ? segments.join("/") : "/";
}

function getInvalidPathError(
  char: string,
  field: string,
  dest: string,
  path: Partial<Path>
) {
  return (
    `Cannot include a '${char}' character in a manually specified ` +
    `\`to.${field}\` field [${JSON.stringify(
      path
    )}].  Please separate it out to the ` +
    `\`to.${dest}\` field. Alternatively you may provide the full path as ` +
    `a string in <Link to="..."> and the router will parse it for you.`
  );
}

/**
 * @private
 *
 * When processing relative navigation we want to ignore ancestor routes that
 * do not contribute to the path, such that index/pathless layout routes don't
 * interfere.
 *
 * For example, when moving a route element into an index route and/or a
 * pathless layout route, relative link behavior contained within should stay
 * the same.  Both of the following examples should link back to the root:
 *
 *   <Route path="/">
 *     <Route path="accounts" element={<Link to=".."}>
 *   </Route>
 *
 *   <Route path="/">
 *     <Route path="accounts">
 *       <Route element={<AccountsLayout />}>       // <-- Does not contribute
 *         <Route index element={<Link to=".."} />  // <-- Does not contribute
 *       </Route
 *     </Route>
 *   </Route>
 */
// 获取 匹配的路径并要过滤掉 index !== 0 的 && route.path 没有的
export function getPathContributingMatches<
  T extends AgnosticRouteMatch = AgnosticRouteMatch
>(matches: T[]) {
  return matches.filter(
    (match, index) =>
      index === 0 || (match.route.path && match.route.path.length > 0)
  );
}

/**
 * @private
 */
export function resolveTo(
  toArg: To,
  routePathnames: string[],
  locationPathname: string,
  isPathRelative = false
): Path {
  let to: Partial<Path>;
  // 将 to 改成 path 对象 {pathname, search, hash}
  if (typeof toArg === "string") {
    // 将 string 解析为 path 对象具有 {pathname, search, hash}
    to = parsePath(toArg);
  } else {
    to = { ...toArg };
    // 如果pathname有 ?
    invariant(
      !to.pathname || !to.pathname.includes("?"),
      getInvalidPathError("?", "pathname", "search", to)
    );
    // 如果pathname有 # 
    invariant(
      !to.pathname || !to.pathname.includes("#"),
      getInvalidPathError("#", "pathname", "hash", to)
    );
    // 如果search有 # 
    invariant(
      !to.search || !to.search.includes("#"),
      getInvalidPathError("#", "search", "hash", to)
    );
    // 那就会报错
  }

  // 判断是否为空
  let isEmptyPath = toArg === "" || to.pathname === "";
  let toPathname = isEmptyPath ? "/" : to.pathname;

  let from: string;

  // Routing is relative to the current pathname if explicitly requested.
  //
  // If a pathname is explicitly provided in `to`, it should be relative to the
  // route context. This is explained in `Note on `<Link to>` values` in our
  // migration guide from v5 as a means of disambiguation between `to` values
  // that begin with `/` and those that do not. However, this is problematic for
  // `to` values that do not provide a pathname. `to` can simply be a search or
  // hash string, in which case we should assume that the navigation is relative
  // to the current location's pathname and *not* the route pathname.

  // 判断是否具有相关性， 
  if (isPathRelative || toPathname == null) {
    // from 将等于当前的 location 的pathname
    from = locationPathname;
  } else {
    // 这里存储着父路径的长度
    let routePathnameIndex = routePathnames.length - 1;

    // 如果当前路径为 '..' 
    if (toPathname.startsWith("..")) {
      let toSegments = toPathname.split("/");

      // Each leading .. segment means "go up one route" instead of "go up one
      // URL segment".  This is a key difference from how <a href> works and a
      // major reason we call this a "to" value instead of a "href".
      while (toSegments[0] === "..") {
        toSegments.shift();
        // 使当前的 form = 当前 mathes 匹配父路径中倒数第二位
        routePathnameIndex -= 1;
      }
      // 将 '..' 从路径中删除后重新化为 path 路径
      to.pathname = toSegments.join("/");
    }

    // If there are more ".." segments than parent routes, resolve relative to
    // the root / URL.
    // 开始指定 form 
    from = routePathnameIndex >= 0 ? routePathnames[routePathnameIndex] : "/";
  }

  // 根据 to 和 from 中的规则去获得到 path 对象
  // 1. to 出现 '..' 就要让的 form 删除最后一位
  // 2. to 的开头是 '/' 就要去结合 form 的路径与to拼接一下
  // 返回一个 {pathname, search, hash} 对象 
  let path = resolvePath(to, from);

  // Ensure the pathname has a trailing slash if the original "to" had one
  // 如果topathnam最后是以 / 结尾
  let hasExplicitTrailingSlash =
    toPathname && toPathname !== "/" && toPathname.endsWith("/");
  // Or if this was a link to the current path which has a trailing slash
  let hasCurrentTrailingSlash =
    (isEmptyPath || toPathname === ".") && locationPathname.endsWith("/");
  
    if (
    !path.pathname.endsWith("/") &&
    // 如果是以 / 结尾或者 topathname 是 '.' 并且 当前的locationpathname 以 '/' 结尾
    (hasExplicitTrailingSlash || hasCurrentTrailingSlash)
  ) {
    // 那就再原来的 path 上加上 '/'
    path.pathname += "/";
  }

  return path;
}

/**
 * @private
 */
export function getToPathname(to: To): string | undefined {
  // Empty strings should be treated the same as / paths
  return to === "" || (to as Path).pathname === ""
    ? "/"
    : typeof to === "string"
    ? parsePath(to).pathname
    : to.pathname;
}

/**
 * @private
 * 将数组中 含有 // 全部替换成 /
 */
export const joinPaths = (paths: string[]): string =>
  paths.join("/").replace(/\/\/+/g, "/");

/**
 * @private
 */
export const normalizePathname = (pathname: string): string =>
  pathname.replace(/\/+$/, "").replace(/^\/*/, "/");

/**
 * @private
 */
// 去除字符串的 ? 号
export const normalizeSearch = (search: string): string =>
  !search || search === "?"
    ? ""
    : search.startsWith("?")
    ? search
    : "?" + search;

/**
 * @private
 */
export const normalizeHash = (hash: string): string =>
  !hash || hash === "#" ? "" : hash.startsWith("#") ? hash : "#" + hash;

export type JsonFunction = <Data>(
  data: Data,
  init?: number | ResponseInit
) => Response;

/**
 * This is a shortcut for creating `application/json` responses. Converts `data`
 * to JSON and sets the `Content-Type` header.
 */
export const json: JsonFunction = (data, init = {}) => {
  let responseInit = typeof init === "number" ? { status: init } : init;

  let headers = new Headers(responseInit.headers);
  if (!headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json; charset=utf-8");
  }

  return new Response(JSON.stringify(data), {
    ...responseInit,
    headers,
  });
};

export interface TrackedPromise extends Promise<any> {
  _tracked?: boolean;
  _data?: any;
  _error?: any;
}

export class AbortedDeferredError extends Error {}

export class DeferredData {
  private pendingKeys: Set<string | number> = new Set<string | number>();
  private controller: AbortController;
  private abortPromise: Promise<void>;
  private unlistenAbortSignal: () => void;
  private subscriber?: (aborted: boolean) => void = undefined;
  data: Record<string, unknown>;

  constructor(data: Record<string, unknown>) {
    invariant(
      data && typeof data === "object" && !Array.isArray(data),
      "defer() only accepts plain objects"
    );

    // Set up an AbortController + Promise we can race against to exit early
    // cancellation
    let reject: (e: AbortedDeferredError) => void;
    this.abortPromise = new Promise((_, r) => (reject = r));
    this.controller = new AbortController();
    let onAbort = () =>
      reject(new AbortedDeferredError("Deferred data aborted"));
    this.unlistenAbortSignal = () =>
      this.controller.signal.removeEventListener("abort", onAbort);
    this.controller.signal.addEventListener("abort", onAbort);

    this.data = Object.entries(data).reduce(
      (acc, [key, value]) =>
        Object.assign(acc, {
          [key]: this.trackPromise(key, value),
        }),
      {}
    );
  }

  private trackPromise(
    key: string | number,
    value: Promise<unknown> | unknown
  ): TrackedPromise | unknown {
    if (!(value instanceof Promise)) {
      return value;
    }

    this.pendingKeys.add(key);

    // We store a little wrapper promise that will be extended with
    // _data/_error props upon resolve/reject
    let promise: TrackedPromise = Promise.race([value, this.abortPromise]).then(
      (data) => this.onSettle(promise, key, null, data as unknown),
      (error) => this.onSettle(promise, key, error as unknown)
    );

    // Register rejection listeners to avoid uncaught promise rejections on
    // errors or aborted deferred values
    promise.catch(() => {});

    Object.defineProperty(promise, "_tracked", { get: () => true });
    return promise;
  }

  private onSettle(
    promise: TrackedPromise,
    key: string | number,
    error: unknown,
    data?: unknown
  ): unknown {
    if (
      this.controller.signal.aborted &&
      error instanceof AbortedDeferredError
    ) {
      this.unlistenAbortSignal();
      Object.defineProperty(promise, "_error", { get: () => error });
      return Promise.reject(error);
    }

    this.pendingKeys.delete(key);

    if (this.done) {
      // Nothing left to abort!
      this.unlistenAbortSignal();
    }

    const subscriber = this.subscriber;
    if (error) {
      Object.defineProperty(promise, "_error", { get: () => error });
      subscriber && subscriber(false);
      return Promise.reject(error);
    }

    Object.defineProperty(promise, "_data", { get: () => data });
    subscriber && subscriber(false);
    return data;
  }

  subscribe(fn: (aborted: boolean) => void) {
    this.subscriber = fn;
  }

  cancel() {
    this.controller.abort();
    this.pendingKeys.forEach((v, k) => this.pendingKeys.delete(k));
    let subscriber = this.subscriber;
    subscriber && subscriber(true);
  }

  async resolveData(signal: AbortSignal) {
    let aborted = false;
    if (!this.done) {
      let onAbort = () => this.cancel();
      signal.addEventListener("abort", onAbort);
      aborted = await new Promise((resolve) => {
        this.subscribe((aborted) => {
          signal.removeEventListener("abort", onAbort);
          if (aborted || this.done) {
            resolve(aborted);
          }
        });
      });
    }
    return aborted;
  }

  get done() {
    return this.pendingKeys.size === 0;
  }

  get unwrappedData() {
    invariant(
      this.data !== null && this.done,
      "Can only unwrap data on initialized and settled deferreds"
    );

    return Object.entries(this.data).reduce(
      (acc, [key, value]) =>
        Object.assign(acc, {
          [key]: unwrapTrackedPromise(value),
        }),
      {}
    );
  }
}

function isTrackedPromise(value: any): value is TrackedPromise {
  return (
    value instanceof Promise && (value as TrackedPromise)._tracked === true
  );
}

function unwrapTrackedPromise(value: any) {
  if (!isTrackedPromise(value)) {
    return value;
  }

  if (value._error) {
    throw value._error;
  }
  return value._data;
}

export function defer(data: Record<string, unknown>) {
  return new DeferredData(data);
}

export type RedirectFunction = (
  url: string,
  init?: number | ResponseInit
) => Response;

/**
 * A redirect response. Sets the status code and the `Location` header.
 * Defaults to "302 Found".
 */
export const redirect: RedirectFunction = (url, init = 302) => {
  let responseInit = init;
  if (typeof responseInit === "number") {
    responseInit = { status: responseInit };
  } else if (typeof responseInit.status === "undefined") {
    responseInit.status = 302;
  }

  let headers = new Headers(responseInit.headers);
  headers.set("Location", url);

  return new Response(null, {
    ...responseInit,
    headers,
  });
};

/**
 * @private
 * Utility class we use to hold auto-unwrapped 4xx/5xx Response bodies
 */
export class ErrorResponse {
  status: number;
  statusText: string;
  data: any;

  constructor(status: number, statusText: string | undefined, data: any) {
    this.status = status;
    this.statusText = statusText || "";
    this.data = data;
  }
}

/**
 * Check if the given error is an ErrorResponse generated from a 4xx/5xx
 * Response throw from an action/loader
 */
export function isRouteErrorResponse(e: any): e is ErrorResponse {
  return e instanceof ErrorResponse;
}