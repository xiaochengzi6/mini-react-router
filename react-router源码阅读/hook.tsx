import * as React from "react";
import type {
  Location,
  ParamParseKey,
  Params,
  Path,
  PathMatch,
  PathPattern,
  Router as RemixRouter,
  To,
} from "@remix-run/router";
import {
  Action as NavigationType,
  invariant,
  isRouteErrorResponse,
  joinPaths,
  matchPath,
  matchRoutes,
  parsePath,
  resolveTo,
  warning,
  UNSAFE_getPathContributingMatches as getPathContributingMatches,
} from "@remix-run/router";

import type {
  NavigateOptions,
  RouteContextObject,
  RouteMatch,
  RouteObject,
  DataRouteMatch,
  RelativeRoutingType,
} from "./context";
import {
  DataRouterContext,
  DataRouterStateContext,
  LocationContext,
  NavigationContext,
  RouteContext,
  RouteErrorContext,
  AwaitContext,
  DataStaticRouterContext,
} from "./context";

/**
 * Returns the full href for the given "to" value. This is useful for building
 * custom links that are also accessible and preserve right-click behavior.
 *
 * @see https://reactrouter.com/docs/en/v6/hooks/use-href
 */
export function useHref(
  to: To,
  { relative }: { relative?: RelativeRoutingType } = {}
): string {
  invariant(
    useInRouterContext(),
    // TODO: This error is probably because they somehow have 2 versions of the
    // router loaded. We can help them understand how to avoid that.
    `useHref() may be used only in the context of a <Router> component.`
  );

  let { basename, navigator } = React.useContext(NavigationContext);
  let { hash, pathname, search } = useResolvedPath(to, { relative });

  let joinedPathname = pathname;

  // If we're operating within a basename, prepend it to the pathname prior
  // to creating the href.  If this is a root navigation, then just use the raw
  // basename which allows the basename to have full control over the presence
  // of a trailing slash on root links
  if (basename !== "/") {
    joinedPathname =
      pathname === "/" ? basename : joinPaths([basename, pathname]);
  }

  return navigator.createHref({ pathname: joinedPathname, search, hash });
}

/**
 * Returns true if this component is a descendant of a <Router>.
 *
 * @see https://reactrouter.com/docs/en/v6/hooks/use-in-router-context
 */
export function useInRouterContext(): boolean {
  return React.useContext(LocationContext) != null;
}

/**
 * Returns the current location object, which represents the current URL in web
 * browsers.
 *
 * Note: If you're using this it may mean you're doing some of your own
 * "routing" in your app, and we'd like to know what your use case is. We may
 * be able to provide something higher-level to better suit your needs.
 *
 * @see https://reactrouter.com/docs/en/v6/hooks/use-location
 */
export function useLocation(): Location {
  invariant(
    useInRouterContext(),
    // TODO: This error is probably because they somehow have 2 versions of the
    // router loaded. We can help them understand how to avoid that.
    `useLocation() may be used only in the context of a <Router> component.`
  );

  return React.useContext(LocationContext).location;
}

/**
 * Returns the current navigation action which describes how the router came to
 * the current location, either by a pop, push, or replace on the history stack.
 *
 * @see https://reactrouter.com/docs/en/v6/hooks/use-navigation-type
 */
export function useNavigationType(): NavigationType {
  return React.useContext(LocationContext).navigationType;
}

/**
 * Returns true if the URL for the given "to" value matches the current URL.
 * This is useful for components that need to know "active" state, e.g.
 * <NavLink>.
 *
 * @see https://reactrouter.com/docs/en/v6/hooks/use-match
 */
export function useMatch<
  ParamKey extends ParamParseKey<Path>,
  Path extends string
>(pattern: PathPattern<Path> | Path): PathMatch<ParamKey> | null {
  invariant(
    useInRouterContext(),
    // TODO: This error is probably because they somehow have 2 versions of the
    // router loaded. We can help them understand how to avoid that.
    `useMatch() may be used only in the context of a <Router> component.`
  );

  let { pathname } = useLocation();
  return React.useMemo(
    () => matchPath<ParamKey, Path>(pattern, pathname),
    [pathname, pattern]
  );
}

/**
 * The interface for the navigate() function returned from useNavigate().
 */
