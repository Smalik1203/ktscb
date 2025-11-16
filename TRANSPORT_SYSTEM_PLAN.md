# Transport Management System - Implementation Plan

## Overview
A simple, real-time bus tracking system integrated into ClassBridge that allows students to track their school bus location and see ETAs, while giving super admins a complete overview of all buses.

---

## Core Requirements

### Student Features
- ✅ See assigned school bus location on map (real-time)
- ✅ View estimated time of arrival (ETA) to their pickup stop
- ✅ Get notifications when bus is approaching
- ✅ View route and all stops

### Super Admin Features
- ✅ View all school buses on a single map dashboard
- ✅ Add/manage buses (bus number, capacity, route)
- ✅ Create routes with stops
- ✅ Add users with "captain" role (bus drivers)
- ✅ Assign captains to buses
- ✅ Assign students to buses and pickup stops
- ✅ View bus status (active/inactive)
- ✅ View captain details and contact info

### Captain (Driver) Features
- ✅ Simple login interface
- ✅ Start/Stop route tracking
- ✅ View assigned bus and route
- ✅ See student list with pickup stops
- ✅ App tracks location automatically when route is active

---

## Database Schema

### 1. Update `users` table
```sql
-- Add 'captain' to existing role enum
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'captain';
```

### 2. New Table: `buses`
```sql
CREATE TABLE buses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  school_code TEXT NOT NULL REFERENCES schools(school_code),
  bus_number TEXT NOT NULL, -- e.g., "BUS-01", "KA-01-AB-1234"
  bus_name TEXT, -- e.g., "North Route", "East Route"
  capacity INTEGER NOT NULL DEFAULT 40,
  contact_number TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(school_code, bus_number)
);
```

### 3. New Table: `bus_routes`
```sql
CREATE TABLE bus_routes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  bus_id UUID NOT NULL REFERENCES buses(id) ON DELETE CASCADE,
  route_name TEXT NOT NULL, -- e.g., "Morning Pickup", "Afternoon Drop"
  route_type TEXT CHECK (route_type IN ('pickup', 'drop')),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 4. New Table: `bus_stops`
```sql
CREATE TABLE bus_stops (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  route_id UUID NOT NULL REFERENCES bus_routes(id) ON DELETE CASCADE,
  stop_name TEXT NOT NULL, -- e.g., "Main Gate", "Green Park", "Sector 12"
  stop_address TEXT,
  latitude DECIMAL(10, 8) NOT NULL,
  longitude DECIMAL(11, 8) NOT NULL,
  stop_order INTEGER NOT NULL, -- Order in route: 1, 2, 3...
  estimated_arrival_time TIME, -- Optional: Expected arrival time
  created_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(route_id, stop_order)
);
```

### 5. New Table: `bus_captain_assignment`
```sql
CREATE TABLE bus_captain_assignment (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  bus_id UUID NOT NULL REFERENCES buses(id) ON DELETE CASCADE,
  captain_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  assigned_at TIMESTAMPTZ DEFAULT NOW(),
  is_active BOOLEAN DEFAULT true,

  UNIQUE(bus_id, captain_id)
);

-- Index for quick captain lookup
CREATE INDEX idx_bus_captain_active ON bus_captain_assignment(captain_id, is_active);
```

### 6. New Table: `student_bus_assignment`
```sql
CREATE TABLE student_bus_assignment (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  student_id UUID NOT NULL REFERENCES student(id) ON DELETE CASCADE,
  bus_id UUID NOT NULL REFERENCES buses(id) ON DELETE CASCADE,
  pickup_stop_id UUID REFERENCES bus_stops(id),
  drop_stop_id UUID REFERENCES bus_stops(id),
  assigned_at TIMESTAMPTZ DEFAULT NOW(),
  is_active BOOLEAN DEFAULT true,

  UNIQUE(student_id, bus_id)
);

