import { Navigate, Outlet } from 'react-router-dom';
import { useData } from '@/contexts/DataContext';
import { Splash } from '@/components/Splash';
import { DataUnavailable } from '@/components/DataUnavailable';

/**
 * Requires that the signed-in user has completed business setup. While the
 * first data load is in flight we show the splash; with no business we send
 * the user to onboarding.
 *
 * The `loadFailed` case is kept separate on purpose: a failed load also leaves
 * `hasBusiness` false, and treating that as "no shop yet" would walk an offline
 * user straight into creating a duplicate shop.
 */
export function RequireBusiness() {
  const { ready, hasBusiness, loadFailed } = useData();
  if (!ready) return <Splash />;
  if (!hasBusiness && loadFailed) return <DataUnavailable />;
  if (!hasBusiness) return <Navigate to="/onboarding" replace />;
  return <Outlet />;
}

/** Redirects to the dashboard once a business exists (used on /onboarding). */
export function RedirectIfBusiness() {
  const { ready, hasBusiness, loadFailed } = useData();
  if (!ready) return <Splash />;
  if (hasBusiness) return <Navigate to="/" replace />;
  // Never let someone set up a second shop while we can't see the first.
  if (loadFailed) return <DataUnavailable />;
  return <Outlet />;
}
