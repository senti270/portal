'use client';

import PermissionManagement from '@/components/PermissionManagement';
import PortalAuth from '@/components/PortalAuth';

function PermissionManagementContent() {
  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <PermissionManagement />
      </div>
    </div>
  );
}

export default function PermissionManagementPage() {
  return (
    <PortalAuth>
      <PermissionManagementContent />
    </PortalAuth>
  );
}

