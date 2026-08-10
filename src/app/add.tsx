import React, { useState } from 'react';
import { StyleSheet, View, Text, TextInput, TouchableOpacity, SafeAreaView, ScrollView, Platform } from 'react-native';
import { router } from 'expo-router';
import { collection, addDoc } from 'firebase/firestore';
import { db } from '../config/firebase';

export default function AddMemberScreen() {
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [type, setType] = useState('BJJ');
  
  const today = new Date();
  const [startDate, setStartDate] = useState(today.toISOString().split('T')[0]);
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    if (!firstName || !lastName) {
      alert('First and Last name are required!');
      return;
    }
    
    setIsSaving(true);
    try {
      // Automatically calculate end date to be 1 month later
      const start = new Date(startDate);
      const end = new Date(start);
      end.setMonth(end.getMonth() + 1);
      const endDate = end.toISOString().split('T')[0];

      // Save to Firebase Firestore
      await addDoc(collection(db, 'members'), {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: email.trim(),
        phone: phone.trim(),
        type,
        startDate,
        endDate
      });

      router.back();
    } catch (error) {
      console.error("Error adding document: ", error);
      alert('Error saving member. Make sure you are connected to the internet.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Text style={styles.backBtnText}>← Back to Dashboard</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Add New Member</Text>
        </View>

        <View style={styles.form}>
          <View style={styles.inputGroup}>
            <Text style={styles.label}>First Name</Text>
            <TextInput 
              style={styles.input} 
              placeholder="John" 
              placeholderTextColor="#52525b" 
              value={firstName} 
              onChangeText={setFirstName} 
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Last Name</Text>
            <TextInput 
              style={styles.input} 
              placeholder="Doe" 
              placeholderTextColor="#52525b" 
              value={lastName} 
              onChangeText={setLastName} 
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Email</Text>
            <TextInput 
              style={styles.input} 
              placeholder="john@example.com" 
              placeholderTextColor="#52525b" 
              keyboardType="email-address" 
              value={email} 
              onChangeText={setEmail} 
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Phone Number</Text>
            <TextInput 
              style={styles.input} 
              placeholder="555-0101" 
              placeholderTextColor="#52525b" 
              keyboardType="phone-pad" 
              value={phone} 
              onChangeText={setPhone} 
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Membership Type</Text>
            <View style={styles.typeSelector}>
              {['BJJ', 'Kickboxing', 'MMA', 'Armwrestling'].map(t => (
                <TouchableOpacity 
                  key={t} 
                  style={[styles.typeBtn, type === t && styles.typeBtnActive]}
                  onPress={() => setType(t)}
                >
                  <Text style={[styles.typeBtnText, type === t && styles.typeBtnTextActive]}>{t}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Start Date (YYYY-MM-DD)</Text>
            <TextInput 
              style={styles.input} 
              value={startDate} 
              onChangeText={setStartDate} 
              placeholderTextColor="#52525b" 
            />
            <Text style={styles.hint}>End date will be automatically set to 1 month later upon saving.</Text>
          </View>

          <TouchableOpacity 
            style={[styles.saveBtn, isSaving && styles.saveBtnDisabled]} 
            onPress={handleSave}
            disabled={isSaving}
          >
            <Text style={styles.saveBtnText}>{isSaving ? 'Saving to Database...' : 'Save Member'}</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#09090b' },
  scrollContent: { 
    padding: 24, 
    paddingTop: Platform.OS === 'web' ? 40 : 24, 
    maxWidth: 700, 
    width: '100%', 
    alignSelf: 'center' 
  },
  header: { marginBottom: 32 },
  backBtn: { marginBottom: 16 },
  backBtnText: { color: '#3b82f6', fontSize: 16, fontWeight: '600' },
  title: { fontSize: 32, fontWeight: '800', color: '#ffffff', letterSpacing: -1 },
  form: { gap: 24 },
  inputGroup: { gap: 8 },
  label: { color: '#a1a1aa', fontSize: 14, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  input: { 
    backgroundColor: '#18181b', 
    borderWidth: 1, 
    borderColor: '#27272a', 
    borderRadius: 12, 
    padding: 16, 
    color: '#f4f4f5', 
    fontSize: 16 
  },
  typeSelector: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  typeBtn: { 
    backgroundColor: '#18181b', 
    borderWidth: 1, 
    borderColor: '#27272a', 
    paddingVertical: 10, 
    paddingHorizontal: 16, 
    borderRadius: 20 
  },
  typeBtnActive: { backgroundColor: '#3b82f6', borderColor: '#3b82f6' },
  typeBtnText: { color: '#a1a1aa', fontWeight: '600' },
  typeBtnTextActive: { color: '#ffffff' },
  hint: { color: '#71717a', fontSize: 12, marginTop: 4 },
  saveBtn: { 
    backgroundColor: '#22c55e', 
    padding: 18, 
    borderRadius: 12, 
    alignItems: 'center', 
    marginTop: 16 
  },
  saveBtnDisabled: {
    backgroundColor: '#15803d',
    opacity: 0.7
  },
  saveBtnText: { color: '#ffffff', fontSize: 16, fontWeight: '700' }
});
