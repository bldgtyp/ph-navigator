import './styles/App.css';
import './styles/Colors.css';
import { Component, ReactNode, ErrorInfo } from 'react'
import { BrowserRouter as Router } from 'react-router-dom';
import { ThemeProvider } from "@mui/material/styles";
import { UserProvider } from "./features/auth/contexts/UserContext";
import TopAppBar from './features/auth/components/AppBar';
import AppRoutes from './Routes';
import theme from "./styles/theme";

class ErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean }> {
  state = { hasError: false };

  static getDerivedStateFromError(): { hasError: boolean } {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error("ErrorBoundary caught an error", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return <h1>Something went wrong.</h1>;
    }
    return this.props.children;
  }
}

const App: React.FC = () => {
  return (
    <ErrorBoundary>
      <ThemeProvider theme={theme}>
        <UserProvider>
          <Router>
            <TopAppBar />
            <AppRoutes />
          </Router>
        </UserProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;