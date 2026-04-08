import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { DashboardLayout } from './components/layout/DashboardLayout'
import { InsumosInformesPage } from './pages/InsumosInformesPage'
import { InsumosPage } from './pages/InsumosPage'
import { LoginPage } from './pages/LoginPage'
import { PrestamosPage } from './pages/PrestamosPage'
import { RegistroPage } from './pages/RegistroPage'
import { UsosPage } from './pages/UsosPage'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/registro" element={<RegistroPage />} />
        <Route element={<DashboardLayout />}>
          <Route index element={<Navigate to="/insumos" replace />} />
          <Route path="insumos" element={<InsumosPage />} />
          <Route path="insumos/informes" element={<InsumosInformesPage />} />
          <Route path="usos" element={<UsosPage />} />
          <Route path="prestamos" element={<PrestamosPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
