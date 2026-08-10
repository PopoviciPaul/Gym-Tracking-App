import React, { useState } from 'react';
import { StyleSheet, View, Text, TextInput, TouchableOpacity, SafeAreaView, ScrollView, Platform } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../../config/firebase';

export default function EditMemberScreen() {
  const params = useLocalSearchParams();
  
  // Extract initial values from the router params
  const id = params.id as string;
  
  const [firstName, setFirstName] = useState((params.firstName as string) || '');
  const [lastName, setLastName] = useState((params.lastName as string) || '');
  const [email, setEmail] = useState((params.email as string) || '');
  const [phone, setPhone] = useState((params.phone as string) || '');
  
  // Safe extraction of type parameter which could be a string or an array of strings
  const parseTypes = (t: any): string[] => {
    if (!t) return ['BJJ'];
    if (Array.isArray(t)) return t;
    if (typeof t === 'string') {
      if (t.includes(',')) return t.split(',').map(s => s.trim());
      return [t];
    }
    return ['BJJ'];
  };
  const [types, setTypes] = useState<string[]>(parseTypes(params.type));
  
  const [startDate, setStartDate] = useState((params.startDate as string) || '');
  const [endDate, setEndDate] = useState((params.endDate as string) || '');
  
  const [isSaving, setIsSaving] = useState(false);

  const handleStartDateChange = (newDate: string) => {
    setStartDate(newDate);
    const start = new Date(newDate);
    if (!isNaN(start.getTime())) {
      const end = new Date(start);
      end.setMonth(end.getMonth() + 1);
      setEndDate(end.toISOString().split('T')[0]);
    }
  };

  const handleSave = async () => {
    if (!firstName || !lastName) {
      alert('First and Last name are required!');
      return;
    }
    if (types.length === 0) {
      alert('Please select at least one membership discipline!');
      return;
    }
    
    setIsSaving(true);
    try {
      // Update the existing document in Firebase Firestore
      const memberRef = doc(db, 'members', id);
      await updateDoc(memberRef, {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: email.trim(),
        phone: phone.trim(),
        type: types, // Saving as an array but keeping the key 'type' for backward compatibility
        startDate,
        endDate
      });

      router.back();
    } catch (error) {
      console.error("Error updating document: ", error);
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
          <Text style={styles.title}>Edit Member</Text>
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
            <Text style={styles.label}>Membership Disciplines (Select Multiple)</Text>
            <View style={styles.typeSelector}>
              {['BJJ', 'Kickboxing', 'MMA', 'Armwrestling', 'Kids BJJ', 'Kids Karate'].map(t => {
                const isSelected = types.includes(t);
                return (
                  <TouchableOpacity 
                    key={t} 
                    style={[styles.typeBtn, isSelected && styles.typeBtnActive]}
                    onPress={() => {
                      if (isSelected) {
                        setTypes(types.filter(type => type !== t));
                      } else {
                        setTypes([...types, t]);
                      }
                    }}
                  >
                    <Text style={[styles.typeBtnText, isSelected && styles.typeBtnTextActive]}>{t}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Start Date</Text>
            {Platform.OS === 'web' ? (
              // @ts-ignore - Using native HTML input for Web PWA native calendar wheel
              <input 
                type="date"
                value={startDate}
                onChange={(e: any) => handleStartDateChange(e.target.value)}
                style={{ backgroundColor: '#18181b', border: '1px solid #27272a', borderRadius: '12px', padding: '16px', color: '#f4f4f5', fontSize: '16px', width: '100%', boxSizing: 'border-box', fontFamily: 'inherit' }}
              />
            ) : (
              <TextInput style={styles.input} value={startDate} onChangeText={handleStartDateChange} />
            )}
            <Text style={styles.hint}>End date automatically recalculates to 1 month later.</Text>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>End Date (Manual Override)</Text>
            {Platform.OS === 'web' ? (
              // @ts-ignore
              <input 
                type="date"
                value={endDate}
                onChange={(e: any) => setEndDate(e.target.value)}
                style={{ backgroundColor: '#18181b', border: '1px solid #27272a', borderRadius: '12px', padding: '16px', color: '#f4f4f5', fontSize: '16px', width: '100%', boxSizing: 'border-box', fontFamily: 'inherit' }}
              />
            ) : (
              <TextInput style={styles.input} value={endDate} onChangeText={setEndDate} />
            )}
            <Text style={styles.hint}>Edit this if the member purchased a longer membership.</Text>
          </View>

          <TouchableOpacity 
            style={[styles.saveBtn, isSaving && styles.saveBtnDisabled]} 
            onPress={handleSave}
            disabled={isSaving}
          >
            <Text style={styles.saveBtnText}>{isSaving ? 'Saving Changes...' : 'Save Changes'}</Text>
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
    backgroundColor: '#3b82f6', // Changed to blue to match edit button
    padding: 18, 
    borderRadius: 12, 
    alignItems: 'center', 
    marginTop: 16 
  },
  saveBtnDisabled: {
    backgroundColor: '#1d4ed8',
    opacity: 0.7
  },
  saveBtnText: { color: '#ffffff', fontSize: 16, fontWeight: '700' }
});
