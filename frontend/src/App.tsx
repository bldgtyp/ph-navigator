import './styles/App.css';
import { Component, ReactNode, ErrorInfo } from 'react'
import { BrowserRouter as Router } from 'react-router-dom';

import { UserProvider } from "./features/auth/contexts/UserContext";
import TopAppBar from './features/auth/components/AppBar';
import AppRoutes from './Routes';


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


function App() {
  return (
    <ErrorBoundary>
      <UserProvider>
        <Router>
          <TopAppBar />
          <AppRoutes />
        </Router>
      </UserProvider>
    </ErrorBoundary>
  );
}

export default App;