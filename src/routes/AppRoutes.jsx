import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
} from 'react-router-dom'

import Login from '../pages/Login'
import Cadastro from '../pages/Cadastro'
import Dashboard from '../pages/Dashboard'

import Treinos from '../pages/Treinos'
import TreinosEditar from '../pages/TreinosEditar'
import TreinosVisualizar from '../pages/TreinosVisualizar'
import Treinar from '../pages/Treinar'

import RedefinirSenha from '../pages/RedefinirSenha'

import { PrivateRoute } from './PrivateRoute'

export default function AppRoutes() {
  return (
    <BrowserRouter>
      <Routes>

        {/* Redirect inicial */}
        <Route
          path="/"
          element={<Navigate to="/login" />}
        />

        {/* Rotas públicas */}
        <Route
          path="/login"
          element={<Login />}
        />

        <Route
          path="/cadastro"
          element={<Cadastro />}
        />

        <Route
          path="/redefinir-senha"
          element={<RedefinirSenha />}
        />

        {/* Dashboard */}
        <Route
          path="/dashboard"
          element={
            <PrivateRoute>
              <Dashboard />
            </PrivateRoute>
          }
        />

        {/* Página principal de treinos */}
        <Route
          path="/treinos"
          element={
            <PrivateRoute>
              <Treinos />
            </PrivateRoute>
          }
        />

        {/* Visualizar treino */}
        <Route
          path="/treinos/visualizar/:id"
          element={
            <PrivateRoute>
              <TreinosVisualizar />
            </PrivateRoute>
          }
        />

        {/* Criar treino */}
        <Route
          path="/treinos/editar"
          element={
            <PrivateRoute>
              <TreinosEditar />
            </PrivateRoute>
          }
        />

        {/* Editar treino existente */}
        <Route
          path="/treinos/editar/:id"
          element={
            <PrivateRoute>
              <TreinosEditar />
            </PrivateRoute>
          }
        />

        {/* Tela de treino ativo */}
        <Route
          path="/treinar"
          element={
            <PrivateRoute>
              <Treinar />
            </PrivateRoute>
          }
        />

      </Routes>
    </BrowserRouter>
  )
}