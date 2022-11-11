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