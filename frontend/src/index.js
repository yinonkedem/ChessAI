import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';

import {createBrowserRouter, RouterProvider} from "react-router-dom";
import routes from "./routes";  // we’ll define this next

const root = ReactDOM.createRoot(document.getElementById('root'));

const router = createBrowserRouter(routes, {
    future: {
        v7_startTransition: true,
        v7_relativeSplatPath: true,
    },
});

root.render(
    <React.StrictMode>
        <RouterProvider router={router}/>
    </React.StrictMode>
);