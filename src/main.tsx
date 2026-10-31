import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { PenaltyProvider } from './penalty.tsx'
import { PhotoProvider } from './photos.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <PhotoProvider>
      <PenaltyProvider>
        <App />
      </PenaltyProvider>
    </PhotoProvider>
  </StrictMode>,
)
