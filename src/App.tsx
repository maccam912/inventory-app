import { ThemeProvider, createTheme } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import MainLayout from './components/MainLayout';

const theme = createTheme({
  palette: {
    mode: 'dark',
    primary: {
      main: '#6366f1', // Indigo
      light: '#818cf8',
      dark: '#4f46e5',
    },
    secondary: {
      main: '#8b5cf6', // Purple
      light: '#a78bfa',
      dark: '#7c3aed',
    },
    background: {
      default: '#0f0f23', // Deep dark blue
      paper: '#1a1a2e', // Slightly lighter dark blue
    },
    surface: {
      main: '#16213e', // Navy blue surface
    },
    text: {
      primary: '#e2e8f0', // Light blue-gray
      secondary: '#94a3b8', // Medium blue-gray
    },
    error: {
      main: '#ef4444',
      light: '#f87171',
      dark: '#dc2626',
    },
    warning: {
      main: '#f59e0b',
      light: '#fbbf24',
      dark: '#d97706',
    },
    info: {
      main: '#3b82f6',
      light: '#60a5fa',
      dark: '#2563eb',
    },
    success: {
      main: '#10b981',
      light: '#34d399',
      dark: '#059669',
    },
    divider: '#334155',
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        body: {
          backgroundColor: '#0f0f23',
          backgroundImage: 'linear-gradient(135deg, #0f0f23 0%, #1a1a2e 100%)',
        },
      },
    },
    MuiAppBar: {
      styleOverrides: {
        root: {
          backgroundColor: '#16213e',
          borderBottom: '1px solid #334155',
        },
      },
    },
    MuiDrawer: {
      styleOverrides: {
        paper: {
          backgroundColor: '#1a1a2e',
          borderRight: '1px solid #334155',
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundColor: '#1a1a2e',
          border: '1px solid #334155',
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          backgroundColor: '#16213e',
          border: '1px solid #334155',
          boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.3), 0 2px 4px -1px rgba(0, 0, 0, 0.2)',
        },
      },
    },
    MuiTableContainer: {
      styleOverrides: {
        root: {
          backgroundColor: '#16213e',
        },
      },
    },
    MuiTableHead: {
      styleOverrides: {
        root: {
          backgroundColor: '#1e293b',
        },
      },
    },
    MuiTableRow: {
      styleOverrides: {
        root: {
          '&:nth-of-type(even)': {
            backgroundColor: '#1e293b',
          },
          '&:hover': {
            backgroundColor: '#334155',
          },
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: 'none',
          borderRadius: 8,
        },
        contained: {
          boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.3)',
          '&:hover': {
            boxShadow: '0 6px 8px -1px rgba(0, 0, 0, 0.4)',
          },
        },
      },
    },
    MuiTextField: {
      styleOverrides: {
        root: {
          '& .MuiOutlinedInput-root': {
            backgroundColor: '#0f172a',
            '& fieldset': {
              borderColor: '#475569',
            },
            '&:hover fieldset': {
              borderColor: '#6366f1',
            },
            '&.Mui-focused fieldset': {
              borderColor: '#6366f1',
            },
          },
        },
      },
    },
    MuiSelect: {
      styleOverrides: {
        select: {
          backgroundColor: '#0f172a',
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          backgroundColor: '#334155',
          color: '#e2e8f0',
        },
        colorPrimary: {
          backgroundColor: '#6366f1',
          color: '#ffffff',
        },
        colorSecondary: {
          backgroundColor: '#8b5cf6',
          color: '#ffffff',
        },
      },
    },
  },
  typography: {
    fontFamily: '"Inter", "Roboto", "Helvetica", "Arial", sans-serif',
    h1: {
      color: '#e2e8f0',
      fontWeight: 600,
    },
    h2: {
      color: '#e2e8f0',
      fontWeight: 600,
    },
    h3: {
      color: '#e2e8f0',
      fontWeight: 600,
    },
    h4: {
      color: '#e2e8f0',
      fontWeight: 500,
    },
    h5: {
      color: '#e2e8f0',
      fontWeight: 500,
    },
    h6: {
      color: '#e2e8f0',
      fontWeight: 500,
    },
  },
});

function App() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <MainLayout />
    </ThemeProvider>
  );
}

export default App;
