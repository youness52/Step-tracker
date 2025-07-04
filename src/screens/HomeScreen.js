import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  StatusBar,
  Dimensions,
  TextInput,
  Alert,
  KeyboardAvoidingView,
  Platform,
  PermissionsAndroid,
  FlatList,
  Modal,
} from 'react-native';

import { Pedometer } from 'expo-sensors';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Svg, { Circle } from 'react-native-svg';

const STORAGE_KEY = 'step_history';
const GOAL_KEY = 'daily_goal';

const screenWidth = Dimensions.get('window').width;
const size = screenWidth * 0.6;
const strokeWidth = 15;
const radius = (size - strokeWidth) / 2;
const circumference = 2 * Math.PI * radius;
const STEP_LENGTH_METERS = 0.7;

export default function StepTrackerScreen() {
  const [steps, setSteps] = useState(0);
  const [dailyGoal, setDailyGoal] = useState(10000);
  const [history, setHistory] = useState([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [goalInput, setGoalInput] = useState('');
  const startOfDayRef = useRef(getStartOfDay());

  function getStartOfDay() {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), now.getDate());
  }

  useEffect(() => {
    async function loadData() {
      const now = new Date();
      startOfDayRef.current = getStartOfDay();
      const todayKey = startOfDayRef.current.toISOString().split('T')[0];

      try {
        const savedHistory = await AsyncStorage.getItem(STORAGE_KEY);
        if (savedHistory) {
          const parsedHistory = JSON.parse(savedHistory);
          setHistory(parsedHistory);
          const todayEntry = parsedHistory.find(entry => entry.date === todayKey);
          if (todayEntry) setSteps(todayEntry.steps);
        }

        const savedGoal = await AsyncStorage.getItem(GOAL_KEY);
        if (savedGoal) {
          const parsedGoal = parseInt(savedGoal, 10);
          if (!isNaN(parsedGoal) && parsedGoal > 0) {
            setDailyGoal(parsedGoal);
          }
        }
      } catch (e) {
        console.error('Failed to load data:', e);
      }
    }

    loadData();
  }, []);

  useEffect(() => {
    let subscription;

    const setupPedometer = async () => {
      const granted = await requestActivityPermission();
      if (!granted) return;

      const available = await Pedometer.isAvailableAsync();
      if (!available) return;

      const now = new Date();
      const startOfDay = getStartOfDay();
      startOfDayRef.current = startOfDay;

      try {
        const result = await Pedometer.getStepCountAsync(startOfDay, now);
        setSteps(result.steps);
        saveSteps(result.steps);
      } catch (err) {
        console.warn('Initial step fetch failed:', err);
      }

      subscription = Pedometer.watchStepCount(result => {
        setSteps(prev => {
          const updated = prev + result.steps;
          saveSteps(updated);
          return updated;
        });
      });
    };

    setupPedometer();

    return () => {
      if (subscription) subscription.remove();
    };
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      const now = new Date();
      if (now.getHours() === 0 && now.getMinutes() === 0 && now.getSeconds() < 10) {
        resetStepsAtMidnight();
      }
    }, 10000);
    return () => clearInterval(interval);
  }, [steps]);

  const resetStepsAtMidnight = async () => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayKey = yesterday.toISOString().split('T')[0];

    try {
      const saved = await AsyncStorage.getItem(STORAGE_KEY);
      let historyArray = saved ? JSON.parse(saved) : [];

      const yesterdayIndex = historyArray.findIndex(entry => entry.date === yesterdayKey);
      if (yesterdayIndex > -1) {
        historyArray[yesterdayIndex].steps = steps;
      } else {
        historyArray.push({ date: yesterdayKey, steps });
      }

      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(historyArray));
      setHistory(historyArray);

      const result = await Pedometer.getStepCountAsync(today, now);
      setSteps(result.steps);
      saveSteps(result.steps);
      startOfDayRef.current = today;
    } catch (err) {
      console.warn('Midnight reset/save failed:', err);
    }
  };

  async function saveSteps(currentSteps) {
    const todayKey = startOfDayRef.current.toISOString().split('T')[0];
    try {
      const saved = await AsyncStorage.getItem(STORAGE_KEY);
      let historyArray = saved ? JSON.parse(saved) : [];

      const todayIndex = historyArray.findIndex(entry => entry.date === todayKey);
      if (todayIndex > -1) {
        historyArray[todayIndex].steps = currentSteps;
      } else {
        historyArray.push({ date: todayKey, steps: currentSteps });
      }

      setHistory(historyArray);
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(historyArray));
    } catch (e) {
      console.error('Failed to save step history:', e);
    }
  }

  async function saveGoal(newGoal) {
    try {
      await AsyncStorage.setItem(GOAL_KEY, newGoal.toString());
    } catch (e) {
      console.error('Failed to save daily goal:', e);
    }
  }

  const onGoalSubmit = () => {
    const num = parseInt(goalInput, 10);
    if (isNaN(num) || num <= 0) {
      Alert.alert('Invalid input', 'Please enter a positive number.');
      setGoalInput('');
      return;
    }
    setDailyGoal(num);
    saveGoal(num);
    setGoalInput('');
    setModalVisible(false);
  };

  const progress = Math.min(steps / dailyGoal, 1);
  const strokeDashoffset = circumference * (1 - progress);
  const distanceKm = ((steps * STEP_LENGTH_METERS) / 1000).toFixed(2);

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor="#121212" />
      <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Text style={styles.title}>🏃 Step Tracker</Text>

        <View style={styles.card}>
          <View style={{ marginTop: 30, alignItems: 'center' }}>
            <Svg width={size} height={size}>
              <Circle stroke="#333" fill="none" cx={size / 2} cy={size / 2} r={radius} strokeWidth={strokeWidth} />
              <Circle
                stroke="#4CAF50"
                fill="none"
                cx={size / 2}
                cy={size / 2}
                r={radius}
                strokeWidth={strokeWidth}
                strokeDasharray={`${circumference} ${circumference}`}
                strokeDashoffset={strokeDashoffset}
                strokeLinecap="round"
                rotation="-90"
                origin={`${size / 2}, ${size / 2}`}
              />
            </Svg>
            <View style={styles.stepsLabel}>
              <Text style={styles.steps}>{steps}</Text>
              <Text style={styles.goal}> / {dailyGoal} steps</Text>
              <Text style={styles.distance}>{distanceKm} km</Text>
            </View>
            {steps >= dailyGoal && (
              <Text style={{ color: '#81C784', marginTop: 10, fontStyle: 'italic' }}>
                "Great job! Keep pushing your limits!"
              </Text>
            )}
          </View>

          <TouchableOpacity style={styles.setGoalButton} onPress={() => setModalVisible(true)}>
            <Text style={styles.setGoalButtonText}>Set Daily Goal</Text>
          </TouchableOpacity>

          <Text style={[styles.title, { marginTop: 40, fontSize: 20 }]}>📅 Step History</Text>
          {history.length === 0 ? (
            <Text style={styles.emptyText}>No history available yet.</Text>
          ) : (
            <FlatList
              style={{ width: '100%', marginTop: 10, maxHeight: 250 }}
              data={[...history].sort((a, b) => b.date.localeCompare(a.date))}
              keyExtractor={item => item.date}
              renderItem={({ item }) => (
                <View style={styles.historyItem}>
                  <Text style={styles.historyDate}>{item.date}</Text>
                  <Text style={styles.historySteps}>{item.steps} steps</Text>
                </View>
              )}
            />
          )}
        </View>

        <Modal visible={modalVisible} animationType="slide" transparent onRequestClose={() => setModalVisible(false)}>
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>Set Daily Step Goal</Text>
              <TextInput
                style={styles.goalInput}
                keyboardType="numeric"
                placeholder={`${dailyGoal}`}
                value={goalInput}
                onChangeText={setGoalInput}
                returnKeyType="done"
                maxLength={6}
                autoFocus
                onSubmitEditing={onGoalSubmit}
                placeholderTextColor="#777"
              />
              <View style={styles.modalButtons}>
                <TouchableOpacity style={[styles.modalButton, { backgroundColor: '#4CAF50' }]} onPress={onGoalSubmit}>
                  <Text style={styles.modalButtonText}>Save</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.modalButton, { backgroundColor: '#888' }]} onPress={() => setModalVisible(false)}>
                  <Text style={styles.modalButtonText}>Cancel</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

