import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { format, subDays, startOfDay, endOfDay } from "date-fns";
import { getAllDevicesWithTraccar } from "../services/deviceService";
import { getTraccarSummary, isTraccarConfigured } from "../services/traccarService";
import { knotsToKmh, metersToKm } from "../types/event";
import type { FleetStatistics } from "../types/trip";
import type { Device } from "../types/device";
import AlertsFeed from "./AlertsFeed";
import StatCard from "./StatCard";
import { getOverdueRecords } from "../services/maintenanceService";
import { getAllDrivers } from "../services/driverService";
import { getAllFuelEntries } from "../services/fuelService";

const COLORS = ["#22c55e", "#ef4444", "#6b7280"];

const Dashboard = () => {
  const navigate = useNavigate();
  const [stats, setStats] = useState<FleetStatistics | null>(null);
  const [devices, setDevices] = useState<Device[]>([]);
  const [weeklyData, setWeeklyData] = useState<{ date: string; distance: number }[]>([]);
  const [statusData, setStatusData] = useState<{ name: string; value: number }[]>([]);
  const [loading, setLoading] = useState(true);
  const [overdueCount, setOverdueCount] = useState(0);
  const [expiringLicenses, setExpiringLicenses] = useState(0);
  const [activeDrivers, setActiveDrivers] = useState(0);
  const [fuelThisMonth, setFuelThisMonth] = useState(0);

  useEffect(() => {
    loadDashboard();
    const interval = setInterval(loadDashboard, 30000);
    return () => clearInterval(interval);
  }, []);

  const loadDashboard = async () => {
    // Fleet health (localStorage)
    setOverdueCount(getOverdueRecords().length);
    const drivers = getAllDrivers();
    setActiveDrivers(drivers.filter((d) => d.assignedDeviceId).length);
    setExpiringLicenses(
      drivers.filter((d) => {
        const days = Math.ceil((new Date(d.licenseExpiry).getTime() - Date.now()) / 86400000);
        return days >= 0 && days <= 30;
      }).length
    );
    const thisMonth = new Date().toISOString().slice(0, 7);
    setFuelThisMonth(
      getAllFuelEntries()
        .filter((e) => e.date.startsWith(thisMonth))
        .reduce((s, e) => s + e.liters * e.costPerLiter, 0)
    );

    const liveDevices = await getAllDevicesWithTraccar();
    setDevices(liveDevices);

    const online = liveDevices.filter((d) => d.status === "online").length;
    const offline = liveDevices.filter((d) => d.status === "offline").length;
    const unknown = liveDevices.filter((d) => d.status === "unknown").length;

    setStatusData([
      { name: "Online", value: online },
      { name: "Offline", value: offline },
      { name: "Unknown", value: unknown },
    ]);

    if (isTraccarConfigured()) {
      try {
        // Today's summary
        const todayFrom = startOfDay(new Date());
        const todayTo = new Date();
        const todaySummaries = await getTraccarSummary(todayFrom, todayTo);

        const totalDistKm = todaySummaries.reduce((s, r) => s + metersToKm(r.distance), 0);
        const maxSpeedKmh = Math.max(0, ...todaySummaries.map((r) => knotsToKmh(r.maxSpeed)));
        const avgSpeedKmh =
          todaySummaries.length > 0
            ? todaySummaries.reduce((s, r) => s + knotsToKmh(r.averageSpeed), 0) /
              todaySummaries.length
            : 0;

        setStats({
          totalDevices: liveDevices.length,
          onlineDevices: online,
          offlineDevices: offline,
          totalTrips: 0,
          activeTrips: online,
          totalDistance: totalDistKm,
          avgSpeed: avgSpeedKmh,
          maxSpeed: maxSpeedKmh,
        });

        // Weekly chart — one summary call per day
        const days = Array.from({ length: 7 }, (_, i) => {
          const d = subDays(new Date(), 6 - i);
          return { from: startOfDay(d), to: endOfDay(d), label: format(d, "MMM d") };
        });

        const dailySummaries = await Promise.all(
          days.map(({ from, to }) => getTraccarSummary(from, to))
        );

        setWeeklyData(
          days.map(({ label }, i) => ({
            date: label,
            distance: Number(
              dailySummaries[i].reduce((s, r) => s + metersToKm(r.distance), 0).toFixed(1)
            ),
          }))
        );
      } catch (e) {
        console.error("Dashboard data error:", e);
        setStats({
          totalDevices: liveDevices.length,
          onlineDevices: online,
          offlineDevices: offline,
          totalTrips: 0,
          activeTrips: 0,
          totalDistance: 0,
          avgSpeed: 0,
          maxSpeed: 0,
        });
      }
    } else {
      setStats({
        totalDevices: liveDevices.length,
        onlineDevices: online,
        offlineDevices: offline,
        totalTrips: 0,
        activeTrips: 0,
        totalDistance: 0,
        avgSpeed: 0,
        maxSpeed: 0,
      });
    }

    setLoading(false);
  };

  if (loading) {
    return (
      <div className="d-flex align-items-center justify-content-center" style={{ height: "60vh" }}>
        <div className="text-center text-muted">
          <div className="spinner-border mb-3" />
          <p>Loading dashboard…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container-fluid p-4">
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h1 className="mb-0">Fleet Dashboard</h1>
        {isTraccarConfigured() ? (
          <span className="badge bg-success fs-6">● Traccar Live</span>
        ) : (
          <span className="badge bg-secondary fs-6">Traccar not connected</span>
        )}
      </div>

      {/* KPI cards */}
      <div className="row g-3 mb-4">
        {(
          [
            { label: "Total Devices", value: devices.length, color: "var(--c-accent)" },
            { label: "Online", value: devices.filter((d) => d.status === "online").length, color: "var(--c-success)" },
            { label: "Offline", value: devices.filter((d) => d.status === "offline").length, color: "var(--c-danger)" },
            { label: "Today's Distance", value: stats ? stats.totalDistance.toFixed(1) : "0.0", unit: "km" },
            { label: "Max Speed Today", value: stats ? stats.maxSpeed.toFixed(0) : "0", unit: "km/h" },
            { label: "Avg Speed Today", value: stats ? stats.avgSpeed.toFixed(0) : "0", unit: "km/h" },
          ] as { label: string; value: string | number; color?: string; unit?: string }[]
        ).map((c) => (
          <div key={c.label} className="col-6 col-md-2">
            <StatCard label={c.label} value={c.value} color={c.color} unit={c.unit} />
          </div>
        ))}
      </div>

      {/* Fleet Health row */}
      <div className="row g-3 mb-4">
        <div className="col-12">
          <h6 className="text-muted text-uppercase fw-semibold mb-0">Fleet Health</h6>
        </div>
        {(
          [
            { label: "Overdue Maintenance", value: overdueCount, color: overdueCount > 0 ? "var(--c-danger)" : "var(--c-success)", route: "/maintenance" },
            { label: "Licenses Expiring (30d)", value: expiringLicenses, color: expiringLicenses > 0 ? "var(--c-warning)" : "var(--c-success)", route: "/alerts" },
            { label: "Active Drivers", value: activeDrivers, color: "var(--c-accent)", route: "/drivers" },
            { label: "Fuel Cost This Month", value: `Rs. ${fuelThisMonth.toFixed(2)}`, route: "/expenses" },
          ] as { label: string; value: string | number; color?: string; route: string }[]
        ).map((c) => (
          <div key={c.label} className="col-6 col-md-3" style={{ cursor: "pointer" }} onClick={() => navigate(c.route)}>
            <StatCard label={c.label} value={c.value} color={c.color} />
          </div>
        ))}
      </div>

      {/* Charts row */}
      <div className="row g-3 mb-4">
        <div className="col-md-8">
          <div className="card h-100">
            <div className="card-header">
              <strong>Distance Traveled — Last 7 Days (km)</strong>
            </div>
            <div className="card-body">
              {weeklyData.length > 0 ? (
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={weeklyData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis />
                    <Tooltip formatter={(v) => [`${v} km`, "Distance"]} />
                    <Bar dataKey="distance" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="d-flex align-items-center justify-content-center h-100 text-muted">
                  Connect Traccar to see distance data
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="col-md-4">
          <div className="card h-100">
            <div className="card-header">
              <strong>Device Status</strong>
            </div>
            <div className="card-body">
              <ResponsiveContainer width="100%" height={260}>
                <PieChart>
                  <Pie
                    data={statusData.filter((d) => d.value > 0)}
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    dataKey="value"
                    label={({ name, percent }) =>
                      `${name} ${(percent * 100).toFixed(0)}%`
                    }
                  >
                    {statusData.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </div>

      {/* Device table + Events feed */}
      <div className="row g-3">
        <div className="col-md-7">
          <div className="card">
            <div className="card-header">
              <strong>Device Status Overview</strong>
            </div>
            <div className="card-body p-0">
              <div className="table-responsive">
                <table className="table table-hover mb-0">
                  <thead className="table-light">
                    <tr>
                      <th>Name</th>
                      <th>Status</th>
                      <th>Speed</th>
                      <th>Battery</th>
                      <th>Last Update</th>
                    </tr>
                  </thead>
                  <tbody>
                    {devices.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="text-center text-muted py-3">
                          No devices found
                        </td>
                      </tr>
                    ) : (
                      devices.map((d) => (
                        <tr
                          key={d.id}
                          style={{ cursor: "pointer" }}
                          onClick={() => navigate(`/vehicles/${d.id}`)}
                        >
                          <td className="fw-semibold">{d.name}</td>
                          <td>
                            <span
                              className={`badge bg-${
                                d.status === "online"
                                  ? "success"
                                  : d.status === "offline"
                                  ? "danger"
                                  : "secondary"
                              }`}
                            >
                              {d.status.toUpperCase()}
                            </span>
                          </td>
                          <td>{d.speed !== undefined ? `${d.speed.toFixed(0)} km/h` : "—"}</td>
                          <td>{d.battery !== undefined ? `${d.battery}%` : "—"}</td>
                          <td>
                            <small>
                              {d.lastUpdate ? format(new Date(d.lastUpdate), "MMM d, HH:mm:ss") : "Never"}
                            </small>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>

        <div className="col-md-5">
          <AlertsFeed maxItems={30} refreshInterval={60000} />
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