export interface NavigateFunction {
  (to: To, options?: NavigateOptions): void;
  (delta: number): void;
}

/**
 * Returns an imperative method for changing the location. Used by <Link>s, but
 * may also be used by other elements to change the location.
 *
 * @see https://reactrouter.com/docs/en/v6/hooks/use-navigate
 */
export function useNavigate(): NavigateFunction {
  invariant(
    useInRouterContext(),
    // TODO: This error is probably because they somehow have 2 versions of the
    // router loaded. We can help them understand how to avoid that.
    `useNavigate() may be used only in the context of a <Router> component.`
  );

  let { basename, navigator } = React.useContext(NavigationContext);
  let { matches } = React.useContext(RouteContext);
  let { pathname: locationPathname } = useLocation();

  let routePathnamesJson = JSON.stringify(
    getPathContributingMatches(matches).map((match) => match.pathnameBase)
  );

  let activeRef = React.useRef(false);
  React.useEffect(() => {
    activeRef.current = true;
  });

  let navigate: NavigateFunction = React.useCallback(
    (to: To | number, options: NavigateOptions = {}) => {
      warning(
        activeRef.current,
        `You should call navigate() in a React.useEffect(), not when ` +
          `your component is first rendered.`
      );

      if (!activeRef.current) return;

      if (typeof to === "number") {
        navigator.go(to);
        return;
      }

      let path = resolveTo(
        to,
        JSON.parse(routePathnamesJson),
        locationPathname,
        options.relative === "path"
      );

      // If we're operating within a basename, prepend it to the pathname prior
      // to handing off to history.  If this is a root navigation, then we
      // navigate to the raw basename which allows the basename to have full
      // control over the presence of a trailing slash on root links
      if (basename !== "/") {
        path.pathname =
          path.pathname === "/"
            ? basename
            : joinPaths([basename, path.pathname]);
      }

      (!!options.replace ? navigator.replace : navigator.push)(
        path,
        options.state,
        options
      );
    },
    [basename, navigator, routePathnamesJson, locationPathname]
  );

  return navigate;
}

const OutletContext = React.createContext<unknown>(null);

/**
 * Returns the context (if provided) for the child route at this level of the route
 * hierarchy.
 * @see https://reactrouter.com/docs/en/v6/hooks/use-outlet-context
 */
export function useOutletContext<Context = unknown>(): Context {
  return React.useContext(OutletContext) as Context;
}

/**
 * Returns the element for the child route at this level of the route
 * hierarchy. Used internally by <Outlet> to render child routes.
 *
 * @see https://reactrouter.com/docs/en/v6/hooks/use-outlet
 */
export function useOutlet(context?: unknown): React.ReactElement | null {
  let outlet = React.useContext(RouteContext).outlet;
  if (outlet) {
    return (
      <OutletContext.Provider value={context}>{outlet}</OutletContext.Provider>
    );
  }
  return outlet;
}

/**
 * Returns an object of key/value pairs of the dynamic params from the current
 * URL that were matched by the route path.
 *
 * @see https://reactrouter.com/docs/en/v6/hooks/use-params
 */
export function useParams<
  ParamsOrKey extends string | Record<string, string | undefined> = string
>(): Readonly<
  [ParamsOrKey] extends [string] ? Params<ParamsOrKey> : Partial<ParamsOrKey>
> {
  let { matches } = React.useContext(RouteContext);
  let routeMatch = matches[matches.length - 1];
  return routeMatch ? (routeMatch.params as any) : {};
}

/**
 * Resolves the pathname of the given `to` value against the current location.
 *
 * @see https://reactrouter.com/docs/en/v6/hooks/use-resolved-path
 */
export function useResolvedPath(
  to: To,
  { relative }: { relative?: RelativeRoutingType } = {}
): Path {
  let { matches } = React.useContext(RouteContext);
  let { pathname: locationPathname } = useLocation();

  let routePathnamesJson = JSON.stringify(
    getPathContributingMatches(matches).map((match) => match.pathnameBase)
  );

  return React.useMemo(
    () =>
      resolveTo(
        to,
        JSON.parse(routePathnamesJson),
        locationPathname,
        relative === "path"
      ),
    [to, routePathnamesJson, locationPathname, relative]
  );
}

