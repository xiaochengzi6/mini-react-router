> 这篇文章介绍了react-router 的历史以及部分源码[react-router路由的历史](https://blog.csdn.net/qiwoo_weekly/article/details/127116248)

react-routerV6 版本提供一个多元的使用方式它结合 组件 + hook + react/router 的这种方式，非常灵活相对的就会造成在使用场景上需要结合文档去研究。

## react-router
react-router 可以简单分割为 `存储`、 `修改`、 `获取`这三个方向。

![](https://user-images.githubusercontent.com/63789659/201518066-b86c6983-23ea-47ce-8af2-deff2c6445b1.png)

**存储：状态(数据)存储于 `context` 中**
就拿 `<BrowserRouter />` 组件来说，它会位于根组件的位置，它会将 `history` 对象并且每一次 history 对象发生修改那就会响应的重新渲染以确保每一次都能获取最新的 `location` 对象 和 `action` 

从源码的角度上看它将使用 `NavigationContext` 主要保存 history 对象， `LocationContext` 主要保存 location 对象方便对其操作

在去修改路由之前还要介绍一下它的`匹配规则`，先制定`路由匹配规则`修改路由才能找到对应的`element`(这里的`element`的是匹配到路径才能去渲染的组件)它会将匹配到路径的对象都保存在 `RouteContext` 中，之后就可以对匹配到的数据进行处理

**修改: 改变 url 路径的变化**
`<Navigate />` 组件或者`useNavigate`可以去获取当前 location 对象然后去调用 `history` 对象的 `push` 或者 `replace` 然后去跳转路径 由于去调用的是 history 对象的方法 就会触发 lister 监听函数，从而会更新组件 然后开始找到对应匹配的`matchers`对象开始`渲染组件`。修改路径差不多都是这样的原理

**读取: 获取 url 改变后的状态**
如何获取 `url` 的状态在 v6 版本中大多数都是使用 hooks 不再 props 中取值了，比如 `useLocation` 获得当前的 location 对象 或者 `useMatches` 获取当前匹配的 matches 对象 

`react-router` 存在两中路由方式
1. 数据路由
2. 组件路由

数据路由是由 `createBrowserRouter`、`createHashRouter`、`createMemoryRouter` 等这些函数构造而成

使用 `create*`这类的构造函数传入 routes 对象是一种嵌套类型的对象，这种嵌套反映了路由的父子关系去遍历生成 routes 类似于 useRoutes  对 routes 的处理

它会返回一个 `route`的对象
~~~js
 router = {
    get basename() {
      return init.basename;
    },
    get state() {
      return state;
    },
    get routes() {
      return dataRoutes;
    },
    initialize,
    subscribe,
    enableScrollRestoration,
    navigate,
    fetch,
    revalidate,
    createHref: ,
    getFetcher,
    deleteFetcher,
    dispose,
    _internalFetchControllers: fetchControllers,
    _internalActiveDeferreds: activeDeferreds,
  };
~~~

这样使用
~~~js
import {
  createBrowserRouter,
  RouterProvider,
} from "react-router-dom";import ()

const router = createBrowserRouter([
  {
    path: '/',
    element: <Root />,
    loader: () => {},
    children: [
      {
        path: 'team',
        element: <Team />,
        loader: () => {}
      }
    ]
  }
])

ReactDOM.createRoot(document.getElementById("root")).render(
  <RouterProvider router={router}>
)
~~~

数据路由没有仔细看过这里，简单看一下组件路由

<BrowserRouter> 组件的使用方式

它会提供一个干净的路由将当前位置存储在浏览器的地址栏中，并使用浏览器内置的历史堆栈进行导航。
~~~jsx
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";

const root = createRoot(document.getElementById("root"));

root.render(
  <BrowserRouter>
    <App />
  </BrowserRouter>
);
~~~

它的源码，比较简单，大致看一下
~~~jsx
export function BrowserRouter({
   basename,
   children,
   window,
 }: BrowserRouterProps) {
   let historyRef = React.useRef<BrowserHistory>();
   if (historyRef.current == null) {
     historyRef.current = createBrowserHistory({ window, v5Compat: true });
   }
 
   let history = historyRef.current;
   // 创建一个 state 状态
   // 观察过 history 库可以明白 history.listen() 的参数会接收 {action, location}
   let [state, setState] = React.useState({
     action: history.action,
     location: history.location,
   });

   // 在 dom 改变之前去往 history 添加 setState 事件，每次 history 更新都要添加
   // 当 url 发生变化就会通过 history 库去触发 监听时间让整个组件更新
   React.useLayoutEffect(() => history.listen(setState), [history]);
 
   return (
     <Router
       basename={basename}
       children={children}
       location={state.location}
       navigationType={state.action}
       navigator={history}
     />
   );
 }
~~~

这里看一下 `Router` 的源码

~~~jsx
export function Router({
  basename: basenameProp = "/",
  children = null,
  location: locationProp,
  navigationType = NavigationType.Pop,
  navigator,
  static: staticProp = false,
}: RouterProps): React.ReactElement | null {
  invariant(
    !useInRouterContext(),
    `You cannot render a <Router> inside another <Router>.` +
      ` You should never have more than one in your app.`
  );

  // 比如：giao/* 会处理成 giao
  let basename = basenameProp.replace(/^\/*/, "/");

  // 存在 context 中 
  let navigationContext = React.useMemo(
    () => ({ basename, navigator, static: staticProp }),
    [basename, navigator, staticProp]
  );
  
  // location 如果是字符串就要解析成 对象
  if (typeof locationProp === "string") {
    // 将字符串解析为 pathname, search, hash 属性的对象
    locationProp = parsePath(locationProp);
  }

  let {
    pathname = "/",
    search = "",
    hash = "",
    state = null,
    key = "default",
  } = locationProp;


  // 构建一个当前的 location
  let location = React.useMemo(() => {
    // 这里的函数表明 basename 一定被包含于 pathname 才行
    // 如果不是这样的关系就会返回 null ，如果 pathname === '/' 就直接返回 
    // 假如pathname: 'foo/name/www', basename: 'foo/' 那就会返回 foo/ 之后的 pathname 字符串
    let trailingPathname = stripBasename(pathname, basename);

    if (trailingPathname == null) {
      return null;
    }

    return {
      pathname: trailingPathname,
      search,
      hash,
      state,
      key,
    };
  }, [basename, pathname, search, hash, state, key]);

  warning(
    location != null,
    `<Router basename="${basename}"> is not able to match the URL ` +
      `"${pathname}${search}${hash}" because it does not start with the ` +
      `basename, so the <Router> won't render anything.`
  );

  if (location == null) {
    return null;
  }

  return (
    // NavigationContext 是一个 context 存储 navigationContext
    <NavigationContext.Provider value={navigationContext}>
      <LocationContext.Provider
        children={children}
        value={{ location, navigationType }}
      />
    </NavigationContext.Provider>
  );
}
~~~

接下来使用 `useRoutes` hook 来创建一些 匹配规则，匹配到响应的 `url`渲染相应的组件
~~~jsx
import { useRoutes } from 'react-router-dom'

const routes =   {
    path: '/',
    element: <HomeLayout />,
    children: [
      {
        path: '',
        element: <Navigate to="spylist" />
      },
      // 实时信息
      {
        path: 'spylist',
        element: <SpyList />
      }
    ]
}

function App() {
  return useRoutes(routes)
}

export default App
~~~

## useRoutes 的源码分析

useRoutes 是核心代码 也是颇有难度的代码 是 react-router 中最值得看的代码 
<img src="https://user-images.githubusercontent.com/63789659/201244704-28af8010-0a7c-43f4-923d-b968e56d55e6.png" alt="fg" style="zoom:200%;" />

### 一、匹配阶段 [`matchRoutes` 函数]

(1) `flattenRoutes` 函数主要做了那些事情？
1.首先它会得到一个 `routes` 的对象，这个对象是你通过 `useRoutes`传入的或者是你使用 `<Routes />`和 `<Route />` 组件传入的，它是一种嵌套类型的对象，这种嵌套反映了路由的父子关系

~~~js
{
  path: '/',
  children: [
    0: {index: true, element: {},  },
    1: {
      path: '/courses', 
      children: {
        {index: true, element: {}},
        {path: '/courses/:id', element: {}}
      }, 
      element: {}
    },
    2: {path: '*', element: {}}
  ],
  element: {} // 这里是与之匹配的组件
}
~~~
2.遍历 `routes` 利用 route 创建 meta 对象,`relativePath`是自身路径减去父路由路径，这样确保每一个 meta 都是一个独立的相对路由。

~~~js
let meta = {
  relativePath: route.path || "",
  caseSensitive: route.caseSensitive === true, // 判断是否大小写 不传入就是 false 
  childrenIndex: index,
  route,
};

meta.relativePath = meta.relativePath.slice(parentPath.length);
~~~

这里先组装一下 path 
~~~js
// 完整的 path，合并了父路由的 path 并然后再过滤掉 '//'
let path = joinPaths([parentPath, meta.relativePath]);
// 存储 meta 对象, 这里会将子路由和父路由存放在一起
let routesMeta = parentsMeta.concat(meta);
~~~

在递归遍历子路由都放在 `parentsMeta` 父路由中, 将其所有的子路由(每一个子路由都是 `route` )都放置在自身的前面，
~~~js
if(route.children && route.childre.length > 0){
  // 递归调用 [会将子路由放置在父路由的前面, 深度优先]
  flattenRoutes(route.children, branches, routesMeta, path);
}
~~~

3.为每一个 route 都创建一个对象,根据 path 和 index 得出它的权重 score
~~~js
const route = { path, score: computeScore(path, route.index), routesMeta }
~~~
`routesMeta` 是一个数组，它包含了所有的上层路由 meta 以及自身路由 meta 。 

最后将处理好的值返回也就是 `branches`

计算 `score` 值
~~~js
// 存在 ':xxx' 参数
const paramRe = /^:\w+$/;
// 判断有无 '*'
const isSplat = (s: string) => s === "*";

function computeScore(path: string, index: boolean | undefined): number {
  // 将字符串如'/path/res/vala' 拆分成数组['path', 'res', 'vala']
  let segments = path.split("/"); 
  let initialScore = segments.length;

  if (segments.some(isSplat)) {
    // 优先级 -2
    initialScore += (-2);
  }

  if (index) {
    // 索引路由 优先级 2
    initialScore += 2;
  }

/**
 * 1. 路由存在参数 +3
 * 2. 路由为空    +1
 * 3. 有路径      +10
*/
  return segments
    .filter((s) => !isSplat(s))
    .reduce(
      (score, segment) =>
        score +
        (paramRe.test(segment)
          ? 3
          : segment === ""
          ? 1
          : 10),
      initialScore
    );
}
~~~
以下是返回的东西
~~~js
[
  {path: '/', score: 6, routesMeta: Array(2)}
  {path: '/courses/', score: 17, routesMeta: Array(3)}
  {path: '/courses/:id', score: 17, routesMeta: Array(3)}
  {path: '/courses', score: 13, routesMeta: Array(2)}
  {path: '/*', score: 1, routesMeta: Array(2)}
  {path: '/', score: 4, routesMeta: Array(1)}
]
~~~
需要注意的是: `path` 是自身路径 + 父路径，`routesMeta` 中 每一个 meta 是 slice 父路径之后的路径

(2) `rankRouteBranches` 函数

它主要会对 `branches` 数据进行排序，根据 score 大小去排序，较大的会被排序在前面

~~~js
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

function compareIndexes(a: number[], b: number[]): number {
  // 子节点判断
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
~~~


(3) `matchRouteBranch` 函数
这个函数会去遍历 `branches` 数组取出一个 branch 去遍历里面的 `routesMeta数组` 然后看看是否和传入的 `pathname` 是否相互匹配，不匹配就会直接返回进行下一个 branch 去匹配，直到找到一个 routesMeta 数组中所有的 meta 的path 都能和 `pathname` 匹配上就会返回一个 `matches` 数组，这个数组存有被包装过的 meta     

### 二、渲染阶段 [`_renderMatches` 函数]

在渲染阶段主要就是将得到的 matches 数组去遍历，采用后序遍历的方式，将每一个 route 都包装上 `<RenderedRoute />` 组件并以 `outlet` 的形式返还给下一个 `<RenderedRoute />`组件 这样最外层的路由包裹着最内层的路由，形成了一个嵌套组件。


#### 参考文章
[掘金-React-Router v6 源码完全解读指南](https://juejin.cn/post/7067436563457638413#heading-22)
