'use client';

import React, { useState } from 'react';
import AdminLoginPage from './login/page';
import AdminVendorsPage from './vendors/page';

/**
 * Super Admin Protected Route (/admin)
 * - Accessible only by direct manual URL navigation
 * - Strictly protected with Super Admin credential verification (RBAC: super_admin)
 */
export default function AdminRootPage() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  if (!isAuthenticated) {
    return (
      <AdminLoginPage 
        onSuccess={() => setIsAuthenticated(true)} 
      />
    );
  }

  return <AdminVendorsPage />;
}
