/**
 * Teltonika GPS Tracker Integration
 *
 * Teltonika devices (FMC920 etc.) send data via TCP to Traccar on port 5027.
 * Traccar handles all protocol parsing server-side — this frontend app does not
 * parse Teltonika packets directly. Device data arrives via the Traccar REST API
 * and WebSocket connection configured in traccarService.ts.
 *
 * Device configuration: use Teltonika Configurator to set Server IP + port 5027.
 */

export {};
