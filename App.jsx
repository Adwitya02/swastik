import React, {
  useState, useReducer, useMemo, useEffect, useCallback, Fragment,
} from 'react';
import {
  SafeAreaView, ScrollView, View, Text, StyleSheet, TouchableOpacity,
  Modal, TextInput, Alert, Platform, PermissionsAndroid,
} from 'react-native';
import { Calendar } from 'react-native-calendars';
import AsyncStorage from '@react-native-async-storage/async-storage';
import DateTimePicker from '@react-native-community/datetimepicker';
import Geolocation from 'react-native-geolocation-service';
import moment from 'moment';
import { MhahPanchang } from 'mhah-panchang';

// JSON catalogues
import majorFestivalsCatalog from './data/major_festivals.json';
import culturalObservancesCatalog from './data/cultural_observances.json';
import regionalFestivalsCatalog from './data/regional_festivals.json';

/* ---------- CONSTANTS ---------- */
const STORAGE_KEY = 'USER_EVENTS';
const DEFAULT_LOCATION = { latitude: 28.6139, longitude: 77.2090 };

const FASTING_RULES = [
  // Each rule adds a `fastKey` so dots can be toggled later
  {
    name: 'Ekadashi',
    color: '#e807c7ff',
    fastKey: 'EKADASHI',
    matcher: p => p.Tithi?.name?.includes('Ekadashi'),
  },
  {
    name: 'Pradosh',
    color: '#FF8700',
    fastKey: 'PRADOSH',
    matcher: p => p.Tithi?.name?.includes('Trayodashi'),
  },
  {
    name: 'Shivratri',
    color: '#6B47DC',
    fastKey: 'SHIVRATRI',
    matcher: p =>
      p.Tithi?.name?.includes('Chaturdashi') &&
      p.Masa === 'Magha' &&
      p.Paksha === 'Krishna',
  },
];

const isValidLocation = loc =>
  !!loc &&
  typeof loc.latitude === 'number' &&
  typeof loc.longitude === 'number' &&
  Math.abs(loc.latitude) <= 90 &&
  Math.abs(loc.longitude) <= 180;

/* ---------- HELPERS ---------- */
const groupRegionalFestivals = () =>
  regionalFestivalsCatalog.reduce((acc, {
    state, festival_name, description, staticDate2025,
  }) => {
    if (!acc[state]) acc[state] = [];
    acc[state].push({
      name: festival_name,
      description,
      staticDate2025: staticDate2025 || '2025-01-01',
    });
    return acc;
  }, {});

const getStateFromCoords = async (lat, lon) => {
  // TODO: plug in your reverse-geocode API
  return null;
};

const getFastingMarkings = async (year, month, lat, lon) => {
  const panchang = new MhahPanchang();
  const days = moment({ year, month }).daysInMonth();
  const markings = {};

  for (let d = 1; d <= days; d += 1) {
    const date = moment({ year, month, day: d }).toDate();
    const data = panchang.calendar(date, lat, lon);

    FASTING_RULES.forEach(rule => {
      if (rule.matcher(data)) {
        const key = moment(date).format('YYYY-MM-DD');
        const entry = markings[key] || { marked: true, dots: [], fasts: [] };
        entry.dots.push({ color: rule.color });
        entry.fasts.push(rule.name);
        markings[key] = entry;
      }
    });
  }
  return markings;
};

const eventsReducer = (state, action) => {
  switch (action.type) {
    case 'add':     return [...state, action.payload];
    case 'update':  return state.map(e => (e.id === action.payload.id ? action.payload : e));
    case 'delete':  return state.filter(e => e.id !== action.payload);
    case 'set':     return action.payload || [];
    default:        return state;
  }
};

