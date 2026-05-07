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

function App() {
  return (
    <BrowserRouter>
      <div className="app-layout">
        <Navigation />
        <main className="app-content">
          <Routes>
            <Route path="/" element={<MapView />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/admin" element={<AdminPanel />} />
            <Route path="/reports" element={<Reports />} />
            <Route path="/traccar" element={<TraccarSettings />} />
            <Route path="/geofences" element={<GeofenceManager />} />
            <Route path="/drivers" element={<DriverManager />} />
            <Route path="/maintenance" element={<MaintenanceTracker />} />
            <Route path="/fuel" element={<FuelLog />} />
            <Route path="/alerts" element={<AlertsCenter />} />
            <Route path="/expenses" element={<ExpenseTracker />} />
            <Route path="/vehicles/:id" element={<VehicleProfile />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}

export default App;
