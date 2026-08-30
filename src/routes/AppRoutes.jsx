import {
  createBrowserRouter,
  Outlet,
  RouterProvider,
} from 'react-router-dom'
import { lazy, Suspense } from 'react'

import Login from '../pages/Login'
import Cadastro from '../pages/Cadastro'
import LandingPage from '../pages/LandingPage'
import RedefinirSenha from '../pages/RedefinirSenha'
import RouteError, { NotFoundPage } from '../pages/RouteError'
import { PrivateRoute } from './PrivateRoute'
import PageLoadingBoundary from '../components/ui/PageLoadingBoundary'

const Dashboard = lazy(() => import('../pages/Dashboard'))
const Treinos = lazy(() => import('../pages/Treinos'))
const TreinosEditar = lazy(() => import('../pages/TreinosEditar'))
const TreinosVisualizar = lazy(() => import('../pages/TreinosVisualizar'))
const Treinar = lazy(() => import('../pages/Treinar'))
const TreinoPlayer = lazy(() => import('../pages/TreinoPlayer'))
const Historico = lazy(() => import('../pages/Historico'))
const LegalPage = lazy(() => import('../pages/LegalPage'))

function ProtectedPage({ children }) {
  return (
    <PrivateRoute>
      <Suspense fallback={<PageLoadingBoundary loading loadingMessage="Carregando página..." />}>
        {children}
      </Suspense>
    </PrivateRoute>
  )
}

function PublicLazyPage({ children }) {
  return (
    <Suspense fallback={<PageLoadingBoundary loading loadingMessage="Carregando documento..." />}>
      {children}
    </Suspense>
  )
}

const router = createBrowserRouter([
  {
    element: <Outlet />,
    errorElement: <RouteError />,
    children: [
      {
        path: '/',
        element: <LandingPage />,
      },
      {
        path: '/login',
        element: <Login />,
      },
      {
        path: '/cadastro',
        element: <Cadastro />,
      },
      {
        path: '/termos',
        element: <PublicLazyPage><LegalPage documentId="terms" /></PublicLazyPage>,
      },
      {
        path: '/privacidade',
        element: <PublicLazyPage><LegalPage documentId="privacy" /></PublicLazyPage>,
      },
      {
        path: '/redefinir-senha',
        element: <RedefinirSenha />,
      },
      {
        path: '/dashboard',
        element: (
          <ProtectedPage>
            <Dashboard />
          </ProtectedPage>
        ),
      },
      {
        path: '/treinos',
        element: (
          <ProtectedPage>
            <Treinos />
          </ProtectedPage>
        ),
      },
      {
        path: '/treinos/visualizar/:id',
        element: (
          <ProtectedPage>
            <TreinosVisualizar />
          </ProtectedPage>
        ),
      },
      {
        path: '/treinos/editar',
        element: (
          <ProtectedPage>
            <TreinosEditar />
          </ProtectedPage>
        ),
      },
      {
        path: '/treinos/editar/:id',
        element: (
          <ProtectedPage>
            <TreinosEditar />
          </ProtectedPage>
        ),
      },
      {
        path: '/treinar',
        element: (
          <ProtectedPage>
            <Treinar />
          </ProtectedPage>
        ),
      },
      {
        path: '/treinar/:id',
        element: (
          <ProtectedPage>
            <TreinoPlayer />
          </ProtectedPage>
        ),
      },
      {
        path: '/historico',
        element: (
          <ProtectedPage>
            <Historico />
          </ProtectedPage>
        ),
      },
      {
        path: '*',
        element: <NotFoundPage />,
      },
    ],
  },
])

export default function AppRoutes() {
  return <RouterProvider router={router} />
}