/* ---------- MAIN COMPONENT ---------- */
export default function App() {
  /* ----- STATE ----- */
  const [events, dispatchEvents] = useReducer(eventsReducer, []);
  const [selectedDate, setSelectedDate] = useState(moment().format('YYYY-MM-DD'));
  const [location, setLocation] = useState(null);
  const [usingDefaultLocation, setUsingDefaultLocation] = useState(false);

  const [fastingDots, setFastingDots] = useState({});
  const [panchang, setPanchang] = useState(null);
  const [panchangLoading, setPanchangLoading] = useState(false);

  const [modalVisible, setModalVisible] = useState(false);
  const [editingEvent, setEditingEvent] = useState(null);
  const [form, setForm] = useState({ title: '', date: '', time: '' });

  const [userState, setUserState] = useState('Kerala');

  /* ----- CONSTANT MEMOS ----- */
  const regionalFestivalsMap = useMemo(groupRegionalFestivals, []);
  const today = useMemo(() => moment().format('YYYY-MM-DD'), []);

  /* ---------- LOCATION EFFECT ---------- */
  useEffect(() => {
    const askPermission = async () => {
      if (Platform.OS === 'android') {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
        );
        return granted === PermissionsAndroid.RESULTS.GRANTED;
      }
      return true;
    };

    const fetchLocation = async () => {
      const ok = await askPermission();
      if (!ok) {
        setUsingDefaultLocation(true);
        return;
      }
      Geolocation.getCurrentPosition(
        pos => {
          setLocation(pos.coords);
          setUsingDefaultLocation(false);
        },
        () => setUsingDefaultLocation(true),
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 10000 },
      );
    };
    fetchLocation();
  }, []);

  /* Reverse-geocode once we have coords */
  useEffect(() => {
    (async () => {
      if (!location) return;
      const st = await getStateFromCoords(location.latitude, location.longitude);
      if (st) setUserState(st);
    })();
  }, [location]);

  /* ---------- STORAGE SYNC ---------- */
  useEffect(() => {
    (async () => {
      const stored = await AsyncStorage.getItem(STORAGE_KEY);
      if (stored) dispatchEvents({ type: 'set', payload: JSON.parse(stored) });
    })();
  }, []);

  useEffect(() => {
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(events));
  }, [events]);

  /* ---------- STATIC CATALOG MEMOS ---------- */
  const majorFestivals = useMemo(
    () =>
      majorFestivalsCatalog.map(f => ({
        id: `major-${f.name}`,
        title: f.name,
        description: f.description,
        date: f.staticDate2025 || '2025-01-01',
      })),
    [],
  );

  const regionalFestivals = useMemo(() => {
    const region = regionalFestivalsMap[userState] || [];
    return region.map(f => ({
      id: `regional-${f.name}`,
      title: f.name,
      description: f.description,
      date: f.staticDate2025 || '2025-01-01',
    }));
  }, [userState, regionalFestivalsMap]);

  const allEvents = useMemo(
    () => [...events, ...majorFestivals, ...regionalFestivals],
    [events, majorFestivals, regionalFestivals],
  );

  /* ---------- FILTERED DATA MEMOS ---------- */
  const selectedEvents = useMemo(
    () => allEvents.filter(e => e.date === selectedDate),
    [allEvents, selectedDate],
  );

  const upcomingEvents = useMemo(
    () =>
      allEvents
        .filter(e => e.date > today)
        .sort((a, b) => a.date.localeCompare(b.date))
        .slice(0, 5),
    [allEvents, today],
  );

  const culturalToday = useMemo(
    () => culturalObservancesCatalog.filter(o => o.date === selectedDate),
    [selectedDate],
  );

  const upcomingCultural = useMemo(
    () =>
      culturalObservancesCatalog
        .filter(o => o.date > today)
        .sort((a, b) => a.date.localeCompare(b.date))
        .slice(0, 5),
    [today],
  );

  /* ---------- PANCHANG & FASTING ---------- */
  const fetchPanchangForDate = useCallback(async (dateStr, loc) => {
    setPanchangLoading(true);
    try {
      const data = new MhahPanchang().calendar(
        new Date(dateStr),
        loc.latitude,
        loc.longitude,
      );
      setPanchang(data);
    } catch {
      setPanchang(null);
    } finally {
      setPanchangLoading(false);
    }
  }, []);

  /* Run every time date or location changes */
  useEffect(() => {
    const loc = isValidLocation(location) ? location : DEFAULT_LOCATION;
    fetchPanchangForDate(selectedDate, loc);
  }, [location, selectedDate, fetchPanchangForDate]);

  /* Month-level fasting dots */
  useEffect(() => {
    (async () => {
      const d = moment(selectedDate);
      const loc = isValidLocation(location) ? location : DEFAULT_LOCATION;
      const dots = await getFastingMarkings(
        d.year(),
        d.month(),
        loc.latitude,
        loc.longitude,
      );
      setFastingDots(dots);
    })();
  }, [location, selectedDate]);

  /* ---------- CALENDAR MARKINGS ---------- */
  const markedDates = useMemo(() => {
    const marks = { ...fastingDots };
    allEvents.forEach(ev => {
      const base = marks[ev.date] || { marked: true, dots: [] };
      base.dots.push({ color: '#50cebb' }); // event dot
      marks[ev.date] = base;
    });
    marks[selectedDate] = { ...(marks[selectedDate] || {}), selected: true };
    return marks;
  }, [fastingDots, allEvents, selectedDate]);

  /* ---------- CRUD HELPERS ---------- */
  const openAddModal = () => {
    setEditingEvent(null);
    setForm({ title: '', date: selectedDate, time: '12:00' });
    setModalVisible(true);
  };

  const openEditModal = ev => {
    setEditingEvent(ev);
    setForm({ title: ev.title, date: ev.date, time: ev.time || '12:00' });
    setModalVisible(true);
  };

  const saveEvent = () => {
    const { title, date, time } = form;
    if (!title.trim()) return Alert.alert('Title required');
    const payload = { id: editingEvent?.id || Date.now().toString(), title, date, time };
    dispatchEvents({ type: editingEvent ? 'update' : 'add', payload });
    setModalVisible(false);
  };

  const deleteEvent = id =>
    Alert.alert('Delete?', 'Confirm delete?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => dispatchEvents({ type: 'delete', payload: id }),
      },
    ]);

  /* ---------- RENDER ---------- */
  return (
    <SafeAreaView style={styles.container}>
      <ScrollView>
        {/* CALENDAR */}
        <View style={styles.box}>
          <Calendar
            markedDates={markedDates}
            markingType="multi-dot"
            onDayPress={day => setSelectedDate(day.dateString)}
          />
          <View style={styles.legend}>
            {FASTING_RULES.map(r => (
              <LegendDot key={r.name} label={r.name} color={r.color} />
            ))}
            <LegendDot label="Event / Festival" color="#50cebb" />
          </View>
        </View>

        {/* PANCHANG */}
        <View style={styles.box}>
          <Text style={styles.boxTitle}>Panchang · {selectedDate}</Text>
          {usingDefaultLocation && (
            <Text style={styles.warn}>Using default location (Delhi)</Text>
          )}
          {panchangLoading && <Text>Loading…</Text>}
          {!panchangLoading && panchang && (
            <Fragment>
              <PItem label="Tithi" value={panchang.Tithi?.name_en_IN} />
              <PItem label="Paksha" value={panchang.Paksha?.name_en_IN} />
              <PItem label="Nakshatra" value={panchang.Nakshatra?.name_en_IN} />
              <PItem label="Yoga" value={panchang.Yoga?.name_en_IN} />
              <PItem label="Karna" value={panchang.Karna?.name_en_IN} />
              <PItem label="Masa" value={panchang.Masa?.name_en_UK} />
              <PItem label="Raasi" value={panchang.Raasi?.name_en_UK} />
              <PItem label="Ritu" value={panchang.Ritu?.name_en_UK} />
            </Fragment>
          )}
        </View>

        {/* CULTURAL OBSERVANCE: TODAY */}
        {culturalToday.length > 0 && (
          <View style={styles.box}>
            <Text style={styles.boxTitle}>Cultural Observances · {selectedDate}</Text>
            {culturalToday.map(o => (
              <View key={o.name} style={{ marginBottom: 8 }}>
                <Text style={{ fontWeight: 'bold', color: '#5e2d79' }}>{o.name}</Text>
                <Text style={{ color: '#555' }}>{o.description}</Text>
              </View>
            ))}
          </View>
        )}

        {/* EVENTS BOXES */}
        <EventsBox
          title={
            selectedDate === today
              ? "Today's Events"
              : `Events · ${selectedDate}`
          }
          events={selectedEvents}
          onAdd={openAddModal}
          onEdit={openEditModal}
          onDelete={deleteEvent}
        />

        <EventsBox
          title="Upcoming Events"
          events={upcomingEvents}
          hideAdd
          onEdit={openEditModal}
          onDelete={deleteEvent}
        />

        <CulturalBox
          title="Upcoming Cultural Observances"
          data={upcomingCultural}
        />
      </ScrollView>

      {/* MODAL */}
      <Modal visible={modalVisible} animationType="slide" transparent>
        <View style={styles.overlay}>
          <View style={styles.modal}>
            <Text style={styles.modalTitle}>
              {editingEvent ? 'Edit Event' : 'Add Event'}
            </Text>
            <Field
              label="Title"
              placeholder="Event name"
              value={form.title}
              onChangeText={v => setForm({ ...form, title: v })}
            />
            <DateTimeField
              label="Date"
              mode="date"
              value={form.date}
              onChange={v => setForm({ ...form, date: v })}
            />
            <DateTimeField
              label="Time"
              mode="time"
              value={form.time}
              onChange={v => setForm({ ...form, time: v })}
            />
            <View style={styles.row}>
              <ModalBtn text="Cancel" gray onPress={() => setModalVisible(false)} />
              <ModalBtn text="Save" onPress={saveEvent} />
              {editingEvent && (
                <ModalBtn
                  text="Delete"
                  red
                  onPress={() => {
                    setModalVisible(false);
                    deleteEvent(editingEvent.id);
                  }}
                />
              )}
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

/* ---------- SMALL COMPONENTS ---------- */
const LegendDot = ({ label, color }) => (
  <View style={styles.legendRow}>
    <View style={[styles.dot, { backgroundColor: color }]} />
    <Text style={styles.legendLabel}>{label}</Text>
  </View>
);

const PItem = ({ label, value }) => (
  <Text>
    {label}: <Text style={{ fontWeight: 'bold' }}>{value || '-'}</Text>
  </Text>
);

/* ---------- EVENTS BOXES ---------- */
const EventsBox = ({ title, events, onAdd, hideAdd, onEdit, onDelete }) => (
  <View style={styles.box}>
    <View style={styles.header}>
      <Text style={styles.boxTitle}>{title}</Text>
      {!hideAdd && (
        <TouchableOpacity style={styles.addBtn} onPress={onAdd}>
          <Text style={styles.addTxt}>＋</Text>
        </TouchableOpacity>
      )}
    </View>
    {events.length === 0 ? (
      <Text style={styles.empty}>No events</Text>
    ) : (
      events.map(ev => (
        <View key={ev.id} style={styles.eventRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.eventTitle}>{ev.title}</Text>
            <Text style={styles.eventSub}>{ev.date}</Text>
            {ev.time && <Text style={styles.eventSub}>⏰ {ev.time}</Text>}
            {ev.description && <Text style={styles.eventSub}>{ev.description}</Text>}
          </View>
          {!ev.id.startsWith('major-') && !ev.id.startsWith('regional-') && (
            <View style={{ flexDirection: 'row' }}>
              <TouchableOpacity
                style={styles.editRealBtn}
                onPress={() => onEdit(ev)}
              >
                <Text style={styles.editRealTxt}>Edit</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.deleteRealBtn}
                onPress={() => onDelete(ev.id)}
              >
                <Text style={styles.deleteRealTxt}>Delete</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      ))
    )}
  </View>
);

const CulturalBox = ({ title, data }) => (
  <View style={styles.box}>
    <Text style={styles.boxTitle}>{title}</Text>
    {data.length === 0 ? (
      <Text style={styles.empty}>—</Text>
    ) : (
      data.map(o => (
        <View key={o.name} style={{ marginBottom: 8 }}>
          <Text style={{ fontWeight: 'bold' }}>{o.name} · {o.date}</Text>
          <Text style={{ color: '#555' }}>{o.description}</Text>
        </View>
      ))
    )}
  </View>
);

const Field = ({ label, ...props }) => (
  <Fragment>
    <Text style={styles.label}>{label}</Text>
    <TextInput style={styles.input} {...props} />
  </Fragment>
);

const DateTimeField = ({ label, mode, value, onChange }) => {
  const [show, setShow] = useState(false);
  return (
    <Fragment>
      <Text style={styles.label}>{label}</Text>
      <TouchableOpacity style={styles.input} onPress={() => setShow(true)}>
        <Text>{value}</Text>
      </TouchableOpacity>
      {show && (
        <DateTimePicker
          value={
            mode === 'date'
              ? new Date(value)
              : new Date(`1970-01-01T${value}:00`)
          }
          mode={mode}
          is24Hour
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={(_, selected) => {
            setShow(false);
            if (!selected) return;
            onChange(
              mode === 'date'
                ? moment(selected).format('YYYY-MM-DD')
                : moment(selected).format('HH:mm'),
            );
          }}
        />
      )}
    </Fragment>
  );
};

const ModalBtn = ({ text, gray, red, ...props }) => (
  <TouchableOpacity
    style={[
      styles.modalBtn,
      gray && { backgroundColor: '#ccc' },
      red && { backgroundColor: '#ff6b6b' },
    ]}
    {...props}>
    <Text style={styles.modalBtnTxt}>{text}</Text>
  </TouchableOpacity>
);
/* ---------- STYLES ---------- */
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  box: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginHorizontal: 16,
    marginVertical: 8,
    elevation: 3,
  },
  boxTitle: { fontSize: 18, fontWeight: 'bold', color: '#333' },
  legend: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 8 },
  legendRow: { flexDirection: 'row', alignItems: 'center', marginRight: 12 },
  dot: { width: 10, height: 10, borderRadius: 5, marginRight: 4 },
  legendLabel: { fontSize: 13, color: '#444' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  addBtn: {
    backgroundColor: '#00adf5',
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  addTxt: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  empty: { textAlign: 'center', color: '#888', marginVertical: 12 },
  eventRow: { flexDirection: 'row', alignItems: 'center', marginVertical: 6 },
  eventTitle: { fontSize: 16, fontWeight: '600' },
  eventSub: { fontSize: 13, color: '#666' },
  editRealBtn: {
    backgroundColor: '#50ce61ff',
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 4,
    marginHorizontal: 2,
  },
  editRealTxt: { color: '#fff', fontSize: 15, fontWeight: 'bold' },
  deleteRealBtn: {
    backgroundColor: '#ff6b6b',
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 4,
    marginHorizontal: 2,
  },
  deleteRealTxt: { color: '#fff', fontSize: 15, fontWeight: 'bold' },
  warn: { color: '#b36b00', marginBottom: 4 },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modal: { backgroundColor: '#fff', borderRadius: 12, padding: 20, width: '85%' },
  modalTitle: { fontSize: 20, fontWeight: 'bold', marginBottom: 16, textAlign: 'center' },
  label: { fontSize: 15, fontWeight: '600', marginTop: 6 },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 10,
    marginTop: 4,
    fontSize: 16,
  },
  row: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 18 },
  modalBtn: { flex: 1, borderRadius: 8, padding: 12, marginHorizontal: 4, alignItems: 'center' },
  modalBtnTxt: { color: '#fff', fontWeight: 'bold' },
});
