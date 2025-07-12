import React, { useState, useMemo, useCallback, useEffect } from 'react';
import {
  SafeAreaView,
  ScrollView,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  TextInput,
  Alert,
  Platform,
  PermissionsAndroid,
} from 'react-native';
import { Calendar } from 'react-native-calendars';
import AsyncStorage from '@react-native-async-storage/async-storage';
import DateTimePicker from '@react-native-community/datetimepicker';
import Geolocation from 'react-native-geolocation-service';
import { MhahPanchang } from 'mhah-panchang';

// Sample Hindu festival data
const hinduFestivals = [
  { id: 'h1', date: '2025-10-23', title: 'Diwali', description: 'Festival of Lights' },
  { id: 'h2', date: '2025-03-14', title: 'Holi', description: 'Festival of Colors' },
];

const STORAGE_KEY = 'USER_EVENTS';
const delhiLocation = { latitude: 28.6139, longitude: 77.2090, altitude: 216 };

const isValidLocation = loc =>
  loc &&
  typeof loc.latitude === 'number' &&
  typeof loc.longitude === 'number' &&
  !isNaN(loc.latitude) &&
  !isNaN(loc.longitude) &&
  Math.abs(loc.latitude) <= 90 &&
  Math.abs(loc.longitude) <= 180;

