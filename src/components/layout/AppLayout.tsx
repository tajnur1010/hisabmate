import { Outlet, useLocation } from 'react-router-dom';
import { TopBar } from './TopBar';
import { BottomNav } from './BottomNav';

/**
 * The app shell. HisabMate is phone-first: on any screen the interface is a
 * single centered phone-width column (max 480px), with the surrounding area on
 * wide screens acting as a calm backdrop rather than a desktop layout. The
 * header and bottom navigation stay fixed while the routed page scrolls.
 *
 * Detail views — a single customer/supplier profile (`/customers/:id`,
 * `/suppliers/:id`) or a single product (`/products/:id`) — carry their own
 * contextual sub-header (back / edit / delete), so the global TopBar is hidden
 * there to avoid stacking two headers, which reads as duplicate chrome. The
 * bottom nav stays put so the primary destinations remain one tap away and
 * never overlap the scrolling content.
 */
const DETAIL_ROUTE = /^\/(customers|suppliers|products)\/[^/]+$/;

export function AppLayout() {
  const { pathname } = useLocation();
  const hideTopBar = DETAIL_ROUTE.test(pathname);

  return (
    <div className="flex h-dvh justify-center bg-surface-2">
      <div className="relative flex h-dvh w-full max-w-[480px] flex-col overflow-hidden bg-bg sm:border-x sm:border-line sm:shadow-lifted">
        {!hideTopBar && <TopBar />}
        <main className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-contain">
          <Outlet />
        </main>
        <BottomNav />
      </div>
    </div>
  );
}
