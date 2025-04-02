import { createContext, useState, useEffect, useCallback, ReactNode } from "react";
import constants from "../data/constants.json";
import { UserType, UserContextType } from "../types/database/User";

export const defaultUserContext: UserContextType = {
  user: null,
  login: () => { },
  logout: () => { },
};

export const UserContext = createContext<UserContextType>(defaultUserContext);

export const UserProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<UserType | null>(null);

  const fetchUserInfo = useCallback(async (token: string) => {
    const API_BASE_URL = process.env.REACT_APP_API_URL || constants.RENDER_API_BASE_URL;
    try {
      console.log("UserContext | useEffect | Fetching user info with Access Token:", token.substring(0, 10) + "...");
      const response = await fetch(`${API_BASE_URL}auth/user`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
        const data = await response.json();
        console.log("UserContext | useEffect | Fetched user data:", data);
        setUser(data);
      } else {
        console.error("UserContext | useEffect | Failed to fetch user info:", response.statusText);
        logout(); // Clear token if fetching user info fails
      }
    } catch (error) {
      console.error("UserContext | useEffect | Error fetching user:", error);
      logout(); // Clear token if an error occurs
    }
  }, []);

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (token) {
      fetchUserInfo(token); // Fetch user info from backend
    }
  }, [fetchUserInfo]);

  const login = (access_token: string) => {
    console.log("UserContext | login | setting Access Token:", access_token.substring(0, 10) + "...");
    localStorage.setItem("token", access_token);
    fetchUserInfo(access_token);
  };

  const logout = () => {
    console.log("UserContext | logout | Removing Access Token.");
    localStorage.removeItem("token");
    setUser(null);
  };

  return (
    <UserContext.Provider value={{ user, login, logout }}>
      {children}
    </UserContext.Provider>
  );
};