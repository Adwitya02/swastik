# React Native Hindu Calendar App
A feature-rich calendar app built with React Native that supports:
- Event creation and reminders
- Hindu festival display
- Fasting days with help of tithi calculations
- Cultrual Observances based on a static list
- Panchang (daily Hindu almanac) calculation using `mhah-panchang`
- Geolocation for accurate Panchang data
- Persistent event storage via AsyncStorage
- Clean and responsive UI with date and time pickers
---
##  Features
-  View and select dates on a scrollable calendar
-  See important Hindu festivals (e.g., Diwali, Holi)
-  Get daily Panchang details based on your location
-  Add, edit, and delete personal events with title, date, and time
-  Events are saved even after closing the app
-  Uses your device location or falls back to Delhi if permission is denied
---
##  Tech Stack
- **React Native** `v0.80.0`
- **React** `v19.1.0`
- `react-native-calendars` for the calendar UI
- `mhah-panchang` for Panchang calculations
- `react-native-geolocation-service` for location
- `@react-native-community/datetimepicker` for date/time selection
- `@react-native-async-storage/async-storage` for local persistence
---
## 🛠 Installation
### Prerequisites
- Node.js `>=18`
- Android Studio / Xcode (depending on platform)
- React Native CLI
### Steps
1. Clone the repository:
   ```bash
   git clone https://github.com/your-username/hindu-calendar-app.git
   cd hindu-calendar-app
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. For Android:  
   Add the following permissions to `android/app/src/main/AndroidManifest.xml`:
   ```xml
   <uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />
   <uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION" />
   ```
4. Run the app:
   ```bash
   npm run android
   # or for iOS
   npm run ios
   ```
---
##  Usage
- Tap a date on the calendar to view or add events
- Press "+ Add" to open the modal and enter event details
- View upcoming events and Hindu festivals
- Panchang automatically updates based on date and your current location
---
## Permissions
- **Location**: Required to fetch accurate Panchang data
- If location access is denied, the app defaults to Delhi’s coordinates
