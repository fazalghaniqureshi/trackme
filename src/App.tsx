import "./App.css";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Navigation from "./components/Navigation";
import MapView from "./components/MapView";
import AdminPanel from "./components/AdminPanel";
import Dashboard from "./components/Dashboard";
import Reports from "./components/Reports";
import TraccarSettings from "./components/TraccarSettings";
import GeofenceManager from "./components/GeofenceManager";
import DriverManager from "./components/DriverManager";
import MaintenanceTracker from "./components/MaintenanceTracker";
import FuelLog from "./components/FuelLog";
import AlertsCenter from "./components/AlertsCenter";
import ExpenseTracker from "./components/ExpenseTracker";
import VehicleProfile from "./components/VehicleProfile";
import ErrorBoundary from "./components/ErrorBoundary";
import UserManagement from "./components/UserManagement";
import GroupManagement from "./components/GroupManagement";

function App() {
  return (
    <BrowserRouter>
      <div className="app-layout">
        <Navigation />
        <main className="app-content">
          <Routes>
            <Route path="/" element={<ErrorBoundary><MapView /></ErrorBoundary>} />
            <Route path="/dashboard" element={<ErrorBoundary><Dashboard /></ErrorBoundary>} />
            <Route path="/admin" element={<ErrorBoundary><AdminPanel /></ErrorBoundary>} />
            <Route path="/reports" element={<ErrorBoundary><Reports /></ErrorBoundary>} />
            <Route path="/traccar" element={<ErrorBoundary><TraccarSettings /></ErrorBoundary>} />
            <Route path="/geofences" element={<ErrorBoundary><GeofenceManager /></ErrorBoundary>} />
            <Route path="/drivers" element={<ErrorBoundary><DriverManager /></ErrorBoundary>} />
            <Route path="/maintenance" element={<ErrorBoundary><MaintenanceTracker /></ErrorBoundary>} />
            <Route path="/fuel" element={<ErrorBoundary><FuelLog /></ErrorBoundary>} />
            <Route path="/alerts" element={<ErrorBoundary><AlertsCenter /></ErrorBoundary>} />
            <Route path="/expenses" element={<ErrorBoundary><ExpenseTracker /></ErrorBoundary>} />
            <Route path="/vehicles/:id" element={<ErrorBoundary><VehicleProfile /></ErrorBoundary>} />
            <Route path="/users" element={<ErrorBoundary><UserManagement /></ErrorBoundary>} />
            <Route path="/groups" element={<ErrorBoundary><GroupManagement /></ErrorBoundary>} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}

export default App;
