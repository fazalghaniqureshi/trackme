import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getDevices } from '../../services/traccarService';
import { createFuelEntry, getAllFuelEntries } from '../../services/fuelService';
import { createExpense, getAllExpenses } from '../../services/expenseService';
import { EXPENSE_CATEGORIES, formatCurrency } from '../../types/local';
import type { FuelEntry, ExpenseEntry, ExpenseCategory } from '../../types/local';
import type { TraccarDevice } from '../../types/traccar';
import { format } from 'date-fns';

type Tab = 'fuel' | 'expense';

export default function LogScreen() {
  const insets = useSafeAreaInsets();
  const [tab, setTab] = useState<Tab>('fuel');
  const [devices, setDevices] = useState<TraccarDevice[]>([]);
  const [selectedDevice, setSelectedDevice] = useState('');

  const [liters, setLiters] = useState('');
  const [costPerLiter, setCostPerLiter] = useState('');
  const [odometer, setOdometer] = useState('');
  const [fuelNotes, setFuelNotes] = useState('');
  const [recentFuel, setRecentFuel] = useState<FuelEntry[]>([]);

  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState<ExpenseCategory>('Toll');
  const [expenseNotes, setExpenseNotes] = useState('');
  const [recentExpenses, setRecentExpenses] = useState<ExpenseEntry[]>([]);

  useEffect(() => {
    (async () => {
      const devs = await getDevices();
      setDevices(devs);
      if (devs.length > 0) setSelectedDevice(String(devs[0].id));
      setRecentFuel((await getAllFuelEntries()).slice(0, 5));
      setRecentExpenses((await getAllExpenses()).slice(0, 5));
    })();
  }, []);

  const saveFuel = async () => {
    if (!liters || !costPerLiter || !odometer) { Alert.alert('Missing fields', 'Fill in liters, cost, and odometer.'); return; }
    await createFuelEntry({
      deviceId: selectedDevice,
      date: format(new Date(), 'yyyy-MM-dd'),
      liters: parseFloat(liters),
      costPerLiter: parseFloat(costPerLiter),
      odometer: parseFloat(odometer),
      notes: fuelNotes,
    });
    setLiters(''); setCostPerLiter(''); setOdometer(''); setFuelNotes('');
    setRecentFuel((await getAllFuelEntries()).slice(0, 5));
    Alert.alert('Saved', 'Fill-up logged.');
  };

  const saveExpense = async () => {
    if (!amount) { Alert.alert('Missing fields', 'Enter an amount.'); return; }
    await createExpense({
      deviceId: selectedDevice,
      date: format(new Date(), 'yyyy-MM-dd'),
      amount: parseFloat(amount),
      category,
      description: category,
      notes: expenseNotes,
    });
    setAmount(''); setExpenseNotes('');
    setRecentExpenses((await getAllExpenses()).slice(0, 5));
    Alert.alert('Saved', 'Expense logged.');
  };

  const totalCostPreview = liters && costPerLiter
    ? parseFloat(liters) * parseFloat(costPerLiter)
    : null;

  return (
    <ScrollView style={[styles.container, { paddingTop: insets.top }]} keyboardShouldPersistTaps="handled">
      <Text style={styles.title}>Log Entry</Text>

      <View style={styles.tabs}>
        <TouchableOpacity style={[styles.tab, tab === 'fuel' && styles.tabActive]} onPress={() => setTab('fuel')}>
          <Text style={[styles.tabTxt, tab === 'fuel' && styles.tabTxtActive]}>⛽ Fuel</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.tab, tab === 'expense' && styles.tabActive]} onPress={() => setTab('expense')}>
          <Text style={[styles.tabTxt, tab === 'expense' && styles.tabTxtActive]}>💰 Expense</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.label}>VEHICLE</Text>
      <View style={styles.deviceRow}>
        {devices.map((d) => (
          <TouchableOpacity
            key={d.id}
            style={[styles.deviceChip, selectedDevice === String(d.id) && styles.deviceChipActive]}
            onPress={() => setSelectedDevice(String(d.id))}
          >
            <Text style={[styles.deviceChipTxt, selectedDevice === String(d.id) && styles.deviceChipTxtActive]}>{d.name}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {tab === 'fuel' ? (
        <View style={styles.form}>
          <Text style={styles.label}>LITERS</Text>
          <TextInput style={styles.input} value={liters} onChangeText={setLiters} keyboardType="decimal-pad" placeholder="45.5" placeholderTextColor="#3d5470" />
          <Text style={styles.label}>COST PER LITER (Rs.)</Text>
          <TextInput style={styles.input} value={costPerLiter} onChangeText={setCostPerLiter} keyboardType="decimal-pad" placeholder="290.00" placeholderTextColor="#3d5470" />
          <Text style={styles.label}>ODOMETER (km)</Text>
          <TextInput style={styles.input} value={odometer} onChangeText={setOdometer} keyboardType="decimal-pad" placeholder="28450" placeholderTextColor="#3d5470" />
          <Text style={styles.label}>NOTES (optional)</Text>
          <TextInput style={styles.input} value={fuelNotes} onChangeText={setFuelNotes} placeholder="Petrol station name..." placeholderTextColor="#3d5470" />
          <TouchableOpacity style={styles.saveBtn} onPress={saveFuel}>
            <Text style={styles.saveTxt}>Save Fill-Up{totalCostPreview ? ` • ${formatCurrency(totalCostPreview)}` : ''}</Text>
          </TouchableOpacity>
          <Text style={styles.sectionHeader}>Recent Fill-Ups</Text>
          {recentFuel.map((e) => (
            <View key={e.id} style={styles.historyRow}>
              <Text style={styles.historyDate}>{e.date}</Text>
              <Text style={styles.historyValue}>{e.liters}L</Text>
              <Text style={styles.historyValue}>{formatCurrency(e.totalCost)}</Text>
            </View>
          ))}
        </View>
      ) : (
        <View style={styles.form}>
          <Text style={styles.label}>CATEGORY</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
            {EXPENSE_CATEGORIES.map((c) => (
              <TouchableOpacity key={c} style={[styles.catChip, category === c && styles.catChipActive]} onPress={() => setCategory(c)}>
                <Text style={[styles.catTxt, category === c && styles.catTxtActive]}>{c}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
          <Text style={styles.label}>AMOUNT (Rs.)</Text>
          <TextInput style={styles.input} value={amount} onChangeText={setAmount} keyboardType="decimal-pad" placeholder="500.00" placeholderTextColor="#3d5470" />
          <Text style={styles.label}>NOTES (optional)</Text>
          <TextInput style={styles.input} value={expenseNotes} onChangeText={setExpenseNotes} placeholder="Details..." placeholderTextColor="#3d5470" />
          <TouchableOpacity style={[styles.saveBtn, { backgroundColor: '#8b5cf6' }]} onPress={saveExpense}>
            <Text style={styles.saveTxt}>Save Expense{amount ? ` • ${formatCurrency(parseFloat(amount) || 0)}` : ''}</Text>
          </TouchableOpacity>
          <Text style={styles.sectionHeader}>Recent Expenses</Text>
          {recentExpenses.map((e) => (
            <View key={e.id} style={styles.historyRow}>
              <Text style={styles.historyDate}>{e.date}</Text>
              <Text style={styles.historyValue}>{e.category}</Text>
              <Text style={styles.historyValue}>{formatCurrency(e.amount)}</Text>
            </View>
          ))}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#080f1e' },
  title: { color: '#e2eaf6', fontSize: 24, fontWeight: '700', padding: 16, paddingBottom: 8 },
  tabs: { flexDirection: 'row', marginHorizontal: 16, backgroundColor: '#0f1b2d', borderRadius: 10, borderWidth: 1, borderColor: '#1e3050', marginBottom: 16, overflow: 'hidden' },
  tab: { flex: 1, padding: 12, alignItems: 'center' },
  tabActive: { backgroundColor: '#162236' },
  tabTxt: { color: '#7a93b4', fontSize: 14, fontWeight: '600' },
  tabTxtActive: { color: '#e2eaf6' },
  label: { color: '#7a93b4', fontSize: 11, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6, marginHorizontal: 16 },
  deviceRow: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 16, gap: 8, marginBottom: 16 },
  deviceChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, borderWidth: 1, borderColor: '#1e3050', backgroundColor: '#0f1b2d' },
  deviceChipActive: { borderColor: '#3b82f6', backgroundColor: '#162236' },
  deviceChipTxt: { color: '#7a93b4', fontSize: 13 },
  deviceChipTxtActive: { color: '#3b82f6', fontWeight: '600' },
  form: { paddingHorizontal: 16 },
  input: { backgroundColor: '#162236', borderWidth: 1, borderColor: '#1e3050', borderRadius: 8, padding: 14, color: '#e2eaf6', fontSize: 15, marginBottom: 16 },
  saveBtn: { backgroundColor: '#22c55e', borderRadius: 10, padding: 16, alignItems: 'center', marginBottom: 24 },
  saveTxt: { color: '#fff', fontSize: 15, fontWeight: '700' },
  sectionHeader: { color: '#7a93b4', fontSize: 12, fontWeight: '600', textTransform: 'uppercase', marginBottom: 8 },
  historyRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#162236' },
  historyDate: { color: '#7a93b4', fontSize: 12, flex: 1 },
  historyValue: { color: '#e2eaf6', fontSize: 13, marginLeft: 8 },
  catChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, borderWidth: 1, borderColor: '#1e3050', backgroundColor: '#0f1b2d', marginRight: 8 },
  catChipActive: { borderColor: '#8b5cf6', backgroundColor: 'rgba(139,92,246,0.15)' },
  catTxt: { color: '#7a93b4', fontSize: 13 },
  catTxtActive: { color: '#8b5cf6', fontWeight: '600' },
});
