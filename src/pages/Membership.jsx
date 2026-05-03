import { Navigate } from 'react-router-dom';

/**
 * Membership is now determined by token ownership, not a separate Stripe payment.
 * Buying a share IS membership. This route redirects to Trade.
 */
const Membership = () => <Navigate to="/trade" replace />;

export default Membership;

