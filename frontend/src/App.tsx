import { Navigate, Route, Routes } from 'react-router-dom'
import { AppShell } from './components/ui'
import { AnomaliesPage } from './pages/AnomaliesPage'
import { ConsolidationPage } from './pages/ConsolidationPage'
import { CountriesPage } from './pages/CountriesPage'
import { CountryFilesPage } from './pages/CountryFilesPage'
import { MappingPage } from './pages/MappingPage'
import { TemplatesPage } from './pages/TemplatesPage'

export default function App() {
  return (
    <AppShell>
      <Routes>
        <Route path="/" element={<Navigate to="/templates" replace />} />
        <Route path="/templates" element={<TemplatesPage />} />
        <Route path="/templates/:id/mapping" element={<MappingPage />} />
        <Route path="/countries" element={<CountriesPage />} />
        <Route path="/countries/:id/files" element={<CountryFilesPage />} />
        <Route path="/countries/:id/anomalies" element={<AnomaliesPage />} />
        <Route path="/consolidation" element={<ConsolidationPage />} />
        <Route path="*" element={<Navigate to="/templates" replace />} />
      </Routes>
    </AppShell>
  )
}
