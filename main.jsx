import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import StakeholderComposer from './StakeholderComposer'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <StakeholderComposer />
  </StrictMode>,
)
