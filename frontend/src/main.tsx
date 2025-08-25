import React from 'react';
import ReactDOM from 'react-dom/client';
import { ThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import App from './App';
import { cyberpunkTheme } from './theme/cyberpunkTheme';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ThemeProvider theme={cyberpunkTheme}>
      <CssBaseline />
      <App />
    </ThemeProvider>
  </React.StrictMode>
);