/**
 * Returns the element of the route that matched the current location, prepared
 * with the correct context to render the remainder of the route tree. Route
 * elements in the tree must render an <Outlet> to render their child route's
 * element.
 *
 * @see https://reactrouter.com/docs/en/v6/hooks/use-routes
 */
export function useRoutes(
  routes: RouteObject[],
  locationArg?: Partial<Location> | string
): React.ReactElement | null {
  // 使用 useRoutes 外层必须有 Router 包裹 
  invariant(
    useInRouterContext(),
    // TODO: This error is probably because they somehow have 2 versions of the
    // router loaded. We can help them understand how to avoid that.
    `useRoutes() may be used only in the context of a <Router> component.`
  );
  // 取出 dataRouterState  
  let dataRouterStateContext = React.useContext(DataRouterStateContext);
  // 取出已经处理好的 matches 或者使默认值 [] (这里 matches 是存储了所有的路由)
  let { matches: parentMatches } = React.useContext(RouteContext);
  // 取出最后一个 也就是 会将其作为 父路由 (因为在处理 Route 时会保存在数组中然后会对其做一次排序，分数越高在最后)
  let routeMatch = parentMatches[parentMatches.length - 1];
  // 拿到 params, pathname, pathnameBase, route

  // 取出 父路由的参数 通常使用 useRoutes() 调用
  let parentParams = routeMatch ? routeMatch.params : {};
  // 父路由的完整 路径 比如 /foo/* 匹配 /foo/bar 
  let parentPathname = routeMatch ? routeMatch.pathname : "/";
  // 父路由的 根路径 /foo
  let parentPathnameBase = routeMatch ? routeMatch.pathnameBase : "/";
  let parentRoute = routeMatch && routeMatch.route;

  if (__DEV__) {
    // You won't get a warning about 2 different <Routes> under a <Route>
    // without a trailing *, but this is a best-effort warning anyway since we
    // cannot even give the warning unless they land at the parent route.
    //
    // Example:
    //
    // <Routes>
    //   {/* This route path MUST end with /* because otherwise
    //       it will never match /blog/post/123 */}
    //   <Route path="blog" element={<Blog />} />
    //   <Route path="blog/feed" element={<BlogFeed />} />
    // </Routes>
    //
    // function Blog() {
    //   return (
    //     <Routes>
    //       <Route path="post/:id" element={<Post />} />
    //     </Routes>
    //   );
    // }
    // 父节点不存在或者父节点尾后没有 * 都会使子节点无法渲染
    let parentPath = (parentRoute && parentRoute.path) || "";
    warningOnce(
      parentPathname,
      !parentRoute || parentPath.endsWith("*"),
      `You rendered descendant <Routes> (or called \`useRoutes()\`) at ` +
        `"${parentPathname}" (under <Route path="${parentPath}">) but the ` +
        `parent route path has no trailing "*". This means if you navigate ` +
        `deeper, the parent won't match anymore and therefore the child ` +
        `routes will never render.\n\n` +
        `Please change the parent <Route path="${parentPath}"> to <Route ` +
        `path="${parentPath === "/" ? "*" : `${parentPath}/*`}">.`
    );
  }

  let locationFromContext = useLocation();

  let location;
  if (locationArg) {
    let parsedLocationArg =
      typeof locationArg === "string" ? parsePath(locationArg) : locationArg;

    // 如果传入了 location，判断是否与父级路由匹配（作为子路由存在）
    invariant(
      parentPathnameBase === "/" ||
      /*如果 parentPathnameBase !== '/' 还要判断当前的 pathname 是否包含于 parentPathnameBase*/
        parsedLocationArg.pathname?.startsWith(parentPathnameBase), 
      `When overriding the location using \`<Routes location>\` or \`useRoutes(routes, location)\`, ` +
        `the location pathname must begin with the portion of the URL pathname that was ` +
        `matched by all parent routes. The current pathname base is "${parentPathnameBase}" ` +
        `but pathname "${parsedLocationArg.pathname}" was given in the \`location\` prop.`
    );

    location = parsedLocationArg;
  } else {
    // 如果没有传入 location 那就使用当前的 location
    location = locationFromContext;
  }

  let pathname = location.pathname || "/";

  // 获得当前路由的路径[本次 routes 要匹配的 pathname]
  let remainingPathname =
    parentPathnameBase === "/"
      ? pathname
      : pathname.slice(parentPathnameBase.length) || "/";

  // 这个非常关键
  // 传入对应的 routes 和 当前对应的路径
  let matches = matchRoutes(routes, { pathname: remainingPathname });

  if (__DEV__) {
    // parentRoute 不存在 
    warning(
      parentRoute || matches != null,
      `No routes matched location "${location.pathname}${location.search}${location.hash}" `
    );
    // 匹配值为空的情况
    warning(
      matches == null ||
        matches[matches.length - 1].route.element !== undefined,
      `Matched leaf route at location "${location.pathname}${location.search}${location.hash}" does not have an element. ` +
        `This means it will render an <Outlet /> with a null value by default resulting in an "empty" page.`
    );
  }

  // 返回的是 React.Element，渲染所有的 matches 对象
  let renderedMatches = _renderMatches(
    matches &&
      matches.map((match) =>
        Object.assign({}, match, {
          params: Object.assign({}, parentParams, match.params),
          pathname: joinPaths([parentPathnameBase, match.pathname]),
          pathnameBase:
            match.pathnameBase === "/"
              ? parentPathnameBase
              : joinPaths([parentPathnameBase, match.pathnameBase]),
        })
      ),
    // 父路由匹配的返回的 matches 
    parentMatches,
    // --???--
    dataRouterStateContext || undefined
  );

  // When a user passes in a `locationArg`, the associated routes need to
  // be wrapped in a new `LocationContext.Provider` in order for `useLocation`
  // to use the scoped location instead of the global location.
  if (locationArg && renderedMatches) {
    return (
      <LocationContext.Provider
        value={{
          location: {
            pathname: "/",
            search: "",
            hash: "",
            state: null,
            key: "default",
            ...location,
          },
          navigationType: NavigationType.Pop,
        }}
      >
        {renderedMatches}
      </LocationContext.Provider>
    );
  }

  return renderedMatches;
}