async function requestActivityPermission() {
  if (Platform.OS === 'android' && Platform.Version >= 29) {
    try {
      const result = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.ACTIVITY_RECOGNITION,
        {
          title: 'Physical Activity Permission',
          message: 'This app needs access to your physical activity to track steps.',
          buttonPositive: 'OK',
        }
      );
      return result === PermissionsAndroid.RESULTS.GRANTED;
    } catch (err) {
      console.warn('Permission error:', err);
      return false;
    }
  }
  return true;
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#121212' },
  container: { flex: 1, padding: 20, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 28, fontWeight: '700', color: '#eee', marginBottom: 40 },
  card: {
    width: '100%',
    backgroundColor: '#1e1e1e',
    borderRadius: 16,
    paddingVertical: 30,
    paddingHorizontal: 25,
    shadowColor: '#000',
    shadowOpacity: 0.8,
    shadowRadius: 15,
    elevation: 7,
    alignItems: 'center',
  },
  stepsLabel: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
    width: size,
    height: size,
  },
  steps: { fontSize: 48, fontWeight: '900', color: '#4CAF50' },
  goal: { fontSize: 18, color: '#4CAF50', fontWeight: '600' },
  distance: { fontSize: 20, color: '#81C784', fontWeight: '600', marginTop: 6 },
  setGoalButton: {
    marginTop: 30,
    backgroundColor: '#4CAF50',
    paddingVertical: 14,
    paddingHorizontal: 40,
    borderRadius: 12,
    shadowColor: '#4CAF50',
    shadowOpacity: 0.7,
    shadowRadius: 10,
    elevation: 6,
  },
  setGoalButtonText: { color: '#121212', fontWeight: '700', fontSize: 16 },
  historyItem: {
    backgroundColor: '#2c2c2c',
    padding: 14,
    borderRadius: 12,
    marginVertical: 6,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  historyDate: { fontSize: 16, color: '#eee' },
  historySteps: { fontSize: 16, fontWeight: '700', color: '#4CAF50' },
  emptyText: { fontSize: 16, color: '#777', marginTop: 10, fontStyle: 'italic', textAlign: 'center' },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(18, 18, 18, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  modalContent: {
    backgroundColor: '#1e1e1e',
    borderRadius: 20,
    width: '100%',
    padding: 30,
    alignItems: 'center',
  },
  modalTitle: { fontSize: 20, fontWeight: '700', color: '#eee', marginBottom: 20 },
  goalInput: {
    backgroundColor: '#333',
    width: '60%',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 15,
    fontSize: 20,
    color: '#eee',
    textAlign: 'center',
    marginBottom: 30,
  },
  modalButtons: { flexDirection: 'row', justifyContent: 'space-around', width: '100%' },
  modalButton: { paddingVertical: 12, paddingHorizontal: 30, borderRadius: 12 },
  modalButtonText: { color: '#eee', fontWeight: '700', fontSize: 16 },
});
