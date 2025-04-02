import './styles/App.css';
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';

import { UserProvider } from "./contexts/UserContext";
import TopAppBar from './components/layout/AppBar';
import Landing from "./pages/Landing";
import Login from "./pages/auth/Login";
import Projects from "./pages/Projects";
import ProtectedRoute from "./pages/auth/ProtectedRoute";
import Project from "./pages/project/Project";
import Account from "./pages/auth/Account";

function App() {
  return (
    <UserProvider>
      <Router>
        <TopAppBar />
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/login" element={<Login />} />
          <Route element={<ProtectedRoute />}>
            <Route path="/projects" element={<Projects />} />
          </Route>
          <Route element={<ProtectedRoute />}>
            <Route path="/account" element={<Account />} />
          </Route>
          <Route path="/project/:projectId" element={<Project />} />
        </Routes>
      </Router>
    </UserProvider>
  );
}

export default App;
