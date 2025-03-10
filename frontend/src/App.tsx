import './styles/App.css';
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';

import { UserProvider } from "./contexts/UserContext";
import ProtectedRoute from "./pages/ProtectedRoute";
import Landing from "./pages/Landing";
import Login from "./pages/Login";
import Projects from "./pages/Projects";

function App() {
  return (
    <UserProvider>
      <Router>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/login" element={<Login />} />
          <Route element={<ProtectedRoute />}>
            <Route path="/projects" element={<Projects />} />
          </Route>
        </Routes>
      </Router>
    </UserProvider>
  );
}

export default App;
