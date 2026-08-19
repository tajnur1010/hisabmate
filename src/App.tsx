import { lazy, Suspense } from 'react';
import { BrowserRouter, Route, Routes } from 'react-router-dom';

import { ThemeProvider } from '@/contexts/ThemeContext';
import { I18nProvider } from '@/contexts/I18nContext';
import { SettingsProvider } from '@/contexts/SettingsContext';
import { ToastProvider } from '@/contexts/ToastContext';
import { AuthProvider } from '@/contexts/AuthContext';
import { DataProvider } from '@/contexts/DataContext';
import { SyncProvider } from '@/contexts/SyncContext';
import { QuickActionsProvider } from '@/features/quick-actions/QuickActions';

import { RequireAuth, RedirectIfAuthed } from '@/routes/RequireAuth';
import { RequireBusiness, RedirectIfBusiness } from '@/routes/RequireBusiness';
import { AppLayout } from '@/components/layout/AppLayout';
import { Splash } from '@/components/Splash';

// Route-level code splitting: each screen ships in its own chunk so the initial
// load stays light on the low-end phones this app targets. While a chunk loads,
// the router shows the brand splash via <Suspense>.
const Login = lazy(() => import('@/pages/auth/Login'));
const Signup = lazy(() => import('@/pages/auth/Signup'));
const ForgotPassword = lazy(() => import('@/pages/auth/ForgotPassword'));
const ResetPassword = lazy(() => import('@/pages/auth/ResetPassword'));
const Onboarding = lazy(() => import('@/pages/auth/Onboarding'));
const Dashboard = lazy(() => import('@/pages/Dashboard'));
const Customers = lazy(() => import('@/pages/Customers'));
const Suppliers = lazy(() => import('@/pages/Suppliers'));
const PartyProfile = lazy(() => import('@/pages/PartyProfile'));
const Products = lazy(() => import('@/pages/Products'));
const ProductProfile = lazy(() => import('@/pages/ProductProfile'));
const Transactions = lazy(() => import('@/pages/Transactions'));
const Expenses = lazy(() => import('@/pages/Expenses'));
const Reports = lazy(() => import('@/pages/Reports'));
const Settings = lazy(() => import('@/pages/Settings'));
const Search = lazy(() => import('@/pages/Search'));
const Help = lazy(() => import('@/pages/Help'));
const NotFound = lazy(() => import('@/pages/NotFound'));

/**
 * Composition root. Providers are nested outer→inner so that inner contexts can
 * consume the ones above them:
 *
 *   Theme → I18n → Settings → Toast → Auth → Data → Sync → QuickActions → Router
 *
 * Theme/I18n/Settings are UI-shell concerns with no dependencies. Auth gates the
 * session; Data loads the signed-in user's ledger; Sync watches the offline
 * outbox on top of Data; QuickActions renders the global entry sheets and needs
 * Data + I18n. None of these use router hooks, so the whole stack sits above the
 * BrowserRouter.
 */
export default function App() {
  return (
    <ThemeProvider>
      <I18nProvider>
        <SettingsProvider>
          <ToastProvider>
            <AuthProvider>
              <DataProvider>
                <SyncProvider>
                  <QuickActionsProvider>
                    <BrowserRouter>
                      <Suspense fallback={<Splash />}>
                        <Routes>
                          {/* Public auth screens — bounce authed users to the app. */}
                          <Route element={<RedirectIfAuthed />}>
                            <Route path="/login" element={<Login />} />
                            <Route path="/signup" element={<Signup />} />
                            <Route path="/forgot" element={<ForgotPassword />} />
                          </Route>

                          {/* Password recovery lands here with a temporary session,
                              so it stays outside RedirectIfAuthed and RequireAuth. */}
                          <Route path="/reset" element={<ResetPassword />} />

                          {/* Authenticated area. */}
                          <Route element={<RequireAuth />}>
                            {/* First-run business setup, shown only until a business exists. */}
                            <Route element={<RedirectIfBusiness />}>
                              <Route path="/onboarding" element={<Onboarding />} />
                            </Route>

                            {/* Main app shell — requires a configured business. */}
                            <Route element={<RequireBusiness />}>
                              <Route element={<AppLayout />}>
                                <Route index element={<Dashboard />} />
                                <Route path="customers" element={<Customers />} />
                                <Route path="customers/:id" element={<PartyProfile />} />
                                <Route path="suppliers" element={<Suppliers />} />
                                <Route path="suppliers/:id" element={<PartyProfile />} />
                                <Route path="products" element={<Products />} />
                                <Route path="products/:id" element={<ProductProfile />} />
                                <Route path="transactions" element={<Transactions />} />
                                <Route path="expenses" element={<Expenses />} />
                                <Route path="reports" element={<Reports />} />
                                <Route path="settings" element={<Settings />} />
                                <Route path="help" element={<Help />} />
                                <Route path="search" element={<Search />} />
                              </Route>
                            </Route>
                          </Route>

                          <Route path="*" element={<NotFound />} />
                        </Routes>
                      </Suspense>
                    </BrowserRouter>
                  </QuickActionsProvider>
                </SyncProvider>
              </DataProvider>
            </AuthProvider>
          </ToastProvider>
        </SettingsProvider>
      </I18nProvider>
    </ThemeProvider>
  );
}
