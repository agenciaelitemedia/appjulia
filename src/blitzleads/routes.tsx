import { Route } from "react-router-dom";
import BlitzLayout from "./components/BlitzLayout";
import BlitzAuthPage from "./pages/BlitzAuthPage";
import CallCenterPage from "./pages/CallCenterPage";
import CaseDetailPage from "./pages/CaseDetailPage";

/**
 * BlitzLeads route tree. Mounted from src/App.tsx.
 */
export const blitzRoutes = (
  <>
    <Route index element={<CallCenterPage />} />
    <Route path="blitz_auth" element={<BlitzAuthPage />} />
    <Route path="dashboard" element={<CallCenterPage />} />
    <Route path="call-center" element={<CallCenterPage />} />
    <Route path="case/:id" element={<CaseDetailPage />} />
  </>
);

export { BlitzLayout };