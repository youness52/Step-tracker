import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, FlatList } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'step_history';

export default function HistoryScreen() {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadHistory() {
      try {
        const stored = await AsyncStorage.getItem(STORAGE_KEY);
        const parsed = stored ? JSON.parse(stored) : [];
        setHistory(parsed);
      } catch (err) {
        console.error('Failed to load step history', err);
      } finally {
        setLoading(false);
      }
    }
    loadHistory();
  }, []);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>📆 Daily Step History</Text>
      {loading ? (
        <ActivityIndicator size="large" color="#4CAF50" />
      ) : history.length === 0 ? (
        <Text style={styles.emptyText}>No step history available yet.</Text>
      ) : (
        <FlatList
          data={[...history].sort((a, b) => b.date.localeCompare(a.date))}
          keyExtractor={item => item.date}
          renderItem={({ item }) => (
            <View style={styles.item}>
              <Text style={styles.date}>{item.date}</Text>
              <Text style={styles.steps}>{item.steps} steps</Text>
            </View>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fc',
    padding: 20,
  },
  title: {
    fontSize: 22,
    fontWeight: '600',
    marginBottom: 20,
    textAlign: 'center',
    color: '#2c3e50',
  },
  emptyText: {
    textAlign: 'center',
    marginTop: 40,
    fontSize: 16,
    color: '#888',
  },
  item: {
    backgroundColor: '#fff',
    padding: 15,
    marginBottom: 12,
    borderRadius: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 5,
    elevation: 3,
  },
  date: {
    fontSize: 16,
    color: '#2c3e50',
  },
  steps: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#4CAF50',
  },
});
