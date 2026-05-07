# TrackMe - GPS Vehicle Tracking Application

A fully functional GPS vehicle tracking application built with React, TypeScript, and Vite. Designed to work with all Teltonika GPS tracking devices.

## Features

- 🗺️ **Real-time Map View**: Interactive map showing all registered devices with live location updates
- 📱 **Device Management**: Admin panel to add, edit, and delete Teltonika devices
- 🚗 **Multiple Device Support**: Track multiple vehicles/devices simultaneously
- 📊 **Device Status**: Monitor device status (online/offline), battery level, signal strength, and speed
- 🔧 **Multi-Model Support**: Support for all Teltonika device families (FMB, FMC, FMM, FMP, FMT, GH series)
- 💾 **Local Storage**: Device data persisted in browser localStorage
- 🎨 **Modern UI**: Clean, responsive interface built with Bootstrap

## Getting Started

### Installation

```bash
npm install
```

### Development

```bash
npm run dev
```

The application will be available at `http://localhost:5173`

### Build for Production

```bash
npm run build
```

## Usage

### Adding Devices

1. Navigate to the Admin Panel by clicking "Manage Devices" on the map view
2. Click "+ Add Device" to create a new device
3. Fill in the required information:
   - **Device Name**: A friendly name for the device
   - **Device Model**: Select your Teltonika device model from the dropdown (FMB, FMC, FMM, FMP, FMT, GH series)
   - **IMEI**: The 15-16 digit IMEI number of your Teltonika device
   - **Initial Location**: Starting coordinates (optional, defaults to Kohat, Pakistan)
   - **Description**: Optional notes about the device

### Viewing Devices on Map

- The main map view displays all registered devices
- Click on a device in the sidebar or on the map marker to focus on it
- Device markers rotate based on heading direction
- Click markers to see detailed information (IMEI, coordinates, speed, battery)

### Device Status

- 🟢 **Green**: Device is online and sending data
- 🔴 **Red**: Device is offline or not responding

## Traccar Integration

This application integrates with [Traccar](https://www.traccar.org/), a free and open-source modern GPS tracking platform that supports 200+ device models and protocols.

### Setting Up Traccar

1. **Option 1: Use Traccar Demo Server**
   - Visit the [Traccar Demo](https://demo.traccar.org)
   - Create an account or use existing credentials
   - Navigate to Settings → Traccar in this app
   - Enter: `https://demo.traccar.org` as server URL
   - Enter your Traccar username and password
   - Click "Connect to Traccar"

2. **Option 2: Self-Hosted Traccar Server**
   - Install Traccar server on your own infrastructure
   - Follow [Traccar Installation Guide](https://www.traccar.org/download/)
   - Configure your GPS devices to send data to your Traccar server
   - Enter your server URL in the Traccar settings

### Traccar Features

- **Real-time Tracking**: Live location updates via WebSocket
- **Device Management**: Sync devices from Traccar automatically
- **Multi-Protocol Support**: Works with Teltonika, OBD, and 200+ other protocols
- **Historical Data**: Access trip history and location data
- **Alerts & Geofencing**: Configure alerts in Traccar (managed in Traccar interface)

### Using Traccar

1. Navigate to **Settings → Traccar** in the app
2. Enter your Traccar server credentials
3. Click "Connect to Traccar"
4. Click "Sync Devices from Traccar" to import your devices
5. Devices will automatically sync and update in real-time

## Teltonika Device Integration

This application supports all Teltonika GPS tracking devices. To integrate real device data:

### Supported Device Families

- **FMB Series**: FMB001, FMB010, FMB100, FMB110, FMB120, FMB122, FMB125, FMB130, FMB140, FMB900, FMB920, FMB962, FMB964
- **FMC Series**: FMC001, FMC110, FMC125, FMC130
- **FMM Series**: FMM001, FMM640
- **FMP Series**: FMP100
- **FMT Series**: FMT100, FMT250
- **GH Series**: GH3000, GH5200

### Option 1: Backend TCP Server

1. Set up a TCP server to receive data from Teltonika devices (default port: 5027)
2. Configure your Teltonika devices to send data to your server IP and port
3. Parse incoming data packets using the Teltonika protocol (Codec 8, Codec 8 Extended, or Codec 16)
4. Update device locations using the `updateDeviceLocation()` function from `deviceService`

See `src/services/teltonikaService.ts` for integration examples and protocol details.

### Option 2: WebSocket Connection

If you have a backend server that processes Teltonika data:

1. Set up a WebSocket server that receives and processes Teltonika device data
2. Push updates to the frontend in JSON format:
   ```json
   {
     "imei": "123456789012345",
     "coords": [33.5816, 71.4492],
     "angle": 45,
     "speed": 60,
     "battery": 85,
     "signal": 4
   }
   ```
3. Use the `setupWebSocketConnection()` function in `teltonikaService.ts`

### Device Configuration

Configure your Teltonika device using Teltonika Configurator or SMS commands:

- Set server IP address and port
- Configure data sending interval
- Set up GPRS/APN settings
- Enable GPS tracking

For detailed configuration, refer to the [Teltonika Wiki](https://wiki.teltonika-gps.com/) for your specific device model.

## Project Structure

```
src/
├── components/
│   ├── AdminPanel.tsx    # Device management interface
│   ├── MapView.tsx       # Main map view with device tracking
│   └── ...
├── services/
│   ├── deviceService.ts     # Device CRUD operations and storage
│   └── teltonikaService.ts  # Teltonika device integration helpers
├── types/
│   ├── device.ts         # Device type definitions
│   └── ...
└── App.tsx               # Main app with routing
```

## Technologies Used

- **React 19** - UI framework
- **TypeScript** - Type safety
- **Vite** - Build tool and dev server
- **React Router** - Navigation
- **Leaflet** - Map rendering
- **React Leaflet** - React bindings for Leaflet
- **Bootstrap 5** - UI styling

## Data Storage

Currently, device data is stored in browser localStorage. For production use, consider:

- Backend API with database (PostgreSQL, MongoDB, etc.)
- User authentication and authorization
- Real-time data synchronization
- Historical tracking data storage

## License

MIT
