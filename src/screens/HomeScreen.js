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

const STEP_LENGTH_METERS = 0.7; // average step length in meters

export default function StepTrackerScreen({ navigation }) {
  const [isAvailable, setIsAvailable] = useState('checking...');
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

  useEffect(() => {
    Pedometer.isAvailableAsync().then(
      result => setIsAvailable(result ? 'Yes' : 'No'),
      error => setIsAvailable('Error: ' + error)
    );

    const subscription = Pedometer.watchStepCount(result => {
      const currentStartOfDay = getStartOfDay();

      if (currentStartOfDay > startOfDayRef.current) {
        startOfDayRef.current = currentStartOfDay;
        setSteps(result.steps);
        saveSteps(result.steps);
      } else {
        setSteps(result.steps);
        saveSteps(result.steps);
      }
    });

    return () => subscription.remove();
  }, []);

  const onGoalSubmit = () => {
    const num = parseInt(goalInput, 10);
    if (isNaN(num) || num <= 0) {
      Alert.alert('Invalid input', 'Please enter a positive number for your daily goal.');
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
  const distanceMeters = steps * STEP_LENGTH_METERS;
  const distanceKm = (distanceMeters / 1000).toFixed(2);

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor="#121212" />
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <Text style={styles.title}>🏃 Step Tracker</Text>

        <View style={styles.card}>
          <View style={{ marginTop: 30, alignItems: 'center', justifyContent: 'center' }}>
            <Svg width={size} height={size}>
              <Circle
                stroke="#333"
                fill="none"
                cx={size / 2}
                cy={size / 2}
                r={radius}
                strokeWidth={strokeWidth}
              />
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
          </View>

          <TouchableOpacity
            style={styles.setGoalButton}
            onPress={() => setModalVisible(true)}
            activeOpacity={0.8}
          >
            <Text style={styles.setGoalButtonText}>Set Daily Goal</Text>
          </TouchableOpacity>

          {/* History Section */}
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

        {/* Modal for setting daily goal */}
        <Modal
          visible={modalVisible}
          animationType="slide"
          transparent
          onRequestClose={() => setModalVisible(false)}
        >
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
                <TouchableOpacity
                  style={[styles.modalButton, { backgroundColor: '#4CAF50' }]}
                  onPress={onGoalSubmit}
                >
                  <Text style={styles.modalButtonText}>Save</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalButton, { backgroundColor: '#888' }]}
                  onPress={() => setModalVisible(false)}
                >
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

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#121212',
  },
  container: {
    flex: 1,
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#eee',
    marginBottom: 40,
  },
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
  steps: {
    fontSize: 48,
    fontWeight: '900',
    color: '#4CAF50',
  },
  goal: {
    fontSize: 18,
    color: '#4CAF50',
    fontWeight: '600',
  },
  distance: {
    fontSize: 20,
    color: '#81C784',
    fontWeight: '600',
    marginTop: 6,
  },
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
  setGoalButtonText: {
    color: '#121212',
    fontWeight: '700',
    fontSize: 16,
  },
  historyItem: {
    backgroundColor: '#2c2c2c',
    padding: 14,
    borderRadius: 12,
    marginVertical: 6,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  historyDate: {
    fontSize: 16,
    color: '#eee',
  },
  historySteps: {
    fontSize: 16,
    fontWeight: '700',
    color: '#4CAF50',
  },
  emptyText: {
    fontSize: 16,
    color: '#777',
    marginTop: 10,
    fontStyle: 'italic',
    textAlign: 'center',
  },
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
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#eee',
    marginBottom: 20,
  },
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
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
  },
  modalButton: {
    paddingVertical: 12,
    paddingHorizontal: 30,
    borderRadius: 12,
  },
  modalButtonText: {
    color: '#eee',
    fontWeight: '700',
    fontSize: 16,
  },
});