-- Index for quick student lookup
CREATE INDEX idx_student_bus_active ON student_bus_assignment(student_id, is_active);
```

### 7. New Table: `bus_locations` (Real-time tracking)
```sql
CREATE TABLE bus_locations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  bus_id UUID NOT NULL REFERENCES buses(id) ON DELETE CASCADE,
  captain_id UUID NOT NULL REFERENCES users(id),
  latitude DECIMAL(10, 8) NOT NULL,
  longitude DECIMAL(11, 8) NOT NULL,
  speed DECIMAL(5, 2), -- km/h
  heading DECIMAL(5, 2), -- Degrees (0-360)
  accuracy DECIMAL(5, 2), -- meters
  timestamp TIMESTAMPTZ DEFAULT NOW(),

  -- Keep only recent data (last 24 hours)
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for latest location queries
CREATE INDEX idx_bus_locations_latest ON bus_locations(bus_id, timestamp DESC);

-- Auto-delete old location data (optional - can use pg_cron)
-- Keep only last 24 hours of data
```

### 8. New Table: `bus_route_sessions` (Track active routes)
```sql
CREATE TABLE bus_route_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  bus_id UUID NOT NULL REFERENCES buses(id),
  route_id UUID NOT NULL REFERENCES bus_routes(id),
  captain_id UUID NOT NULL REFERENCES users(id),
  started_at TIMESTAMPTZ DEFAULT NOW(),
  ended_at TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT true,
  total_distance DECIMAL(6, 2), -- km

  -- Only one active session per bus
  CONSTRAINT single_active_session UNIQUE(bus_id, is_active)
    WHERE (is_active = true)
);
```

### 9. New Table: `captain` (Captain profile details)
```sql
CREATE TABLE captain (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  school_code TEXT NOT NULL REFERENCES schools(school_code),
  license_number TEXT,
  license_expiry DATE,
  phone TEXT NOT NULL,
  emergency_contact TEXT,
  joining_date DATE,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## Technical Architecture

### Technology Stack

#### Location Tracking
- **expo-location** - Get device GPS coordinates
- **expo-task-manager** - Background location tracking
- **expo-background-fetch** - Periodic updates even when app is closed

#### Maps & Visualization
- **react-native-maps** - Native map component for iOS/Android
- **@react-native-google-maps/maps** (optional) - Advanced features
- For web: **Leaflet** or **Google Maps JavaScript API**

#### Real-time Updates
- **Supabase Realtime** - Subscribe to `bus_locations` table changes
- Students automatically see bus move on map
- Super admin dashboard updates in real-time

#### ETA Calculation
- Use Haversine formula for straight-line distance
- Or integrate **Google Maps Distance Matrix API** for accurate routing
- Calculate based on:
  - Distance to student's stop
  - Current bus speed
  - Average speed on route

---

## Implementation Plan

### Phase 1: Database Setup (Week 1)

#### Migration 1: Create Tables
```sql
-- File: supabase/migrations/YYYYMMDDHHMMSS_create_transport_tables.sql

-- 1. Add captain role
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'captain';

-- 2. Create all tables (buses, bus_routes, bus_stops, etc.)
-- (Use schema defined above)

-- 3. Enable RLS on all tables
ALTER TABLE buses ENABLE ROW LEVEL SECURITY;
ALTER TABLE bus_routes ENABLE ROW LEVEL SECURITY;
ALTER TABLE bus_stops ENABLE ROW LEVEL SECURITY;
ALTER TABLE bus_captain_assignment ENABLE ROW LEVEL SECURITY;
ALTER TABLE student_bus_assignment ENABLE ROW LEVEL SECURITY;
ALTER TABLE bus_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE bus_route_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE captain ENABLE ROW LEVEL SECURITY;

-- 4. Create RLS policies (examples below)
```

#### RLS Policies Examples

```sql
-- Super Admin can do everything
CREATE POLICY "superadmin_all_buses" ON buses
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE id = auth.uid()
      AND role = 'superadmin'
      AND school_code = buses.school_code
    )
  );

-- Captains can view their assigned buses
CREATE POLICY "captain_view_assigned_buses" ON buses
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM bus_captain_assignment bca
      JOIN users u ON u.id = bca.captain_id
      WHERE u.id = auth.uid()
      AND bca.bus_id = buses.id
      AND bca.is_active = true
    )
  );

-- Students can view their assigned bus
CREATE POLICY "student_view_assigned_bus" ON buses
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM student_bus_assignment sba
      JOIN student s ON s.id = sba.student_id
      WHERE s.auth_user_id = auth.uid()
      AND sba.bus_id = buses.id
      AND sba.is_active = true
    )
  );

-- Captains can insert their own location
CREATE POLICY "captain_insert_location" ON bus_locations
  FOR INSERT WITH CHECK (
    captain_id = auth.uid()
  );

-- Students can view location of their assigned bus
CREATE POLICY "student_view_bus_location" ON bus_locations
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM student_bus_assignment sba
      JOIN student s ON s.id = sba.student_id
      WHERE s.auth_user_id = auth.uid()
      AND sba.bus_id = bus_locations.bus_id
    )
  );

-- Super admin can view all locations
CREATE POLICY "superadmin_view_all_locations" ON bus_locations
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM users u
      JOIN buses b ON b.school_code = u.school_code
      WHERE u.id = auth.uid()
      AND u.role = 'superadmin'
      AND b.id = bus_locations.bus_id
    )
  );
```

### Phase 2: Backend Services (Week 1-2)

#### Location Service
```typescript
// src/services/location.ts

import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import { supabase } from '@/lib/supabase';

const LOCATION_TASK_NAME = 'background-location-task';

// Define background task
TaskManager.defineTask(LOCATION_TASK_NAME, async ({ data, error }) => {
  if (error) {
    console.error('Location task error:', error);
    return;
  }

  if (data) {
    const { locations } = data as { locations: Location.LocationObject[] };
    const location = locations[0];

    // Get current user and active route session
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // Get active session for this captain
    const { data: session } = await supabase
      .from('bus_route_sessions')
      .select('bus_id')
      .eq('captain_id', user.id)
      .eq('is_active', true)
      .single();

    if (session) {
      // Insert location update
      await supabase.from('bus_locations').insert({
        bus_id: session.bus_id,
        captain_id: user.id,
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        speed: location.coords.speed || 0,
        heading: location.coords.heading || 0,
        accuracy: location.coords.accuracy || 0,
      });
    }
  }
});

export async function startLocationTracking() {
  // Request permissions
  const { status } = await Location.requestForegroundPermissionsAsync();
  if (status !== 'granted') {
    throw new Error('Location permission not granted');
  }

  const { status: backgroundStatus } = await Location.requestBackgroundPermissionsAsync();
  if (backgroundStatus !== 'granted') {
    throw new Error('Background location permission not granted');
  }

  // Start tracking
  await Location.startLocationUpdatesAsync(LOCATION_TASK_NAME, {
    accuracy: Location.Accuracy.High,
    timeInterval: 10000, // Update every 10 seconds
    distanceInterval: 50, // Or when moved 50 meters
    foregroundService: {
      notificationTitle: 'ClassBridge Transport',
      notificationBody: 'Tracking bus location',
    },
  });
}

export async function stopLocationTracking() {
  await Location.stopLocationUpdatesAsync(LOCATION_TASK_NAME);
}
```

#### ETA Calculation Service
```typescript
// src/services/eta.ts

// Haversine formula for distance calculation
export function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371; // Earth's radius in km
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
    Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) *
    Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c; // Distance in km
}

function toRad(degrees: number): number {
  return degrees * (Math.PI / 180);
}

export function calculateETA(
  busLat: number,
  busLon: number,
  stopLat: number,
  stopLon: number,
  averageSpeed: number = 30 // km/h, default assumption
): { distance: number; eta: number; etaText: string } {
  const distance = calculateDistance(busLat, busLon, stopLat, stopLon);
  const hours = distance / averageSpeed;
  const minutes = Math.round(hours * 60);

  let etaText = '';
  if (minutes < 1) {
    etaText = 'Arriving now';
  } else if (minutes === 1) {
    etaText = '1 minute';
  } else if (minutes < 60) {
    etaText = `${minutes} minutes`;
  } else {
    const hrs = Math.floor(minutes / 60);
    const mins = minutes % 60;
    etaText = `${hrs}h ${mins}m`;
  }

  return {
    distance: parseFloat(distance.toFixed(2)),
    eta: minutes,
    etaText,
  };
}
```

### Phase 3: UI Components (Week 2-3)

#### Super Admin Features

**1. Add Bus Form**
```typescript
// src/features/transport/AddBusForm.tsx

interface BusFormData {
  bus_number: string;
  bus_name: string;
  capacity: number;
  contact_number: string;
}

export function AddBusForm() {
  const [formData, setFormData] = useState<BusFormData>({
    bus_number: '',
    bus_name: '',
    capacity: 40,
    contact_number: '',
  });

  const handleSubmit = async () => {
    const { data, error } = await supabase
      .from('buses')
      .insert({
        ...formData,
        school_code: user.school_code,
      });

    if (!error) {
      // Success
      router.back();
    }
  };

  return (
    // Form UI
  );
}
```

**2. Bus Dashboard (All Buses on Map)**
```typescript
// src/features/transport/BusDashboard.tsx

import MapView, { Marker } from 'react-native-maps';

export function BusDashboard() {
  // Subscribe to all bus locations in real-time
  const { data: buses } = useBusLocations();

  return (
    <View style={{ flex: 1 }}>
      <MapView
        style={{ flex: 1 }}
        initialRegion={{
          latitude: 28.6139, // School location
          longitude: 77.2090,
          latitudeDelta: 0.1,
          longitudeDelta: 0.1,
        }}
      >
        {buses?.map((bus) => (
          <Marker
            key={bus.id}
            coordinate={{
              latitude: bus.latitude,
              longitude: bus.longitude,
            }}
            title={bus.bus_number}
            description={`Speed: ${bus.speed} km/h`}
          >
            {/* Custom bus icon */}
            <BusMarkerIcon />
          </Marker>
        ))}
      </MapView>

      {/* Bus list below map */}
      <BusList buses={buses} />
    </View>
  );
}
```

**3. Assign Captain to Bus**
```typescript
// src/features/transport/AssignCaptainModal.tsx

export function AssignCaptainModal({ busId }: { busId: string }) {
  const { data: captains } = useCaptains();

  const handleAssign = async (captainId: string) => {
    await supabase.from('bus_captain_assignment').insert({
      bus_id: busId,
      captain_id: captainId,
    });
  };

  return (
    // Modal with captain selection
  );
}
```

**4. Assign Student to Bus**
```typescript
// src/features/transport/AssignStudentToBus.tsx

export function AssignStudentToBus() {
  const { data: students } = useStudents();
  const { data: buses } = useBuses();
  const { data: stops } = useBusStops();

  const handleAssign = async (studentId: string, busId: string, stopId: string) => {
    await supabase.from('student_bus_assignment').insert({
      student_id: studentId,
      bus_id: busId,
      pickup_stop_id: stopId,
    });
  };

  return (
    // UI for selecting student, bus, and stop
  );
}
```

#### Captain Features

**5. Captain Dashboard**
```typescript
// src/features/transport/CaptainDashboard.tsx

export function CaptainDashboard() {
  const { data: assignedBus } = useAssignedBus();
  const [isTracking, setIsTracking] = useState(false);

  const handleStartRoute = async () => {
    // Start location tracking
    await startLocationTracking();

    // Create route session
    await supabase.from('bus_route_sessions').insert({
      bus_id: assignedBus.id,
      route_id: assignedBus.route_id,
      captain_id: user.id,
      is_active: true,
    });

    setIsTracking(true);
  };

  const handleEndRoute = async () => {
    // Stop tracking
    await stopLocationTracking();

    // End session
    await supabase
      .from('bus_route_sessions')
      .update({ ended_at: new Date(), is_active: false })
      .eq('captain_id', user.id)
      .eq('is_active', true);

    setIsTracking(false);
  };

  return (
    <View>
      <Text>Bus: {assignedBus.bus_number}</Text>
      <Text>Route: {assignedBus.route_name}</Text>

      {!isTracking ? (
        <Button title="Start Route" onPress={handleStartRoute} />
      ) : (
        <Button title="End Route" onPress={handleEndRoute} />
      )}

      {/* Show student list with stops */}
      <StudentList students={assignedBus.students} />
    </View>
  );
}
```

#### Student Features

**6. Student Bus Tracker**
```typescript
// src/features/transport/StudentBusTracker.tsx

import MapView, { Marker, Polyline } from 'react-native-maps';

export function StudentBusTracker() {
  const { data: assignment } = useMyBusAssignment();
  const { data: busLocation } = useBusLocation(assignment?.bus_id);
  const { data: myStop } = useBusStop(assignment?.pickup_stop_id);

  const eta = busLocation && myStop
    ? calculateETA(
        busLocation.latitude,
        busLocation.longitude,
        myStop.latitude,
        myStop.longitude
      )
    : null;

  return (
    <View style={{ flex: 1 }}>
      {/* ETA Display */}
      <View style={styles.etaCard}>
        <Text>Bus: {assignment?.bus_number}</Text>
        <Text style={styles.eta}>{eta?.etaText || 'Calculating...'}</Text>
        <Text>Distance: {eta?.distance} km</Text>
      </View>

      {/* Map */}
      <MapView
        style={{ flex: 1 }}
        initialRegion={{
          latitude: myStop?.latitude || 0,
          longitude: myStop?.longitude || 0,
          latitudeDelta: 0.05,
          longitudeDelta: 0.05,
        }}
      >
        {/* Bus marker */}
        {busLocation && (
          <Marker
            coordinate={{
              latitude: busLocation.latitude,
              longitude: busLocation.longitude,
            }}
            title="Your Bus"
          >
            <BusIcon />
          </Marker>
        )}

        {/* Student's stop marker */}
        {myStop && (
          <Marker
            coordinate={{
              latitude: myStop.latitude,
              longitude: myStop.longitude,
            }}
            title={myStop.stop_name}
            pinColor="green"
          />
        )}

        {/* Route line (optional) */}
        {busLocation && myStop && (
          <Polyline
            coordinates={[
              { latitude: busLocation.latitude, longitude: busLocation.longitude },
              { latitude: myStop.latitude, longitude: myStop.longitude },
            ]}
            strokeColor="#FF6B35"
            strokeWidth={3}
          />
        )}
      </MapView>
    </View>
  );
}
```

### Phase 4: Real-time Subscriptions (Week 3)

#### Hook: useBusLocation (Real-time)
```typescript
// src/hooks/useBusLocation.ts

export function useBusLocation(busId?: string) {
  const [location, setLocation] = useState<BusLocation | null>(null);

  useEffect(() => {
    if (!busId) return;

    // Get latest location
    supabase
      .from('bus_locations')
      .select('*')
      .eq('bus_id', busId)
      .order('timestamp', { ascending: false })
      .limit(1)
      .single()
      .then(({ data }) => setLocation(data));

    // Subscribe to real-time updates
    const channel = supabase
      .channel(`bus-${busId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'bus_locations',
          filter: `bus_id=eq.${busId}`,
        },
        (payload) => {
          setLocation(payload.new as BusLocation);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [busId]);

  return { data: location };
}
```

---

## User Flows

### Flow 1: Super Admin Sets Up Transport System

1. **Add Buses**
   - Navigate to "Transport Management" (new tab)
   - Click "Add Bus"
   - Enter: Bus Number, Name, Capacity, Contact
   - Save

2. **Create Route with Stops**
   - Click on bus → "Manage Routes"
   - Create route: "Morning Pickup"
   - Add stops:
     - Stop 1: "Main Gate" (lat, lng) - 7:00 AM
     - Stop 2: "Green Park" - 7:15 AM
     - Stop 3: "Sector 12" - 7:30 AM
     - Stop 4: "School" - 8:00 AM

3. **Add Captain (Driver)**
   - Navigate to "Add Admins" (existing screen)
   - Select role: "Captain"
   - Fill details: Name, Email, Phone, License Number
   - Save (credentials sent to driver)

4. **Assign Captain to Bus**
   - Go to bus details
   - Click "Assign Captain"
   - Select captain from list
   - Confirm

5. **Assign Students to Bus**
   - Navigate to "Students"
   - Select student
   - Click "Assign to Bus"
   - Select bus and pickup stop
   - Save

### Flow 2: Captain Starts Daily Route

1. **Login**
   - Captain logs into ClassBridge app
   - Dashboard shows assigned bus

2. **Start Route**
   - Click "Start Morning Route"
   - App requests location permission
   - Grant permission
   - Route starts
   - App begins tracking location every 10 seconds

3. **During Route**
   - Captain drives along route
   - App automatically sends location updates
   - Can see student list with stops

4. **End Route**
   - Reaches school
   - Click "End Route"
   - Location tracking stops
   - Session saved

### Flow 3: Student Tracks Bus

1. **Open App**
   - Student logs in
   - Dashboard shows "Track Bus" card

2. **View Bus Location**
   - Click "Track Bus"
   - Map opens showing:
     - Bus current location (moving marker)
     - Student's pickup stop (green pin)
     - ETA: "12 minutes"
     - Distance: "3.5 km"

3. **Real-time Updates**
   - Bus marker updates every 10 seconds
   - ETA recalculates automatically
   - When bus is < 5 minutes away: Notification

4. **Notification**
   - "Your bus is 5 minutes away!"
   - Student prepares to leave

---

## Navigation Structure

### Add New Tab: Transport

```typescript
// app/(tabs)/_layout.tsx