function DefaultErrorElement() {
  let error = useRouteError();
  let message = isRouteErrorResponse(error)
    ? `${error.status} ${error.statusText}`
    : error instanceof Error
    ? error.message
    : JSON.stringify(error);
  let stack = error instanceof Error ? error.stack : null;
  let lightgrey = "rgba(200,200,200, 0.5)";
  let preStyles = { padding: "0.5rem", backgroundColor: lightgrey };
  let codeStyles = { padding: "2px 4px", backgroundColor: lightgrey };
  return (
    <>
      <h2>Unhandled Thrown Error!</h2>
      <h3 style={{ fontStyle: "italic" }}>{message}</h3>
      {stack ? <pre style={preStyles}>{stack}</pre> : null}
      <p>💿 Hey developer 👋</p>
      <p>
        You can provide a way better UX than this when your app throws errors by
        providing your own&nbsp;
        <code style={codeStyles}>errorElement</code> props on&nbsp;
        <code style={codeStyles}>&lt;Route&gt;</code>
      </p>
    </>
  );
}

type RenderErrorBoundaryProps = React.PropsWithChildren<{
  location: Location;
  error: any;
  component: React.ReactNode;
}>;

type RenderErrorBoundaryState = {
  location: Location;
  error: any;
};

export class RenderErrorBoundary extends React.Component<
  RenderErrorBoundaryProps,
  RenderErrorBoundaryState
> {
  constructor(props: RenderErrorBoundaryProps) {
    super(props);
    this.state = {
      location: props.location,
      error: props.error,
    };
  }

  static getDerivedStateFromError(error: any) {
    return { error: error };
  }

  static getDerivedStateFromProps(
    props: RenderErrorBoundaryProps,
    state: RenderErrorBoundaryState
  ) {
    // When we get into an error state, the user will likely click "back" to the
    // previous page that didn't have an error. Because this wraps the entire
    // application, that will have no effect--the error page continues to display.
    // This gives us a mechanism to recover from the error when the location changes.
    //
    // Whether we're in an error state or not, we update the location in state
    // so that when we are in an error state, it gets reset when a new location
    // comes in and the user recovers from the error.
    if (state.location !== props.location) {
      return {
        error: props.error,
        location: props.location,
      };
    }

    // If we're not changing locations, preserve the location but still surface
    // any new errors that may come through. We retain the existing error, we do
    // this because the error provided from the app state may be cleared without
    // the location changing.
    return {
      error: props.error || state.error,
      location: state.location,
    };
  }

  componentDidCatch(error: any, errorInfo: any) {
    console.error(
      "React Router caught the following error during render",
      error,
      errorInfo
    );
  }

  render() {
    return this.state.error ? (
      <RouteErrorContext.Provider
        value={this.state.error}
        children={this.props.component}
      />
    ) : (
      this.props.children
    );
  }
}

