import './App.css';
import { Routes, Route, useMatch, useRoutes } from "react-router-dom";
import Users from './Users';
import Id from './Id'

function App() {
  let element = useRoutes([
    {
      path: "/",
      element: <Users />,
      children: [
        {
          path: "messages",
          element: <Users />,
        },
        { path: "tasks", element: <Users /> },
      ],
    },
    { path: "team", element: <Users /> },
  ]);
  console.log('element:', element)
  return element
}

export default App;
