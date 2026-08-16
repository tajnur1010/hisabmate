import { Navigate, Outlet } from 'react-router-dom';
import { useData } from '@/contexts/DataContext';
import { Splash } from '@/components/Splash';

/**
 * Requires that the signed-in user has completed business setup. While the
 * first data load is in flight we show the splash; with no business we send
 * the user to onboarding.
 */
export function RequireBusiness() {
  const { ready, hasBusiness } = useData();
  if (!ready) return <Splash />;
  if (!hasBusiness) return <Navigate to="/onboarding" replace />;
  return <Outlet />;
}

/** Redirects to the dashboard once a business exists (used on /onboarding). */
export function RedirectIfBusiness() {
  const { ready, hasBusiness } = useData();
  if (!ready) return <Splash />;
  if (hasBusiness) return <Navigate to="/" replace />;
  return <Outlet />;
}