interface RenderedRouteProps {
  routeContext: RouteContextObject;
  match: RouteMatch<string, RouteObject>;
  children: React.ReactNode | null;
}

function RenderedRoute({ routeContext, match, children }: RenderedRouteProps) {
  let dataStaticRouterContext = React.useContext(DataStaticRouterContext);

  // Track how deep we got in our render pass to emulate SSR componentDidCatch
  // in a DataStaticRouter
  if (dataStaticRouterContext && match.route.errorElement) {
    dataStaticRouterContext._deepestRenderedBoundaryId = match.route.id;
  }

  return (
    <RouteContext.Provider value={routeContext}>
      {children}
    </RouteContext.Provider>
  );
}

export function _renderMatches(
  matches: RouteMatch[] | null,
  parentMatches: RouteMatch[] = [],
  dataRouterState?: RemixRouter["state"]
): React.ReactElement | null {
  // 判断 matches 是否为 null 
  if (matches == null) {
    // 如果 data RouterState 存在，就会取出它的值
    if (dataRouterState?.errors) {
      // Don't bail if we have data router errors so we can render them in the
      // boundary.  Use the pre-matched (or shimmed) matches
      matches = dataRouterState.matches as DataRouteMatch[];
    } else {
      return null;
    }
  }

  let renderedMatches = matches;

  // If we have data errors, trim matches to the highest error boundary
  // 取出 dataRouterState 的值 如果 查找到的 matches 中 的 id 和它相等 那就去分割 matches 
  let errors = dataRouterState?.errors;
  if (errors != null) {
    let errorIndex = renderedMatches.findIndex(
      (m) => m.route.id && errors?.[m.route.id]
    );
    invariant(
      errorIndex >= 0,
      `Could not find a matching route for the current errors: ${errors}`
    );
    // errorIndex 之后的 路由全部舍弃
    renderedMatches = renderedMatches.slice(
      0,
      Math.min(renderedMatches.length, errorIndex + 1)
    );
  }

  return renderedMatches.reduceRight((outlet, match, index) => {
    let error = match.route.id ? errors?.[match.route.id] : null;
    // Only data routers handle errors
    let errorElement = dataRouterState
      ? match.route.errorElement || <DefaultErrorElement />
      : null;
    // 这里不断的将 outlet 传入下一个，通过倒序遍历 [matches] 数组 使最外层路由依次包裹内层路由 
    let getChildren = () => (
      <RenderedRoute
        match={match}
        routeContext={{
          outlet,
          matches: parentMatches.concat(renderedMatches.slice(0, index + 1)),
        }}
      >
        {error
          ? errorElement
          : match.route.element !== undefined
          ? match.route.element
          : outlet}
      </RenderedRoute>
    );
    // Only wrap in an error boundary within data router usages when we have an
    // errorElement on this route.  Otherwise let it bubble up to an ancestor
    // errorElement
    return dataRouterState && (match.route.errorElement || index === 0) ? (
      <RenderErrorBoundary
        location={dataRouterState.location}
        component={errorElement}
        error={error}
        children={getChildren()}
      />
    ) : (
      getChildren()
    );
  }, null as React.ReactElement | null);
}

enum DataRouterHook {
  UseRevalidator = "useRevalidator",
}

enum DataRouterStateHook {
  UseLoaderData = "useLoaderData",
  UseActionData = "useActionData",
  UseRouteError = "useRouteError",
  UseNavigation = "useNavigation",
  UseRouteLoaderData = "useRouteLoaderData",
  UseMatches = "useMatches",
  UseRevalidator = "useRevalidator",
}

function getDataRouterConsoleError(
  hookName: DataRouterHook | DataRouterStateHook
) {
  return `${hookName} must be used within a data router.  See https://reactrouter.com/en/main/routers/picking-a-router.`;
}