const App = () => {
  const [events, setEvents] = useState([
    { id: '1', date: '2025-07-01', title: 'dinner with family', time: '19:00' },
    { id: '2', date: '2025-07-07', title: 'college start', time: '09:00' },
    { id: '3', date: '2025-07-30', title: 'Project deadline', time: '23:59' },
    { id: '4', date: '2025-07-02', title: 'my birthday', time: '00:00' },
  ]);

  useEffect(() => {
    const loadEvents = async () => {
      try {
        const stored = await AsyncStorage.getItem(STORAGE_KEY);
        if (stored) setEvents(JSON.parse(stored));
      } catch (e) {
        console.log('Failed to load events:', e);
      }
    };
    loadEvents();
  }, []);

  useEffect(() => {
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(events)).catch(e =>
      console.log('Failed to save events:', e)
    );
  }, [events]);

  const allEvents = useMemo(() => [...events, ...hinduFestivals], [events]);
  const [selectedDate, setSelectedDate] = useState(
    new Date().toISOString().split('T')[0]
  );
  const [location, setLocation] = useState({ latitude: null, longitude: null, altitude: 0 });
  const [locationError, setLocationError] = useState(null);
  const [usingDefaultLocation, setUsingDefaultLocation] = useState(false);

  useEffect(() => {
    const requestLocation = async () => {
      try {
        if (Platform.OS === 'android') {
          const granted = await PermissionsAndroid.request(
            PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION
          );
          if (granted !== PermissionsAndroid.RESULTS.GRANTED) {
            setLocationError('Location permission denied');
            setUsingDefaultLocation(true);
            return;
          }
        }
        Geolocation.getCurrentPosition(
          (pos) => {
            setLocation({
              latitude: pos.coords.latitude,
              longitude: pos.coords.longitude,
              altitude: pos.coords.altitude || 0,
            });
            setLocationError(null);
            setUsingDefaultLocation(false);
          },
          (error) => {
            setLocationError(error.message);
            setUsingDefaultLocation(true);
          },
          { enableHighAccuracy: true, timeout: 15000, maximumAge: 10000 }
        );
      } catch (err) {
        setLocationError('Failed to get location');
        setUsingDefaultLocation(true);
      }
    };
    requestLocation();
  }, []);

  const [panchang, setPanchang] = useState(null);
  const [panchangLoading, setPanchangLoading] = useState(false);

  useEffect(() => {
    const fetchPanchang = () => {
      const effectiveLocation = isValidLocation(location) ? location : delhiLocation;
      setUsingDefaultLocation(!isValidLocation(location));
      setPanchangLoading(true);
      try {
        const obj = new MhahPanchang();
        const dateObj = new Date(selectedDate);
        const result = obj.calendar(
          dateObj,
          effectiveLocation.latitude,
          effectiveLocation.longitude
        );
        setPanchang(result);
      } catch (e) {
        setPanchang(null);
        console.error('Panchang calculation error:', e);
        Alert.alert('Error', 'Failed to calculate Panchang');
      }
      setPanchangLoading(false);
    };
    fetchPanchang();
  }, [location, selectedDate]);

  const [modalVisible, setModalVisible] = useState(false);
  const [editingEvent, setEditingEvent] = useState(null);
  const [eventTitle, setEventTitle] = useState('');
  const [eventDate, setEventDate] = useState('');
  const [eventTime, setEventTime] = useState('');
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);

  const markedDates = useMemo(() => {
    const marks = {};
    allEvents.forEach(event => {
      marks[event.date] = { marked: true, dotColor: '#50cebb' };
    });
    marks[selectedDate] = { ...marks[selectedDate], selected: true, selectedColor: '#00adf5' };
    return marks;
  }, [allEvents, selectedDate]);
  const today = useMemo(() => new Date().toISOString().split('T')[0], []);
  const selectedDateEvents = useMemo(
    () => allEvents.filter(event => event.date === selectedDate),
    [allEvents, selectedDate]
  );
  const upcomingEvents = useMemo(
    () => allEvents.filter(event => event.date > selectedDate).slice(0, 5),
    [allEvents, selectedDate]
  );

  const openAddEventModal = useCallback(() => {
    setEditingEvent(null);
    setEventTitle('');
    setEventDate(selectedDate);
    setEventTime('12:00');
    setModalVisible(true);
  }, [selectedDate]);
  const openEditEventModal = useCallback((event) => {
    setEditingEvent(event);
    setEventTitle(event.title);
    setEventDate(event.date);
    setEventTime(event.time || '12:00');
    setModalVisible(true);
  }, []);
  const saveEvent = useCallback(() => {
    if (!eventTitle.trim()) {
      Alert.alert('Error', 'Please enter an event title');
      return;
    }
    if (!eventDate.match(/^\d{4}-\d{2}-\d{2}$/)) {
      Alert.alert('Error', 'Date must be in YYYY-MM-DD format');
      return;
    }
    if (!eventTime.match(/^\d{2}:\d{2}$/)) {
      Alert.alert('Error', 'Time must be in HH:MM format');
      return;
    }
    if (editingEvent) {
      setEvents(prevEvents =>
        prevEvents.map(event =>
          event.id === editingEvent.id
            ? { ...event, title: eventTitle, date: eventDate, time: eventTime }
            : event
        )
      );
    } else {
      const newEvent = {
        id: Date.now().toString(),
        title: eventTitle,
        date: eventDate,
        time: eventTime,
      };
      setEvents(prevEvents => [...prevEvents, newEvent]);
    }
    setModalVisible(false);
    setEventTitle('');
    setEventDate('');
    setEventTime('');
    setEditingEvent(null);
  }, [eventTitle, eventDate, eventTime, editingEvent]);
  const deleteEvent = useCallback((eventId) => {
    Alert.alert(
      'Delete Event',
      'Are you sure you want to delete this event?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            setEvents(prevEvents => prevEvents.filter(event => event.id !== eventId));
          },
        },
      ]
    );
  }, []);
  const EventItem = React.memo(({ event, onEdit, onDelete }) => (
    <View style={styles.eventItem}>
      <View>
        <Text style={styles.eventText}>{event.title}</Text>
        {event.date !== selectedDate && <Text style={styles.eventDate}>{event.date}</Text>}
        {event.time && <Text style={styles.eventDate}>Time: {event.time}</Text>}
      </View>
      <View style={styles.eventActions}>
        <TouchableOpacity 
          style={styles.editButton} 
          onPress={() => onEdit(event)}
        >
          <Text style={styles.editButtonText}>Edit</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={styles.deleteButton} 
          onPress={() => onDelete(event.id)}
        >
          <Text style={styles.deleteButtonText}>Delete</Text>
        </TouchableOpacity>
      </View>
    </View>
  ));
  const onDateChange = (event, selected) => {
    setShowDatePicker(false);
    if (selected) {
      const iso = selected.toISOString().split('T')[0];
      setEventDate(iso);
    }
  };
  const onTimeChange = (event, selected) => {
    setShowTimePicker(false);
    if (selected) {
      const hours = selected.getHours().toString().padStart(2, '0');
      const minutes = selected.getMinutes().toString().padStart(2, '0');
      setEventTime(`${hours}:${minutes}`);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView>
        {/* Calendar Box */}
        <View style={styles.box}>
          <Calendar
            markedDates={markedDates}
            onDayPress={day => setSelectedDate(day.dateString)}
          />
        </View>

        {/* Panchang Box */}
        <View style={styles.box}>
          <Text style={styles.boxTitle}>Panchang for {selectedDate}</Text>
          {usingDefaultLocation && (
            <Text style={{ color: '#b36b00', marginBottom: 4 }}>
              Using default location: Delhi
            </Text>
          )}
          {locationError && !usingDefaultLocation && (
            <Text style={{ color: 'red' }}>Location error: {locationError}</Text>
          )}
          {panchangLoading ? (
            <Text>Loading Panchang...</Text>
          ) : panchang ? (
            <>
              <Text>Tithi: {panchang.Tithi?.name_en_IN}</Text>
              <Text>Paksha: {panchang.Paksha?.name_en_IN}</Text>
              <Text>Nakshatra: {panchang.Nakshatra?.name_en_IN}</Text>
              <Text>Yoga: {panchang.Yoga?.name_en_IN}</Text>
              <Text>Karna: {panchang.Karna?.name_en_IN}</Text>
              <Text>Masa: {panchang.Masa?.name_en_UK}</Text>
              <Text>Raasi: {panchang.Raasi?.name_en_UK}</Text>
              <Text>Ritu: {panchang.Ritu?.name_en_UK}</Text>
            </>
          ) : (
            <Text>No Panchang data available.</Text>
          )}
        </View>

        {/* Today's Events Box */}
        <View style={styles.box}>
          <View style={styles.boxHeader}>
            <Text style={styles.boxTitle}>
              {selectedDate === today ? "Today's Events" : `Events on ${selectedDate}`}
            </Text>
            <TouchableOpacity 
              style={styles.addButton} 
              onPress={openAddEventModal}
            >
              <Text style={styles.addButtonText}>+ Add</Text>
            </TouchableOpacity>
          </View>
          {selectedDateEvents.length === 0 ? (
            <Text style={styles.noEventText}>No events for this day.</Text>
          ) : (
            selectedDateEvents.map((event) => (
              <EventItem
                key={event.id}
                event={event}
                onEdit={openEditEventModal}
                onDelete={deleteEvent}
              />
            ))
          )}
        </View>

        {/* Upcoming Events Box */}
        <View style={styles.box}>
          <Text style={styles.boxTitle}>Upcoming Events</Text>
          {upcomingEvents.length === 0 ? (
            <Text style={styles.noEventText}>No upcoming events.</Text>
          ) : (
            upcomingEvents.map((event) => (
              <EventItem
                key={event.id}
                event={event}
                onEdit={openEditEventModal}
                onDelete={deleteEvent}
              />
            ))
          )}
        </View>
      </ScrollView>

      {/* Add/Edit Event Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>
              {editingEvent ? 'Edit Event' : 'Add New Event'}
            </Text>
            <Text style={styles.inputLabel}>Event Title</Text>
            <TextInput
              style={styles.textInput}
              value={eventTitle}
              onChangeText={setEventTitle}
              placeholder="Enter event title"
              placeholderTextColor="#999"
            />
            <Text style={styles.inputLabel}>Date</Text>
            <TouchableOpacity
              style={styles.textInput}
              onPress={() => setShowDatePicker(true)}
            >
              <Text style={{color: eventDate ? '#333' : '#999'}}>
                {eventDate || 'Select date'}
              </Text>
            </TouchableOpacity>
            {showDatePicker && (
              <DateTimePicker
                value={eventDate ? new Date(eventDate) : new Date()}
                mode="date"
                display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                onChange={onDateChange}
              />
            )}
            <Text style={styles.inputLabel}>Time</Text>
            <TouchableOpacity
              style={styles.textInput}
              onPress={() => setShowTimePicker(true)}
            >
              <Text style={{color: eventTime ? '#333' : '#999'}}>
                {eventTime || 'Select time'}
              </Text>
            </TouchableOpacity>
            {showTimePicker && (
              <DateTimePicker
                value={
                  eventTime
                    ? new Date(`1970-01-01T${eventTime}:00`)
                    : new Date()
                }
                mode="time"
                display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                onChange={onTimeChange}
                is24Hour={true}
              />
            )}
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => setModalVisible(false)}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={styles.saveButton} 
                onPress={saveEvent}
              >
                <Text style={styles.saveButtonText}>
                  {editingEvent ? 'Update' : 'Save'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  box: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    margin: 16,
    elevation: 4,
  },
  boxHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  boxTitle: { fontSize: 18, fontWeight: 'bold', color: '#333' },
  addButton: {
    backgroundColor: '#00adf5',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  addButtonText: { color: 'white', fontWeight: 'bold', fontSize: 14 },
  eventItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  eventText: { fontSize: 16, color: '#333', flex: 1 },
  eventDate: { fontSize: 14, color: '#666', marginTop: 2 },
  eventActions: { flexDirection: 'row', gap: 8 },
  editButton: {
    backgroundColor: '#50cebb',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  editButtonText: { color: 'white', fontSize: 12, fontWeight: 'bold' },
  deleteButton: {
    backgroundColor: '#ff6b6b',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  deleteButtonText: { color: 'white', fontSize: 12, fontWeight: 'bold' },
  noEventText: {
    fontSize: 16,
    fontStyle: 'italic',
    color: '#888',
    textAlign: 'center',
    paddingVertical: 20,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 20,
    width: '85%',
    maxWidth: 400,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
    color: '#333',
  },
  inputLabel: { fontSize: 16, fontWeight: '600', marginBottom: 8, color: '#333' },
  textInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    fontSize: 16,
    color: '#333',
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  cancelButton: {
    flex: 1,
    backgroundColor: '#ddd',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelButtonText: { color: '#666', fontWeight: 'bold', fontSize: 16 },
  saveButton: {
    flex: 1,
    backgroundColor: '#00adf5',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  saveButtonText: { color: 'white', fontWeight: 'bold', fontSize: 16 },
});

export default App;
