import React, { useMemo, useState, useEffect } from 'react';
import { StyleSheet, View, Text, FlatList, SafeAreaView, Platform, TouchableOpacity, ActivityIndicator, TextInput } from 'react-native';
import { router } from 'expo-router';
import { collection, onSnapshot, query, doc, deleteDoc, getDocs, where } from 'firebase/firestore';
import { signInWithPopup, signOut, onAuthStateChanged, User } from 'firebase/auth';
import { db, auth, googleProvider } from '../config/firebase';
import { Swipeable } from 'react-native-gesture-handler';

const DISCIPLINES = [
  'BJJ',
  'BJJ Girls',
  'Kickboxing',
  'MMA',
  'Skandenberg',
  'Kids BJJ',
  'Kids Karate',
  'Kids Kickboxing',
  'Fitness',
];

const getMemberStatus = (endDateStr: string): 'active' | 'expiring' | 'expired' => {
  if (!endDateStr) return 'expired';
  const end = new Date(endDateStr);
  const now = new Date();
  const diffDays = Math.ceil((end.getTime() - now.getTime()) / (1000 * 3600 * 24));
  if (diffDays < 0) return 'expired';
  if (diffDays <= 3) return 'expiring';
  return 'active';
};

export default function ActiveMembersScreen() {
  const [members, setMembers] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchVisible, setIsSearchVisible] = useState(false);
  const [isFilterVisible, setIsFilterVisible] = useState(false);
  const [selectedDiscipline, setSelectedDiscipline] = useState<string>('ALL');
  const [selectedStatus, setSelectedStatus] = useState<'ALL' | 'active' | 'expiring' | 'expired'>('ALL');
  
  // Auth States
  const [user, setUser] = useState<User | null>(null);
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [authLoading, setAuthLoading] = useState(true);

  // Handle Authentication State & Allowlist Check
  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser && currentUser.email) {
        try {
          // Cross-reference their email with the allowedUsers database
          const q = query(collection(db, 'allowedUsers'), where("email", "==", currentUser.email));
          const querySnapshot = await getDocs(q);
          
          if (!querySnapshot.empty) {
            setIsAuthorized(true); // Email is on the allowlist!
          } else {
            setIsAuthorized(false); // Logged in, but NOT on the allowlist
            alert("Access Denied: You do not have administrative privileges.");
            await signOut(auth); // Immediately kick them out
          }
        } catch (error: any) {
          console.error("Error checking authorization:", error);
          setIsAuthorized(false);
          await signOut(auth);
        }
      } else {
        setIsAuthorized(false); // Not logged in at all
      }
      setAuthLoading(false);
    });

    return () => unsubscribeAuth();
  }, []);

  // Fetch Member Data ONLY if Authorized
  useEffect(() => {
    if (!isAuthorized) {
      setMembers([]); // Clear any lingering data if guest
      return;
    }
    
    setLoading(true);
    const q = query(collection(db, 'members'));
    const unsubscribeData = onSnapshot(q, (querySnapshot) => {
      const membersData: any[] = [];
      querySnapshot.forEach((document) => {
        membersData.push({ id: document.id, ...document.data() });
      });
      setMembers(membersData);
      setLoading(false);
    }, (error) => {
      console.error("Error fetching members: ", error);
      setLoading(false);
    });

    return () => unsubscribeData();
  }, [isAuthorized]);

  // Sort members alphabetically
  const sortedMembers = useMemo(() => {
    return [...members].sort((a, b) => {
      const last = (a.lastName || '').localeCompare(b.lastName || '');
      if (last !== 0) return last;
      return (a.firstName || '').localeCompare(b.firstName || '');
    });
  }, [members]);

  const hasActiveFilters = selectedDiscipline !== 'ALL' || selectedStatus !== 'ALL';

  const handleResetFilters = () => {
    setSelectedDiscipline('ALL');
    setSelectedStatus('ALL');
  };

  // Filter sorted members by search query, status, and discipline
  const filteredMembers = useMemo(() => {
    return sortedMembers.filter(m => {
      // 1. Search Query Filter (matches first or last name)
      if (searchQuery.trim()) {
        const queryLower = searchQuery.toLowerCase().trim();
        const matchesLast = (m.lastName || '').toLowerCase().includes(queryLower);
        const matchesFirst = (m.firstName || '').toLowerCase().includes(queryLower);
        if (!matchesLast && !matchesFirst) return false;
      }

      // 2. Subscription Status Filter
      if (selectedStatus !== 'ALL') {
        const status = getMemberStatus(m.endDate);
        if (status !== selectedStatus) return false;
      }

      // 3. Discipline Filter
      if (selectedDiscipline !== 'ALL') {
        const rawTypes: string[] = Array.isArray(m.type) ? m.type : (m.type ? [m.type] : []);
        // Map Armwrestling to Skandenberg for backward compatibility
        const memberTypes = rawTypes.map((t: string) => t === 'Armwrestling' ? 'Skandenberg' : t);
        if (!memberTypes.includes(selectedDiscipline)) return false;
      }

      return true;
    });
  }, [sortedMembers, searchQuery, selectedDiscipline, selectedStatus]);

  const handleLogin = async () => {
    if (Platform.OS === 'web') {
      try {
        await signInWithPopup(auth, googleProvider);
      } catch (error: any) {
        console.error("Login failed:", error);
      }
    } else {
      alert("Native Google Login will be implemented in Phase 4!");
    }
  };

  const handleLogout = async () => {
    await signOut(auth);
  };

  const getStatusColor = (endDateStr: string) => {
    const status = getMemberStatus(endDateStr);
    if (status === 'expired') return '#ef4444'; // Red
    if (status === 'expiring') return '#eab308'; // Yellow
    return '#22c55e'; // Green
  };

  const handleDelete = async (id: string) => {
    if (!isAuthorized) return;
    try {
      await deleteDoc(doc(db, 'members', id));
      setDeleteConfirmId(null);
    } catch (error) {
      console.error("Error removing member: ", error);
      alert('Error removing member.');
    }
  };

  const renderLeftActions = (item: any) => {
    if (!isAuthorized) return null; // Safety check
    return (
      <View style={styles.actionContainer}>
        <TouchableOpacity 
          style={styles.editBtn} 
          onPress={() => router.push({ pathname: '/edit/[id]', params: item })}
        >
          <Text style={styles.actionBtnText}>Edit</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.deleteBtn} onPress={() => setDeleteConfirmId(item.id)}>
          <Text style={styles.actionBtnText}>Remove</Text>
        </TouchableOpacity>
      </View>
    );
  };

  const renderItem = ({ item }: { item: any }) => {
    const statusColor = getStatusColor(item.endDate);
    const rawMemberTypes = Array.isArray(item.type) ? item.type : (item.type ? [item.type] : []);
    const memberTypes = rawMemberTypes.map((t: string) => t === 'Armwrestling' ? 'Skandenberg' : t);
    
    return (
      <Swipeable renderLeftActions={() => renderLeftActions(item)}>
        <View style={[styles.card, { borderLeftColor: statusColor }]}>
          <View style={styles.cardHeader}>
            <Text style={styles.name}>{item.lastName}, {item.firstName}</Text>
            <View style={styles.badgeContainer}>
              {memberTypes.map((t: string) => (
                <View key={t} style={[styles.badge, { backgroundColor: statusColor + '20' }]}>
                  <Text style={[styles.badgeText, { color: statusColor }]}>{t}</Text>
                </View>
              ))}
            </View>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoText}>✉️ {item.email || 'N/A'}</Text>
            <Text style={styles.infoText}>📱 {item.phone || 'N/A'}</Text>
          </View>
          <View style={styles.dateRow}>
            <Text style={styles.dateText}>Start: {item.startDate}</Text>
            <Text style={styles.dateText}>End: {item.endDate}</Text>
          </View>
        </View>
      </Swipeable>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.mobileConstraint}>
        
        {/* Auth Top Bar */}
        <View style={styles.authHeader}>
          {authLoading ? (
            <ActivityIndicator size="small" color="#3b82f6" />
          ) : user && isAuthorized ? (
            <>
              <Text style={styles.welcomeText}>Admin: {user.email}</Text>
              <TouchableOpacity onPress={handleLogout} style={styles.authBtn}>
                <Text style={styles.authBtnText}>Logout</Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              <Text style={styles.welcomeText}>Guest Mode</Text>
              <TouchableOpacity onPress={handleLogin} style={styles.authBtnGoogle}>
                <Text style={styles.authBtnText}>Login with Google</Text>
              </TouchableOpacity>
            </>
          )}
        </View>

        <View style={styles.header}>
          <View style={styles.titleContainer}>
            <Text style={styles.title}>Active Members</Text>
            <Text style={styles.subtitle}>
              Dashboard - {searchQuery.trim() || hasActiveFilters ? `${filteredMembers.length} of ${members.length}` : `${members.length}`} Members
            </Text>
          </View>
          
          {/* Only show Add + Search + Filter buttons if Authorized */}
          {isAuthorized && (
            <View style={styles.headerButtons}>
              <TouchableOpacity 
                style={styles.addBtn}
                onPress={() => router.push('/add')}
              >
                <Text style={styles.addBtnText}>+ Add</Text>
              </TouchableOpacity>
              <View style={styles.actionButtonsRow}>
                <TouchableOpacity 
                  style={[styles.searchBtn, isSearchVisible && styles.searchBtnActive]}
                  onPress={() => {
                    setIsSearchVisible(!isSearchVisible);
                    if (isSearchVisible) setSearchQuery('');
                  }}
                >
                  <Text style={styles.searchBtnText}>{isSearchVisible ? '✕ Search' : '🔍 Search'}</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={[styles.filterBtn, (isFilterVisible || hasActiveFilters) && styles.filterBtnActive]}
                  onPress={() => setIsFilterVisible(!isFilterVisible)}
                >
                  <Text style={styles.filterBtnText}>
                    {isFilterVisible ? '✕ Filter' : hasActiveFilters ? '🌪️ Filter (ON)' : '🌪️ Filter'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>

        {/* Search Input - visible only when toggled */}
        {isAuthorized && isSearchVisible && (
          <View style={styles.searchContainer}>
            <TextInput
              style={styles.searchInput}
              placeholder="Search by first or last name..."
              placeholderTextColor="#52525b"
              value={searchQuery}
              onChangeText={setSearchQuery}
              autoFocus
              clearButtonMode="while-editing"
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity style={styles.clearBtn} onPress={() => setSearchQuery('')}>
                <Text style={styles.clearBtnText}>✕</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* Filter Panel - visible only when toggled */}
        {isAuthorized && isFilterVisible && (
          <View style={styles.filterCard}>
            <View style={styles.filterCardHeader}>
              <Text style={styles.filterCardTitle}>Filter Members</Text>
              {hasActiveFilters && (
                <TouchableOpacity onPress={handleResetFilters} style={styles.resetFiltersBtn}>
                  <Text style={styles.resetFiltersText}>Reset All</Text>
                </TouchableOpacity>
              )}
            </View>

            {/* Subscription Status Section */}
            <View style={styles.filterSection}>
              <Text style={styles.filterSectionLabel}>SUBSCRIPTION STATUS</Text>
              <View style={styles.chipsRow}>
                {[
                  { key: 'ALL', label: 'All' },
                  { key: 'active', label: '🟢 Active' },
                  { key: 'expiring', label: '🟡 Expiring Soon' },
                  { key: 'expired', label: '🔴 Expired' },
                ].map(item => {
                  const isSelected = selectedStatus === item.key;
                  return (
                    <TouchableOpacity
                      key={item.key}
                      style={[styles.filterChip, isSelected && styles.filterChipActive]}
                      onPress={() => setSelectedStatus(item.key as any)}
                    >
                      <Text style={[styles.filterChipText, isSelected && styles.filterChipTextActive]}>
                        {item.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* Discipline Section */}
            <View style={styles.filterSection}>
              <Text style={styles.filterSectionLabel}>DISCIPLINE</Text>
              <View style={styles.chipsRow}>
                {['ALL', ...DISCIPLINES].map(disc => {
                  const isSelected = selectedDiscipline === disc;
                  return (
                    <TouchableOpacity
                      key={disc}
                      style={[styles.filterChip, isSelected && styles.filterChipActive]}
                      onPress={() => setSelectedDiscipline(disc)}
                    >
                      <Text style={[styles.filterChipText, isSelected && styles.filterChipTextActive]}>
                        {disc === 'ALL' ? 'All' : disc}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          </View>
        )}
        
        {/* Dynamic List Rendering based on Auth State */}
        {!isAuthorized ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>Read-Only Guest Mode</Text>
            <Text style={styles.emptySubtext}>Click 'Login with Google' at the top to securely view and manage gym members.</Text>
          </View>
        ) : loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#3b82f6" />
            <Text style={styles.loadingText}>Loading database...</Text>
          </View>
        ) : filteredMembers.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>
              {searchQuery.trim() || hasActiveFilters ? 'No matching members' : 'No members yet!'}
            </Text>
            <Text style={styles.emptySubtext}>
              {searchQuery.trim() || hasActiveFilters
                ? 'Try adjusting your search query or active filters.'
                : 'Click the + Add button to start building your gym roster.'}
            </Text>
            {(searchQuery.trim() || hasActiveFilters) && (
              <TouchableOpacity
                style={styles.clearSearchFilterBtn}
                onPress={() => {
                  setSearchQuery('');
                  handleResetFilters();
                }}
              >
                <Text style={styles.clearSearchFilterText}>Clear Filters & Search</Text>
              </TouchableOpacity>
            )}
          </View>
        ) : (
          <FlatList
            data={filteredMembers}
            keyExtractor={item => item.id}
            renderItem={renderItem}
            contentContainerStyle={styles.listContent}
          />
        )}

        {/* Custom Delete Confirmation Modal */}
        {deleteConfirmId && (
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>SIGUR???</Text>
              <View style={styles.modalButtons}>
                <TouchableOpacity style={styles.modalCancelBtn} onPress={() => setDeleteConfirmId(null)}>
                  <Text style={styles.modalBtnText}>NU AM APASAT GRESIT</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.modalConfirmBtn} onPress={() => handleDelete(deleteConfirmId)}>
                  <Text style={styles.modalBtnText}>DA NORMAL</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#09090b',
  },
  mobileConstraint: {
    flex: 1,
    maxWidth: 700, 
    width: '100%',
    alignSelf: 'center',
  },
  authHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#27272a',
  },
  welcomeText: {
    color: '#a1a1aa',
    fontSize: 14,
    fontWeight: '500',
  },
  authBtn: {
    backgroundColor: '#27272a',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  authBtnGoogle: {
    backgroundColor: '#3b82f6',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  authBtnText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700',
  },
  header: {
    padding: 24,
    paddingTop: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  titleContainer: {
    flex: 1,
    marginRight: 12,
  },
  title: {
    fontSize: 32,
    fontWeight: '800',
    color: '#ffffff',
    letterSpacing: -1,
  },
  subtitle: {
    fontSize: 16,
    color: '#a1a1aa',
    marginTop: 4,
  },
  addBtn: {
    backgroundColor: '#22c55e',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
    alignSelf: 'stretch',
    alignItems: 'center',
  },
  addBtnText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 16,
  },
  headerButtons: {
    flexDirection: 'column',
    gap: 8,
    alignItems: 'flex-end',
  },
  actionButtonsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  searchBtn: {
    backgroundColor: '#27272a',
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchBtnActive: {
    backgroundColor: '#3f3f46',
    borderWidth: 1,
    borderColor: '#3b82f6',
  },
  searchBtnText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 13,
  },
  filterBtn: {
    backgroundColor: '#27272a',
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterBtnActive: {
    backgroundColor: '#3f3f46',
    borderWidth: 1,
    borderColor: '#3b82f6',
  },
  filterBtnText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 13,
  },
  filterCard: {
    backgroundColor: '#18181b',
    borderWidth: 1,
    borderColor: '#27272a',
    borderRadius: 16,
    marginHorizontal: 16,
    marginBottom: 12,
    padding: 16,
    gap: 16,
  },
  filterCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  filterCardTitle: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
  resetFiltersBtn: {
    backgroundColor: '#27272a',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#3f3f46',
  },
  resetFiltersText: {
    color: '#ef4444',
    fontSize: 12,
    fontWeight: '700',
  },
  filterSection: {
    gap: 8,
  },
  filterSectionLabel: {
    color: '#71717a',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  filterChip: {
    backgroundColor: '#27272a',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#27272a',
  },
  filterChipActive: {
    backgroundColor: '#3b82f6',
    borderColor: '#3b82f6',
  },
  filterChipText: {
    color: '#a1a1aa',
    fontSize: 13,
    fontWeight: '600',
  },
  filterChipTextActive: {
    color: '#ffffff',
    fontWeight: '700',
  },
  clearSearchFilterBtn: {
    marginTop: 16,
    backgroundColor: '#27272a',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#3f3f46',
  },
  clearSearchFilterText: {
    color: '#3b82f6',
    fontWeight: '700',
    fontSize: 14,
  },
  searchContainer: {
    marginHorizontal: 16,
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  searchInput: {
    flex: 1,
    backgroundColor: '#18181b',
    borderWidth: 1,
    borderColor: '#3b82f6',
    borderRadius: 12,
    padding: 14,
    color: '#f4f4f5',
    fontSize: 16,
  },
  clearBtn: {
    backgroundColor: '#27272a',
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  clearBtnText: {
    color: '#a1a1aa',
    fontSize: 14,
    fontWeight: '700',
  },
  listContent: {
    padding: 16,
    gap: 16,
    paddingBottom: 40,
  },
  card: {
    backgroundColor: '#18181b',
    borderRadius: 16,
    padding: 20,
    borderLeftWidth: 6,
    borderWidth: 1,
    borderColor: '#27272a',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  name: {
    fontSize: 22,
    fontWeight: '700',
    color: '#f4f4f5',
    flex: 1,
  },
  badgeContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    justifyContent: 'flex-end',
    maxWidth: '50%',
  },
  badge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  infoText: {
    color: '#a1a1aa',
    fontSize: 14,
    fontWeight: '500',
  },
  dateRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#27272a',
  },
  dateText: {
    color: '#71717a',
    fontSize: 13,
    fontWeight: '700',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#a1a1aa',
    marginTop: 16,
    fontSize: 16,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
    marginTop: 20,
  },
  emptyText: {
    color: '#f4f4f5',
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 8,
  },
  emptySubtext: {
    color: '#a1a1aa',
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 24,
  },
  actionContainer: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  editBtn: {
    backgroundColor: '#3b82f6',
    justifyContent: 'center',
    alignItems: 'center',
    width: 80,
    borderTopLeftRadius: 16,
    borderBottomLeftRadius: 16,
  },
  deleteBtn: {
    backgroundColor: '#ef4444',
    justifyContent: 'center',
    alignItems: 'center',
    width: 80,
    borderTopRightRadius: 16,
    borderBottomRightRadius: 16,
  },
  actionBtnText: {
    color: '#ffffff',
    fontWeight: '800',
    fontSize: 14,
    textAlign: 'center',
  },
  modalOverlay: {
    position: 'absolute',
    top: 0, bottom: 0, left: 0, right: 0,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
    padding: 24,
  },
  modalContent: {
    backgroundColor: '#18181b',
    padding: 32,
    borderRadius: 24,
    width: '100%',
    maxWidth: 400,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#27272a',
  },
  modalTitle: {
    fontSize: 28,
    fontWeight: '900',
    color: '#ef4444',
    marginBottom: 32,
  },
  modalButtons: {
    flexDirection: 'column',
    width: '100%',
    gap: 16,
  },
  modalConfirmBtn: {
    backgroundColor: '#ef4444',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  modalCancelBtn: {
    backgroundColor: '#3f3f46',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  modalBtnText: {
    color: '#ffffff',
    fontWeight: '800',
    fontSize: 16,
  }
});
