import { RouterProvider, createBrowserRouter } from 'react-router-dom';

import { routes } from '@/routes';

/**
 * A data router is used deliberately: `useBlocker` — which keeps a running
 * section from being navigated away from — is only available on data routers.
 */
export const router = createBrowserRouter(routes);

export function App() {
  return <RouterProvider router={router} />;
}
