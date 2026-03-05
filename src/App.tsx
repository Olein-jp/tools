import { useEffect } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { HomePage } from './pages/HomePage';
import { FluidTypographyPage } from './pages/FluidTypographyPage';
import { IntegrityPlusConverterPage } from './pages/IntegrityPlusConverterPage';

export function App() {
  useEffect(() => {
    document.documentElement.classList.add('dark');
  }, []);

  return (
    <div className="relative min-h-screen bg-paper text-ink">
      <div className="pointer-events-none fixed inset-0 z-0 opacity-70 transition-opacity duration-500 dark:opacity-100">
        <div className="absolute left-[-8rem] top-[6rem] h-[22rem] w-[22rem] rounded-full bg-cyan-300/30 blur-3xl dark:bg-sky-400/20" />
        <div className="absolute bottom-[-10rem] right-[-6rem] h-[24rem] w-[24rem] rounded-full bg-amber-300/30 blur-3xl dark:bg-blue-500/20" />
      </div>
      <div className="relative z-10">
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/fluid-typography" element={<FluidTypographyPage />} />
          <Route path="/integrity-plus-converter" element={<IntegrityPlusConverterPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>
    </div>
  );
}
