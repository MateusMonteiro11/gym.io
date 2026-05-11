import {
  BrowserRouter,
  Routes,
  Route,
  Navigate
} from 'react-router-dom'

import Login from '../pages/Login'
import Cadastro from '../pages/Cadastro'

import Dashboard from '../pages/Dashboard'

import Treinos from '../pages/Treinos'
import Treinar from '../pages/Treinar'

import { PrivateRoute } from './PrivateRoute'

import RedefinirSenha from '../pages/RedefinirSenha'

export default function AppRoutes() {

  return (

    <BrowserRouter>

      <Routes>

        {/* inicial */}
        <Route
          path="/"
          element={<Navigate to="/login" />}
        />

        {/* públicas */}
        <Route
          path="/login"
          element={<Login />}
        />

        <Route
          path="/cadastro"
          element={<Cadastro />}
        />

        {/* privadas */}

        <Route
          path="/dashboard"
          element={
            <PrivateRoute>
              <Dashboard />
            </PrivateRoute>
          }
        />

        <Route
          path="/treinos"
          element={
            <PrivateRoute>
              <Treinos />
            </PrivateRoute>
          }
        />

        <Route
          path="/treinar"
          element={
            <PrivateRoute>
              <Treinar />
            </PrivateRoute>
          }
        />

        <Route
          path="/redefinir-senha"
          element={<RedefinirSenha />}
        />

      </Routes>

    </BrowserRouter>
  )
}