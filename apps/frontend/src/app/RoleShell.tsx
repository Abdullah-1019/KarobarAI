import { AdminLayout } from '../features/admin';
import { StorefrontLayout } from '../features/marketplace';
import { SellerLayout } from '../features/seller';
import { useAuthStore } from '../lib/authStore';

// Pages every signed-in role can open (today: /notifications) render inside that role's own
// chrome, so the page keeps its header, nav and footer instead of standing bare. Each layout
// renders the matched child route through its own <Outlet />.
export function RoleShell() {
  const role = useAuthStore((s) => s.user?.role);
  if (role === 'SELLER') return <SellerLayout />;
  if (role === 'ADMIN' || role === 'SUPPORT') return <AdminLayout />;
  return <StorefrontLayout />;
}
