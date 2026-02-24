import { Navigate, Route, Routes } from 'react-router-dom';
import { HomePage } from './pages/HomePage';
import { FluidTypographyPage } from './pages/FluidTypographyPage';

export function App() {
  return (
    <div className="min-h-screen bg-paper text-ink">
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/fluid-typography" element={<FluidTypographyPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </div>
  );
}
