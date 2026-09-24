import { Link, Outlet } from 'react-router-dom';
import type { RouteObject } from 'react-router-dom';

import { HomePage } from '@/pages/HomePage';
import { PracticePage } from '@/pages/PracticePage';
import { TestOverviewPage } from '@/pages/TestOverviewPage';
import { TestResultPage } from '@/pages/TestResultPage';
import { TestSectionPage } from '@/pages/TestSectionPage';

/**
 * The route table, kept separate from `App` so tests can mount it in a memory
 * router while the app mounts it in a browser router.
 */

export function AppShell() {
  return (
    <div className="min-h-screen bg-ink-50 text-ink-900">
      <header className="border-b border-ink-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <Link to="/" className="flex items-center gap-2.5">
            <span
              className="flex h-8 w-8 items-center justify-center rounded-md bg-brand-600 text-sm font-bold text-white"
              aria-hidden="true"
            >
              d
            </span>
            <span>
              <span className="block text-sm font-bold leading-tight text-ink-900">
                dMAT Mock Test
              </span>
              <span className="block text-[11px] leading-tight text-ink-500">
                Core Module practice platform
              </span>
            </span>
          </Link>
          <p className="hidden text-xs text-ink-500 sm:block">
            Unofficial practice platform · original questions
          </p>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8">
        <Outlet />
      </main>

      <footer className="border-t border-ink-200 bg-white">
        <div className="mx-auto max-w-7xl px-4 py-5 text-xs leading-relaxed text-ink-500 sm:px-6">
          Built for practice only and not affiliated with g.a.s.t. / TestDaF-Institut. The exam
          structure follows the official dMAT preparatory materials for test takers; all questions
          are original. Progress is stored in your browser only.
        </div>
      </footer>
    </div>
  );
}

function NotFound() {
  return (
    <div className="py-16 text-center">
      <h1 className="text-2xl font-bold text-ink-900">Page not found</h1>
      <p className="mt-2 text-sm text-ink-600">That route does not exist.</p>
      <Link
        to="/"
        className="mt-4 inline-block rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white"
      >
        Back to the mock tests
      </Link>
    </div>
  );
}

export const routes: RouteObject[] = [
  {
    path: '/',
    element: <AppShell />,
    children: [
      { index: true, element: <HomePage /> },
      { path: 'test/:testId', element: <TestOverviewPage /> },
      { path: 'test/:testId/section/:sectionId', element: <TestSectionPage /> },
      { path: 'test/:testId/result', element: <TestResultPage /> },
      { path: 'practice/:testId', element: <PracticePage /> },
      { path: '*', element: <NotFound /> },
    ],
  },
];
