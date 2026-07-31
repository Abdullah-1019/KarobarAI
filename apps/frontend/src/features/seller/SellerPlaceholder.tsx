import { EmptyState } from '../../components';

// Fallback for /seller/* paths not yet built (orders, analytics, etc.) — Store setup (Feature 3)
// and Product Management (Feature 4) now have real screens; this only catches what's left.
export function SellerPlaceholder() {
  return <EmptyState title="Coming soon" description="This part of the Seller Console isn't built yet." />;
}
