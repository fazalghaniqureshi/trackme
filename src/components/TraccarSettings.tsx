import { useState, useEffect } from "react";
import {
  initializeTraccar,
  loadTraccarConfig,
  isTraccarConfigured,
  disconnectTraccar,
  syncTraccarDevices,
} from "../services/traccarService";
import type { TraccarConfig } from "../services/traccarService";
const TraccarSettings = () => {
  const configuredServer =
    import.meta.env.VITE_TRACCAR_URL || "https://demo2.traccar.org";

  const [config, setConfig] = useState<TraccarConfig>({
    serverUrl: configuredServer,
    email: "",
    password: "",
  });
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    const savedConfig = loadTraccarConfig();
    if (savedConfig) {
      setConfig(savedConfig);
      setIsConnected(isTraccarConfigured());
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setMessage(null);

    try {
      const success = await initializeTraccar(config);
      if (success) {
        setIsConnected(true);
        setMessage({ type: "success", text: "Successfully connected to Traccar!" });
        
        // Sync devices after connection
        setTimeout(async () => {
          const devices = await syncTraccarDevices();
          setMessage({
            type: "success",
            text: `Connected! Synced ${devices.length} devices from Traccar.`,
          });
        }, 1000);
      } else {
        setMessage({ type: "error", text: "Failed to connect to Traccar. Please check your credentials." });
      }
    } catch (error: any) {
      setMessage({ type: "error", text: error.message || "Connection failed" });
    } finally {
      setIsLoading(false);
    }
  };

  const handleDisconnect = () => {
    disconnectTraccar();
    setIsConnected(false);
    setConfig({ serverUrl: "", email: "", password: "" });
    setMessage({ type: "success", text: "Disconnected from Traccar" });
  };

  const handleSync = async () => {
    setIsLoading(true);
    setMessage(null);
    
    try {
      const devices = await syncTraccarDevices();
      setMessage({
        type: "success",
        text: `Synced ${devices.length} devices from Traccar.`,
      });
    } catch (error: any) {
      setMessage({ type: "error", text: error.message || "Sync failed" });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="container-fluid p-4">
      <div className="mb-4">
        <h1>Traccar Integration Settings</h1>
      </div>

      <div className="row">
        <div className="col-md-8">
          <div className="card">
            <div className="card-header">
              <h5>Traccar Server Configuration</h5>
            </div>
            <div className="card-body">
              <div className="alert alert-info">
                <strong>About Traccar:</strong> Traccar is an open-source GPS tracking platform
                that supports multiple protocols and device models, including all Teltonika devices.
                <br />
                <a
                  href="https://www.traccar.org/"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Learn more about Traccar
                </a>
              </div>

              {message && (
                <div
                  className={`alert alert-${message.type === "success" ? "success" : "danger"}`}
                  role="alert"
                >
                  {message.text}
                </div>
              )}

              {isConnected ? (
                <div>
                  <div className="alert alert-success">
                    <strong>✓ Connected to Traccar</strong>
                    <br />
                    Server: {configuredServer}
                    <br />
                    Email: {config.email}
                  </div>
                  <div className="d-flex gap-2">
                    <button
                      className="btn btn-primary"
                      onClick={handleSync}
                      disabled={isLoading}
                    >
                      {isLoading ? "Syncing..." : "Sync Devices Now"}
                    </button>
                    <button
                      className="btn btn-danger"
                      onClick={handleDisconnect}
                    >
                      Disconnect
                    </button>
                  </div>
                </div>
              ) : (
                <form onSubmit={handleSubmit}>
                  <div className="mb-3">
                    <label className="form-label">Traccar Server</label>
                    <input
                      type="text"
                      className="form-control bg-light"
                      value={configuredServer}
                      readOnly
                    />
                    <small className="form-text text-muted">
                      Set via <code>VITE_TRACCAR_URL</code> in <code>.env.local</code>
                    </small>
                  </div>

                  <div className="mb-3">
                    <label className="form-label">Email *</label>
                    <input
                      type="email"
                      className="form-control"
                      value={config.email}
                      onChange={(e) =>
                        setConfig({ ...config, email: e.target.value })
                      }
                      placeholder="your-email@example.com"
                      required
                    />
                  </div>

                  <div className="mb-3">
                    <label className="form-label">Password *</label>
                    <input
                      type="password"
                      className="form-control"
                      value={config.password}
                      onChange={(e) =>
                        setConfig({ ...config, password: e.target.value })
                      }
                      placeholder="Your Traccar password"
                      required
                    />
                  </div>

                  <button
                    type="submit"
                    className="btn btn-primary"
                    disabled={isLoading}
                  >
                    {isLoading ? "Connecting..." : "Connect to Traccar"}
                  </button>
                </form>
              )}
            </div>
          </div>
        </div>

        <div className="col-md-4">
          <div className="card">
            <div className="card-header">
              <h5>Quick Setup Guide</h5>
            </div>
            <div className="card-body">
              <ol>
                <li>
                  <strong>Install Traccar Server</strong>
                  <br />
                  Download and install Traccar server from{" "}
                  <a
                    href="https://www.traccar.org/download/"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    traccar.org/download
                  </a>
                </li>
                <li>
                  <strong>Configure Devices</strong>
                  <br />
                  Add your Teltonika devices in Traccar with their IMEI numbers
                </li>
                <li>
                  <strong>Connect Here</strong>
                  <br />
                  Enter your Traccar server URL and credentials above
                </li>
                <li>
                  <strong>Sync Devices</strong>
                  <br />
                  Click "Sync Devices Now" to import devices and positions
                </li>
              </ol>
            </div>
          </div>

          <div className="card mt-3">
            <div className="card-header">
              <h5>Benefits</h5>
            </div>
            <div className="card-body">
              <ul>
                <li>Real-time GPS tracking</li>
                <li>Support for all Teltonika devices</li>
                <li>Historical location data</li>
                <li>Alerts and notifications</li>
                <li>Multiple protocol support</li>
                <li>Open source and free</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TraccarSettings;
