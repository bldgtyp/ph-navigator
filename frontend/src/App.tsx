import './styles/App.css';
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';

import { UserProvider } from "./contexts/UserContext";
import ProtectedRoute from "./pages/ProtectedRoute";
import Landing from "./pages/Landing";
import Login from "./pages/Login";
import Projects from "./pages/Projects";
import TopAppBar from './components/layout/AppBar';
import Project from "./pages/Project";
import Account from "./pages/Account";
import ProjectData from "./pages/ProjectData";

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
