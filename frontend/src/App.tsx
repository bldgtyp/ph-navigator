import './styles/App.css';
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';

import { UserProvider } from "./features/auth/contexts/UserContext";
import TopAppBar from './components/layout/AppBar';
import Landing from "./Landing";
import Login from "./features/auth/components/Login";
import Projects from "./features/project_browser/components/Projects";
import ProtectedRoute from "./features/auth/components/ProtectedRoute";
import Project from "./features/project/components/Project";
import Account from "./features/auth/components/Account";

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
