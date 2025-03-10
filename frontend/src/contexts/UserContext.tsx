import { createContext, useState, useEffect, ReactNode } from "react";
import constants from "../data/constants.json";

export interface User {
  email: string;
  id: number;
  username: string;
}

export interface UserContextType {
  user: User | null;
  login: (token: string) => void;
  logout: () => void;
}

export const UserContext = createContext<UserContextType | null>(null);

export const UserProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState(null);

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (token) {
      // Fetch user info from backend
      fetchUserInfo(token);
    }
  }, []);

  const fetchUserInfo = async (token: string) => {
    const API_BASE_URL = process.env.REACT_APP_API_URL || constants.RENDER_API_BASE_URL;

    try {
      const response = await fetch(`${API_BASE_URL}users/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();
      setUser(data);
    } catch (error) {
      console.error("Error fetching user:", error);
    }
  };

  const login = (access_token: string) => {
    localStorage.setItem("token", access_token);
    fetchUserInfo(access_token);
  };

  const logout = () => {
    localStorage.removeItem("token");
    setUser(null);
  };

  return (
    <UserContext.Provider value={{ user, login, logout }}>
      {children}
    </UserContext.Provider>
  );
};