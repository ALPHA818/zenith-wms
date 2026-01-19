import '@/lib/errorReporter';
import { enableMapSet } from "immer";
enableMapSet();
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import {
  createBrowserRouter,
  createHashRouter,
  RouterProvider,
  Navigate,
} from "react-router-dom";
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { RouteErrorBoundary } from '@/components/RouteErrorBoundary';
import '@/index.css'
// Page Imports
import { LoginPage } from '@/pages/LoginPage';
import { HomePage } from '@/pages/HomePage'
import { InventoryPage } from '@/pages/InventoryPage';
import { OrdersPage } from '@/pages/OrdersPage';
import { ShipmentsPage } from '@/pages/ShipmentsPage';
import { ReportsPage } from '@/pages/ReportsPage';
import { SettingsPage } from '@/pages/SettingsPage';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import { JobCardsPage } from '@/pages/JobCardsPage';
import { JobsPage } from '@/pages/JobsPage';
import { LocationsPage } from '@/pages/LocationsPage';
import ChatPage from '@/pages/ChatPage';
import { GroupsPage } from '@/pages/GroupsPage';
import { PalletProdPage } from '@/pages/PalletProdPage';
import { PalletRawPage } from '@/pages/PalletRawPage';
import { QCPage } from '@/pages/QCPage';
import { ScanningPage } from '@/pages/ScanningPage';
import { ProductionPage } from '@/pages/ProductionPage';
import ProductionEventPage from '@/pages/ProductionEventPage';
// Use hash routing in packaged/prod to avoid 404s in file:// and zipped builds
const isFile = typeof window !== 'undefined' && window.location && window.location.protocol === 'file:';
const useHash = isFile || (import.meta as any).env?.PROD;
// Ensure hash exists on initial load in packaged Electron
if (typeof window !== 'undefined') {
  if (useHash && !window.location.hash) {
    window.location.hash = '/';
  }
}

const routes = [
  {
    path: "/login",
    element: <LoginPage />,
    errorElement: <RouteErrorBoundary />,
  },
  {
    path: "/",
    element: <ProtectedRoute />,
    errorElement: <RouteErrorBoundary />,
    children: [
      {
        path: "/",
        element: <HomePage />,
      },
      {
        path: "/inventory",
        element: <InventoryPage />,
      },
      {
        path: "/orders",
        element: <OrdersPage />,
      },
      {
        path: "/shipments",
        element: <ShipmentsPage />,
      },
      {
        path: "/locations",
        element: <LocationsPage />,
      },
      {
        path: "/pallet-prod",
        element: <PalletProdPage />,
      },
      {
        path: "/pallet-raw",
        element: <PalletRawPage />,
      },
      {
        path: "/job-cards",
        element: <JobCardsPage />,
      },
      {
        path: "/jobs",
        element: <JobsPage />,
      },
      {
        path: "/reports",
        element: <ReportsPage />,
      },
      {
        path: "/settings",
        element: <SettingsPage />,
      },
      {
        path: "/chat",
        element: <ChatPage />,
      },
      {
        path: "/groups",
        element: <GroupsPage />,
      },
      {
        path: "/qc",
        element: <QCPage />,
      },
      {
        path: "/scanning",
        element: <ScanningPage />,
      },
      {
        path: "/production",
        element: <ProductionPage />,
      },
      {
        path: "/production-event/:id",
        element: <ProductionEventPage />,
      },
    ]
  }
  ,
  // Catch-all: redirect to home to avoid 404 in packaged builds
  {
    path: "*",
    element: <Navigate to="/" replace />,
  }
];
const router = useHash ? createHashRouter(routes) : createBrowserRouter(routes);
// Do not touch this code
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <RouterProvider router={router} />
    </ErrorBoundary>
  </StrictMode>,
)