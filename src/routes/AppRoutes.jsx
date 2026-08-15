import {
  createBrowserRouter,
  Outlet,
  RouterProvider,
} from 'react-router-dom'

import Login from '../pages/Login'
import Cadastro from '../pages/Cadastro'
import LandingPage from '../pages/LandingPage'
import Dashboard from '../pages/Dashboard'

import Treinos from '../pages/Treinos'
import TreinosEditar from '../pages/TreinosEditar'
import TreinosVisualizar from '../pages/TreinosVisualizar'
import Treinar from '../pages/Treinar'
import TreinoPlayer from '../pages/TreinoPlayer'
import Historico from '../pages/Historico'

import RedefinirSenha from '../pages/RedefinirSenha'
import RouteError, { NotFoundPage } from '../pages/RouteError'

import { PrivateRoute } from './PrivateRoute'

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
        path: '/redefinir-senha',
        element: <RedefinirSenha />,
      },
      {
        path: '/dashboard',
        element: (
          <PrivateRoute>
            <Dashboard />
          </PrivateRoute>
        ),
      },
      {
        path: '/treinos',
        element: (
          <PrivateRoute>
            <Treinos />
          </PrivateRoute>
        ),
      },
      {
        path: '/treinos/visualizar/:id',
        element: (
          <PrivateRoute>
            <TreinosVisualizar />
          </PrivateRoute>
        ),
      },
      {
        path: '/treinos/editar',
        element: (
          <PrivateRoute>
            <TreinosEditar />
          </PrivateRoute>
        ),
      },
      {
        path: '/treinos/editar/:id',
        element: (
          <PrivateRoute>
            <TreinosEditar />
          </PrivateRoute>
        ),
      },
      {
        path: '/treinar',
        element: (
          <PrivateRoute>
            <Treinar />
          </PrivateRoute>
        ),
      },
      {
        path: '/treinar/:id',
        element: (
          <PrivateRoute>
            <TreinoPlayer />
          </PrivateRoute>
        ),
      },
      {
        path: '/historico',
        element: (
          <PrivateRoute>
            <Historico />
          </PrivateRoute>
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
