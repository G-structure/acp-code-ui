import { createTheme } from '@mui/material/styles';

export const cyberpunkTheme = createTheme({
  palette: {
    mode: 'dark',
    primary: {
      main: '#00ffff', // Cyan
      light: '#66ffff',
      dark: '#00b3b3',
    },
    secondary: {
      main: '#ff00ff', // Magenta
      light: '#ff66ff',
      dark: '#b300b3',
    },
    error: {
      main: '#ff0066', // Hot pink
    },
    warning: {
      main: '#ffaa00', // Amber
    },
    success: {
      main: '#00ff88', // Neon green
    },
    info: {
      main: '#00aaff', // Electric blue
    },
    background: {
      default: '#000000', // Pure black
      paper: '#0a0a0a', // Near black
    },
    text: {
      primary: '#e0e0e0',
      secondary: '#a0a0a0',
    },
    divider: 'rgba(0, 255, 255, 0.12)', // Cyan divider
  },
  typography: {
    fontFamily: '"Fira Code", "JetBrains Mono", "Consolas", monospace',
    h6: {
      fontWeight: 600,
      letterSpacing: '0.05em',
    },
    button: {
      textTransform: 'none',
      fontWeight: 500,
    },
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        body: {
          scrollbarColor: '#00ffff #0a0a0a',
          '&::-webkit-scrollbar, & *::-webkit-scrollbar': {
            width: '12px',
            height: '12px',
          },
          '&::-webkit-scrollbar-track, & *::-webkit-scrollbar-track': {
            background: '#0a0a0a',
            borderRadius: '4px',
          },
          '&::-webkit-scrollbar-thumb, & *::-webkit-scrollbar-thumb': {
            background: 'rgba(0, 255, 255, 0.3)',
            borderRadius: '4px',
            border: '2px solid #0a0a0a',
            '&:hover': {
              background: 'rgba(0, 255, 255, 0.5)',
            },
            '&:active': {
              background: '#00ffff',
            },
          },
          '&::-webkit-scrollbar-corner, & *::-webkit-scrollbar-corner': {
            background: '#0a0a0a',
          },
        },
      },
    },
    MuiAppBar: {
      styleOverrides: {
        root: {
          backgroundColor: '#000000',
          borderBottom: '1px solid rgba(0, 255, 255, 0.2)',
          backgroundImage: 'linear-gradient(90deg, #000000 0%, #0a0a0a 50%, #000000 100%)',
        },
      },
    },
    MuiDrawer: {
      styleOverrides: {
        paper: {
          backgroundColor: '#050505',
          borderRight: '1px solid rgba(0, 255, 255, 0.15)',
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: 2,
          '&:hover': {
            backgroundColor: 'rgba(0, 255, 255, 0.08)',
          },
        },
        outlined: {
          borderColor: 'rgba(0, 255, 255, 0.3)',
          '&:hover': {
            borderColor: '#00ffff',
            backgroundColor: 'rgba(0, 255, 255, 0.05)',
          },
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          borderRadius: 4,
          fontWeight: 500,
        },
        outlined: {
          borderColor: 'rgba(0, 255, 255, 0.3)',
        },
      },
    },
    MuiTab: {
      styleOverrides: {
        root: {
          '&.Mui-selected': {
            color: '#00ffff',
            backgroundColor: 'rgba(0, 255, 255, 0.05)',
          },
          '&:hover': {
            backgroundColor: 'rgba(0, 255, 255, 0.03)',
          },
        },
      },
    },
    MuiTextField: {
      styleOverrides: {
        root: {
          '& .MuiOutlinedInput-root': {
            '& fieldset': {
              borderColor: 'rgba(0, 255, 255, 0.2)',
            },
            '&:hover fieldset': {
              borderColor: 'rgba(0, 255, 255, 0.4)',
            },
            '&.Mui-focused fieldset': {
              borderColor: '#00ffff',
            },
          },
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
          backgroundColor: '#0a0a0a',
          border: '1px solid rgba(0, 255, 255, 0.1)',
        },
      },
    },
    MuiListItem: {
      styleOverrides: {
        root: {
          '&:hover': {
            backgroundColor: 'rgba(0, 255, 255, 0.05)',
          },
        },
      },
    },
  },
});