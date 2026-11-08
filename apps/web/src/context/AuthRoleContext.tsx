'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';

export type UserRole = 'admin' | 'viewer';

interface AuthRoleContextType {
  role: UserRole;
  setRole: (role: UserRole) => void;
  isAdmin: boolean;
}

const AuthRoleContext = createContext<AuthRoleContextType>({
  role: 'admin',
  setRole: () => {},
  isAdmin: true,
});

export function AuthRoleProvider({ children }: { children: React.ReactNode }) {
  const [role, setRoleState] = useState<UserRole>('admin');

  useEffect(() => {
    try {
      const stored = localStorage.getItem('coldaisle_user_role');
      if (stored === 'viewer' || stored === 'admin') {
        setRoleState(stored);
      }
    } catch {
      // localStorage may fail in SSR or restricted iframe
    }
  }, []);

  const setRole = (newRole: UserRole) => {
    setRoleState(newRole);
    try {
      localStorage.setItem('coldaisle_user_role', newRole);
    } catch {
      // no-op
    }
  };

  return (
    <AuthRoleContext.Provider value={{ role, setRole, isAdmin: role === 'admin' }}>
      {children}
    </AuthRoleContext.Provider>
  );
}

export function useAuthRole() {
  return useContext(AuthRoleContext);
}
