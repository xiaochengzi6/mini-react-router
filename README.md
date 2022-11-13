> 这篇文章介绍了react-router 的历史以及部分源码[react-router路由的历史](https://blog.csdn.net/qiwoo_weekly/article/details/127116248)

react-routerV6 版本提供一个多元的使用方式它结合 组件 + hook + react/router 的这种方式，非常灵活相对的就会造成在使用场景上需要结合文档去研究。

## 入口
react-router 可以简单分割为 `存储`、 `修改`、 `获取`这三个方向。

![](https://user-images.githubusercontent.com/63789659/201518066-b86c6983-23ea-47ce-8af2-deff2c6445b1.png)

### 存储：状态(数据)存储于 `context` 中
就拿 `<BrowserRouter />` 组件来说，它会位于根组件的位置，它会将 `history` 对象并且每一次 history 对象发生修改那就会响应的重新渲染以确保每一次都能获取最新的 `location` 对象 和 `action` 

从源码的角度上看它将使用 `NavigationContext` 主要保存 history 对象， `LocationContext` 主要保存 location 对象方便对其操作

在去修改路由之前还要介绍一下它的`匹配规则`，先制定`路由匹配规则`修改路由才能找到对应的`element`(这里的`element`的是匹配到路径才能去渲染的组件)它会将匹配到路径的对象都保存在 `RouteContext` 中，之后就可以对匹配到的数据进行处理

### 修改: 改变 url 路径的变化
`<Navigate />` 组件或者`useNavigate`可以去获取当前 location 对象然后去调用 `history` 对象的 `push` 或者 `replace` 然后去跳转路径 由于去调用的是 history 对象的方法 就会触发 lister 监听函数，从而会更新组件 然后开始找到对应匹配的`matchers`对象开始`渲染组件`。修改路径差不多都是这样的原理

### 读取: 获取 url 改变后的状态
如何获取 `url` 的状态在 v6 版本中大多数都是使用 hooks 不再 props 中取值了，比如 `useLocation` 获得当前的 location 对象 或者 `useMatches` 获取当前匹配的 matches 对象 

## useRoutes 的源码分析

=======
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

3.之后打平 route 将其所有的子路由(每一个子路由都是 `route` )都放置在自身的前面，为每一个 route 都创建一个对象,根据 path 和 index 得出它的权重 score
~~~js
let path = joinPaths([parentPath, meta.relativePath]);
const route = { path, score: computeScore(path, route.index), routesMeta }
~~~
`routesMeta` 是一个数组，它包含了所有的上层路由 meta 以及自身路由 meta 。 

最后将处理好的值返回也就是 `branches`

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

(3) `matchRouteBranch` 函数
这个函数会去遍历 `branches` 数组取出一个 branch 去遍历里面的 `routesMeta数组` 然后看看是否和传入的 `pathname` 是否相互匹配，不匹配就会直接返回进行下一个 branch 去匹配，直到找到一个 routesMeta 数组中所有的 meta 的path 都能和 `pathname` 匹配上就会返回一个 `matches` 数组，这个数组存有被包装过的 meta     

### 二、渲染阶段 [`_renderMatches` 函数]

在渲染阶段主要就是将得到的 matches 数组去遍历，采用后序遍历的方式，将每一个 route 都包装上 `<RenderedRoute />` 组件并以 `outlet` 的形式返还给下一个 `<RenderedRoute />`组件 这样最外层的路由包裹着最内层的路由，形成了一个嵌套组件。