const MENU: MenuItem[] = [
  // ... existing items
  {
    key: 'transport',
    label: 'Transport',
    route: '/(tabs)/transport',
    icon: 'Bus',
    roles: ['superadmin', 'admin', 'student', 'captain'],
  },
];
```

### Routes

```
/(tabs)/
  transport.tsx           → Main transport screen (role-based)
  transport-dashboard.tsx → Super admin: All buses map
  transport-buses.tsx     → Super admin: Manage buses
  transport-routes.tsx    → Super admin: Manage routes
  transport-captains.tsx  → Super admin: Manage captains
  transport-assign.tsx    → Super admin: Assign students
  captain-dashboard.tsx   → Captain: Start/stop tracking
  student-bus-tracker.tsx → Student: Track my bus
```

---

## Notifications

### For Students
- "Your bus has started the route" (when captain starts)
- "Bus is 10 minutes away"
- "Bus is 5 minutes away"
- "Bus is approaching your stop"

### For Captains
- "Route started successfully"
- "Remember to mark route complete"

### For Super Admin
- "Captain [Name] started route for Bus [Number]"
- "All buses have completed morning routes"

---

## Additional Features (Future Enhancements)

### Phase 2 Features
1. **Attendance on Bus** - Captain marks students as boarded
2. **Route Optimization** - AI suggests optimal route
3. **Fuel Tracking** - Record fuel expenses
4. **Maintenance Alerts** - Service reminders
5. **Parent App Integration** - Parents track their child's bus
6. **SOS Button** - Emergency alert from captain
7. **Bus Capacity Alerts** - Warn if over capacity
8. **Historical Analytics** - Route performance, delays
9. **Multiple Routes per Bus** - Morning pickup, afternoon drop
10. **Driver Ratings** - Student/parent feedback

---

## Security Considerations

### Location Privacy
- Only authorized users see locations
- Students see only their assigned bus
- Captains see only their bus
- Super admin sees all buses
- RLS policies enforce strict access

### Data Retention
- Keep location data for 24 hours only
- Auto-delete old records to save storage
- Session history kept for 30 days

### Permission Handling
- Request location permissions gracefully
- Explain why permissions are needed
- Handle denials properly

---

## Cost Considerations

### Free Tier (Supabase)
- 500 MB database (should be sufficient)
- 5 GB bandwidth per month
- Real-time connections: Check limits

### Potential Costs
- **Google Maps API** (if used):
  - Maps SDK: $7 per 1000 loads
  - Distance Matrix API: $5 per 1000 elements
  - Consider using free alternatives: OpenStreetMap, Mapbox free tier

- **Location Updates**:
  - 10 buses × 10 updates/min × 2 hours = 12,000 updates/day
  - Supabase real-time should handle this easily

### Optimization
- Use Supabase Realtime (included in free tier)
- Use open-source maps (react-native-maps with OSM)
- Implement location update throttling
- Clean up old data regularly

---

## Testing Plan

### Unit Tests
- Distance calculation accuracy
- ETA calculation logic
- Location update service

### Integration Tests
- Captain starts route → Location updates → Student sees bus
- Multiple buses tracked simultaneously
- Real-time subscription updates

### User Testing
- Captain: Can they easily start/stop routes?
- Students: Is the map clear and ETA accurate?
- Super Admin: Can they manage all buses effectively?

### Performance Testing
- 10 buses sending updates simultaneously
- 500 students viewing locations
- Real-time update latency

---

## Rollout Strategy

### Week 1: Pilot Test
- 1 bus, 1 route, 20 students
- Gather feedback
- Fix critical issues

### Week 2: Expand
- 3 buses, 60 students
- Monitor performance
- Refine ETA accuracy

### Week 3: Full Rollout
- All buses
- All students
- Monitoring dashboard

---

## Success Metrics

### Key Performance Indicators
1. **Accuracy**: ETA within ±5 minutes (target: 90%)
2. **Uptime**: Location tracking active (target: 95%)
3. **Adoption**: Students using tracking (target: 70%)
4. **Satisfaction**: User feedback (target: 4/5 stars)
5. **Response Time**: Map updates (target: <2 seconds)

---

## Technical Checklist

### Dependencies to Add
```json
{
  "expo-location": "~17.0.1",
  "expo-task-manager": "~12.0.1",
  "react-native-maps": "1.14.0",
  "expo-notifications": "~0.28.9" // For alerts
}
```

### Permissions Required (app.json)
```json
{
  "expo": {
    "ios": {
      "infoPlist": {
        "NSLocationWhenInUseUsageDescription": "ClassBridge needs your location to track the school bus.",
        "NSLocationAlwaysUsageDescription": "ClassBridge needs your location in the background to track the school bus route.",
        "UIBackgroundModes": ["location"]
      }
    },
    "android": {
      "permissions": [
        "ACCESS_FINE_LOCATION",
        "ACCESS_COARSE_LOCATION",
        "ACCESS_BACKGROUND_LOCATION"
      ]
    }
  }
}
```

---

## Conclusion

This transport management system is designed to be:
- ✅ **Simple** - Minimal complexity for users
- ✅ **Real-time** - Live bus tracking
- ✅ **Secure** - RLS policies protect data
- ✅ **Scalable** - Handles multiple buses easily
- ✅ **Cost-effective** - Uses free/low-cost services
- ✅ **Integrated** - Fits seamlessly into ClassBridge

The captain's phone becomes the tracking device, students see real-time locations and ETAs, and super admins have complete oversight - all without complicated hardware or expensive third-party services.

---

**Ready to implement?** Let's start with Phase 1 (Database Setup) and build from there!
