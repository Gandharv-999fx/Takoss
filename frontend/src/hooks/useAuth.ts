import { useNavigate } from 'react-router-dom';
import { useStore } from '../lib/store';
import { apiClient } from '../lib/api';

/**
 * useAuth Hook - Authentication utilities
 */
export function useAuth() {
  const navigate = useNavigate();
  const { user, isAuthenticated, setUser, logout: storeLogout } = useStore();

  const login = async (email: string, password: string) => {
    try {
      const result = await apiClient.login(email, password);
      setUser(result.user);
      return { success: true, user: result.user };
    } catch (error: any) {
      return {
        success: false,
        error: error.response?.data?.error || 'Login failed',
      };
    }
  };

  const register = async (email: string, password: string, name?: string) => {
    try {
      const result = await apiClient.register(email, password, name);
      setUser(result.user);
      return { success: true, user: result.user };
    } catch (error: any) {
      return {
        success: false,
        error: error.response?.data?.error || 'Registration failed',
      };
    }
  };

  const logout = () => {
    storeLogout();
    navigate('/login');
  };

  const refreshUser = async () => {
    try {
      const user = await apiClient.getCurrentUser();
      setUser(user);
      return user;
    } catch (error) {
      storeLogout();
      navigate('/login');
      return null;
    }
  };

  return {
    user,
    isAuthenticated,
    login,
    register,
    logout,
    refreshUser,
  };
}