function useDataRouterContext(hookName: DataRouterHook) {
  let ctx = React.useContext(DataRouterContext);
  invariant(ctx, getDataRouterConsoleError(hookName));
  return ctx;
}

function useDataRouterState(hookName: DataRouterStateHook) {
  let state = React.useContext(DataRouterStateContext);
  invariant(state, getDataRouterConsoleError(hookName));
  return state;
}

/**
 * Returns the current navigation, defaulting to an "idle" navigation when
 * no navigation is in progress
 */
export function useNavigation() {
  let state = useDataRouterState(DataRouterStateHook.UseNavigation);
  return state.navigation;
}

/**
 * Returns a revalidate function for manually triggering revalidation, as well
 * as the current state of any manual revalidations
 */
export function useRevalidator() {
  let dataRouterContext = useDataRouterContext(DataRouterHook.UseRevalidator);
  let state = useDataRouterState(DataRouterStateHook.UseRevalidator);
  return {
    revalidate: dataRouterContext.router.revalidate,
    state: state.revalidation,
  };
}

/**
 * Returns the active route matches, useful for accessing loaderData for
 * parent/child routes or the route "handle" property
 */
export function useMatches() {
  let { matches, loaderData } = useDataRouterState(
    DataRouterStateHook.UseMatches
  );
  return React.useMemo(
    () =>
      matches.map((match) => {
        let { pathname, params } = match;
        // Note: This structure matches that created by createUseMatchesMatch
        // in the @remix-run/router , so if you change this please also change
        // that :)  Eventually we'll DRY this up
        return {
          id: match.route.id,
          pathname,
          params,
          data: loaderData[match.route.id] as unknown,
          handle: match.route.handle as unknown,
        };
      }),
    [matches, loaderData]
  );
}

/**
 * Returns the loader data for the nearest ancestor Route loader
 */
export function useLoaderData(): unknown {
  let state = useDataRouterState(DataRouterStateHook.UseLoaderData);

  let route = React.useContext(RouteContext);
  invariant(route, `useLoaderData must be used inside a RouteContext`);

  let thisRoute = route.matches[route.matches.length - 1];
  invariant(
    thisRoute.route.id,
    `useLoaderData can only be used on routes that contain a unique "id"`
  );

  return state.loaderData[thisRoute.route.id];
}

/**
 * Returns the loaderData for the given routeId
 */
export function useRouteLoaderData(routeId: string): unknown {
  let state = useDataRouterState(DataRouterStateHook.UseRouteLoaderData);
  return state.loaderData[routeId];
}

/**
 * Returns the action data for the nearest ancestor Route action
 */
export function useActionData(): unknown {
  let state = useDataRouterState(DataRouterStateHook.UseActionData);

  let route = React.useContext(RouteContext);
  invariant(route, `useActionData must be used inside a RouteContext`);

  return Object.values(state?.actionData || {})[0];
}

/**
 * Returns the nearest ancestor Route error, which could be a loader/action
 * error or a render error.  This is intended to be called from your
 * errorElement to display a proper error message.
 */
export function useRouteError(): unknown {
  let error = React.useContext(RouteErrorContext);
  let state = useDataRouterState(DataRouterStateHook.UseRouteError);
  let route = React.useContext(RouteContext);
  let thisRoute = route.matches[route.matches.length - 1];

  // If this was a render error, we put it in a RouteError context inside
  // of RenderErrorBoundary
  if (error) {
    return error;
  }

  invariant(route, `useRouteError must be used inside a RouteContext`);
  invariant(
    thisRoute.route.id,
    `useRouteError can only be used on routes that contain a unique "id"`
  );

  // Otherwise look for errors from our data router state
  return state.errors?.[thisRoute.route.id];
}

/**
 * Returns the happy-path data from the nearest ancestor <Await /> value
 */
export function useAsyncValue(): unknown {
  let value = React.useContext(AwaitContext);
  return value?._data;
}

/**
 * Returns the error from the nearest ancestor <Await /> value
 */
export function useAsyncError(): unknown {
  let value = React.useContext(AwaitContext);
  return value?._error;
}

const alreadyWarned: Record<string, boolean> = {};

function warningOnce(key: string, cond: boolean, message: string) {
  if (!cond && !alreadyWarned[key]) {
    alreadyWarned[key] = true;
    warning(false, message);
  }
}