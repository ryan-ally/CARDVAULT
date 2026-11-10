import * as ImagePicker from 'expo-image-picker';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useAuth } from '../../context/auth-context';
import { supabase } from '../../lib/supabase';

type InventoryCard = {
  id: string;
  name: string;
  set_name: string;
  card_number: string;
  price: number;
  image: string;
  condition: string;
  category: 'Vintage' | 'Modern';
  quantity: number;
  description: string;
  owner_id: string;
};

const CONDITIONS = [
  'Near Mint',
  'Lightly Played',
  'Moderately Played',
  'Heavily Played',
  'Damaged',
];

export default function SellScreen() {
  const { session, loading: authLoading } = useAuth();

  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [setNumber, setSetNumber] = useState('');
  const [condition, setCondition] = useState('Near Mint');
  const [category, setCategory] = useState<'Vintage' | 'Modern'>('Modern');
  const [quantity, setQuantity] = useState('1');
  const [description, setDescription] = useState('');
  const [image, setImage] = useState<string | null>(null);

  const [listings, setListings] = useState<InventoryCard[]>([]);
  const [loadingListings, setLoadingListings] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const loadListings = useCallback(async () => {
    if (!session?.user.id) {
      setListings([]);
      setLoadingListings(false);
      return;
    }

    setLoadingListings(true);

    const { data, error } = await supabase
      .from('inventory')
      .select('*')
      .eq('owner_id', session.user.id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Could not load inventory:', error.message);
      Alert.alert('Could not load listings', error.message);
    } else {
      setListings((data ?? []) as InventoryCard[]);
    }

    setLoadingListings(false);
  }, [session?.user.id]);

  useFocusEffect(
    useCallback(() => {
      if (!authLoading) {
        loadListings();
      }
    }, [authLoading, loadListings])
  );

  const choosePhoto = async () => {
    const permission =
      await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permission.granted) {
      Alert.alert(
        'Photo permission needed',
        'Allow photo access to add pictures of your cards.'
      );
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [4, 5],
      quality: 0.8,
    });

    if (!result.canceled) {
      setImage(result.assets[0].uri);
    }
  };

  const resetForm = () => {
    setName('');
    setPrice('');
    setSetNumber('');
    setCondition('Near Mint');
    setCategory('Modern');
    setQuantity('1');
    setDescription('');
    setImage(null);
    setEditingId(null);
  };

  const addOrUpdateListing = async () => {
    if (!session?.user.id) {
      Alert.alert('Sign in required', 'Sign in before managing inventory.');
      return;
    }

    if (!name.trim() || !price.trim() || !setNumber.trim()) {
      Alert.alert(
        'Missing information',
        'Enter the card name, price, and set/card number.'
      );
      return;
    }

    const numericPrice = Number(price);
    const numericQuantity = Number(quantity);

    if (!Number.isFinite(numericPrice) || numericPrice <= 0) {
      Alert.alert('Invalid price', 'Enter a price greater than zero.');
      return;
    }

    if (
      !Number.isInteger(numericQuantity) ||
      numericQuantity < 0
    ) {
      Alert.alert('Invalid quantity', 'Enter a whole number of 0 or more.');
      return;
    }

    setSaving(true);

    const values = {
      name: name.trim(),
      set_name: setNumber.trim(),
      card_number: setNumber.trim(),
      price: numericPrice,
      image: image ?? '',
      condition,
      category,
      quantity: numericQuantity,
      description: description.trim(),
      owner_id: session.user.id,
      updated_at: new Date().toISOString(),
    };

    const result = editingId
      ? await supabase
          .from('inventory')
          .update(values)
          .eq('id', editingId)
          .eq('owner_id', session.user.id)
          .select()
          .single()
      : await supabase
          .from('inventory')
          .insert({
            ...values,
            id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
          })
          .select()
          .single();

    setSaving(false);

    if (result.error) {
      console.error('Could not save listing:', result.error.message);
      Alert.alert('Save failed', result.error.message);
      return;
    }

    resetForm();
    await loadListings();

    Alert.alert(
      editingId ? 'Listing updated' : 'Card listed',
      editingId
        ? 'Your changes were saved.'
        : 'Your card was saved to your inventory.'
    );
  };

  const editListing = (card: InventoryCard) => {
    setEditingId(card.id);
    setName(card.name);
    setPrice(String(card.price));
    setSetNumber(card.set_name);
    setCondition(card.condition);
    setCategory(card.category);
    setQuantity(String(card.quantity));
    setDescription(card.description ?? '');
    setImage(card.image || null);
  };

  const deleteListing = (card: InventoryCard) => {
    Alert.alert(
      'Delete listing?',
      `Remove ${card.name} from your inventory?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            const { error } = await supabase
              .from('inventory')
              .delete()
              .eq('id', card.id)
              .eq('owner_id', session?.user.id ?? '');

            if (error) {
              Alert.alert('Delete failed', error.message);
              return;
            }

            if (editingId === card.id) resetForm();
            await loadListings();
          },
        },
      ]
    );
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={styles.title}>Sell Your Cards</Text>
      <Text style={styles.subtitle}>
        Manage your CardVault inventory.
      </Text>

      {!session && !authLoading ? (
        <Text style={styles.emptyText}>
          Sign in to add and manage your inventory.
        </Text>
      ) : (
        <>
          <Pressable style={styles.photoButton} onPress={choosePhoto}>
            {image ? (
              <Image source={{ uri: image }} style={styles.preview} />
            ) : (
              <>
                <Text style={styles.camera}>＋</Text>
                <Text style={styles.photoText}>Add Card Photo</Text>
              </>
            )}
          </Pressable>

          <Text style={styles.label}>Card Name *</Text>
          <TextInput
            style={styles.input}
            placeholder="Charizard"
            placeholderTextColor="#888"
            value={name}
            onChangeText={setName}
          />

          <Text style={styles.label}>Price (USD) *</Text>
          <TextInput
            style={styles.input}
            placeholder="99.99"
            placeholderTextColor="#888"
            value={price}
            onChangeText={setPrice}
            keyboardType="decimal-pad"
          />

          <Text style={styles.label}>Set / Card Number *</Text>
          <TextInput
            style={styles.input}
            placeholder="Base Set 4/102"
            placeholderTextColor="#888"
            value={setNumber}
            onChangeText={setSetNumber}
          />

          <Text style={styles.label}>Category</Text>
          <View style={styles.conditions}>
            {(['Vintage', 'Modern'] as const).map((item) => (
              <Pressable
                key={item}
                onPress={() => setCategory(item)}
                style={[
                  styles.conditionButton,
                  category === item && styles.selectedCondition,
                ]}
              >
                <Text
                  style={[
                    styles.conditionText,
                    category === item && styles.selectedConditionText,
                  ]}
                >
                  {item}
                </Text>
              </Pressable>
            ))}
          </View>

          <Text style={styles.label}>Quantity in Stock</Text>
          <TextInput
            style={styles.input}
            placeholder="1"
            placeholderTextColor="#888"
            value={quantity}
            onChangeText={setQuantity}
            keyboardType="number-pad"
          />

          <Text style={styles.label}>Condition</Text>
          <View style={styles.conditions}>
            {CONDITIONS.map((item) => (
              <Pressable
                key={item}
                onPress={() => setCondition(item)}
                style={[
                  styles.conditionButton,
                  condition === item && styles.selectedCondition,
                ]}
              >
                <Text
                  style={[
                    styles.conditionText,
                    condition === item && styles.selectedConditionText,
                  ]}
                >
                  {item}
                </Text>
              </Pressable>
            ))}
          </View>

          <Text style={styles.label}>Description</Text>
          <TextInput
            style={[styles.input, styles.descriptionInput]}
            placeholder="Edition, card details, and any flaws..."
            placeholderTextColor="#888"
            value={description}
            onChangeText={setDescription}
            multiline
            textAlignVertical="top"
          />

          <Pressable
            style={[styles.listButton, saving && styles.disabledButton]}
            onPress={addOrUpdateListing}
            disabled={saving}
          >
            <Text style={styles.listButtonText}>
              {saving
                ? 'Saving...'
                : editingId
                  ? 'Save Changes'
                  : 'List Card for Sale'}
            </Text>
          </Pressable>

          {editingId && (
            <Pressable style={styles.cancelButton} onPress={resetForm}>
              <Text style={styles.cancelText}>Cancel Editing</Text>
            </Pressable>
          )}
        </>
      )}

      <Text style={styles.sectionTitle}>
        Your Listings ({listings.length})
      </Text>

      {loadingListings ? (
        <ActivityIndicator color="#A78BFA" size="large" />
      ) : listings.length === 0 ? (
        <Text style={styles.emptyText}>
          Your saved cards will appear here.
        </Text>
      ) : (
        listings.map((card) => (
          <View key={card.id} style={styles.card}>
            {card.image ? (
              <Image
                source={{ uri: card.image }}
                style={styles.cardImage}
              />
            ) : (
              <View style={styles.noImage}>
                <Text style={styles.noImageText}>No Photo</Text>
              </View>
            )}

            <View style={styles.cardInfo}>
              <Text style={styles.cardName}>{card.name}</Text>
              <Text style={styles.cardPrice}>
                ${Number(card.price).toFixed(2)}
              </Text>
              <Text style={styles.cardDetail}>{card.set_name}</Text>
              <Text style={styles.cardDetail}>{card.condition}</Text>
              <Text style={styles.cardDetail}>
                {card.category} · Stock: {card.quantity}
              </Text>
              {!!card.description && (
                <Text style={styles.cardDetail}>{card.description}</Text>
              )}

              <View style={styles.actions}>
                <Pressable
                  style={styles.editButton}
                  onPress={() => editListing(card)}
                >
                  <Text style={styles.actionText}>Edit</Text>
                </Pressable>
                <Pressable
                  style={styles.deleteButton}
                  onPress={() => deleteListing(card)}
                >
                  <Text style={styles.actionText}>Delete</Text>
                </Pressable>
              </View>
            </View>
          </View>
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#25243D' },
  content: { padding: 20, paddingBottom: 50 },
  title: {
    color: 'teal',
    fontSize: 30,
    fontWeight: 'bold',
    marginTop: 16,
  },
  subtitle: {
    color: 'white',
    fontSize: 15,
    marginTop: 6,
    marginBottom: 24,
  },
  photoButton: {
    height: 190,
    backgroundColor: 'white',
    borderWidth: 1,
    borderColor: 'blueviolet',
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
    overflow: 'hidden',
  },
  camera: { fontSize: 42, color: '#A78BFA' },
  photoText: { color: '#25243D', marginTop: 8, fontSize: 16 },
  preview: { width: '100%', height: '100%', resizeMode: 'contain' },
  label: {
    color: 'white',
    fontWeight: '600',
    fontSize: 14,
    marginBottom: 8,
    marginTop: 12,
  },
  input: {
    backgroundColor: 'white',
    borderColor: 'blueviolet',
    borderWidth: 1,
    borderRadius: 10,
    padding: 14,
    color: '#25243D',
    fontSize: 16,
  },
  conditions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  conditionButton: {
    borderWidth: 1,
    borderColor: 'blueviolet',
    borderRadius: 18,
    paddingVertical: 9,
    paddingHorizontal: 12,
  },
  selectedCondition: {
    backgroundColor: '#40305B',
    borderColor: '#A78BFA',
  },
  conditionText: { color: '#CCCCCC', fontSize: 12 },
  selectedConditionText: { color: 'white', fontWeight: 'bold' },
  descriptionInput: { minHeight: 100 },
  listButton: {
    backgroundColor: 'blueviolet',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 24,
  },
  disabledButton: { opacity: 0.6 },
  listButtonText: { color: 'white', fontSize: 16, fontWeight: 'bold' },
  cancelButton: { padding: 12, alignItems: 'center' },
  cancelText: { color: '#CCCCCC' },
  sectionTitle: {
    color: 'white',
    fontSize: 22,
    fontWeight: 'bold',
    marginTop: 32,
    marginBottom: 16,
  },
  emptyText: { color: '#BBBBBB', marginBottom: 20 },
  card: {
    flexDirection: 'row',
    backgroundColor: '#191923',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    gap: 12,
  },
  cardImage: {
    width: 90,
    height: 125,
    borderRadius: 8,
    resizeMode: 'contain',
    backgroundColor: 'white',
  },
  noImage: {
    width: 90,
    height: 125,
    borderRadius: 8,
    backgroundColor: '#292936',
    alignItems: 'center',
    justifyContent: 'center',
  },
  noImageText: { color: '#AAAAAA', fontSize: 12 },
  cardInfo: { flex: 1, gap: 5 },
  cardName: { color: 'white', fontSize: 17, fontWeight: 'bold' },
  cardPrice: { color: '#A78BFA', fontSize: 19, fontWeight: 'bold' },
  cardDetail: { color: '#BBBBBB', fontSize: 12 },
  actions: { flexDirection: 'row', gap: 8, marginTop: 8 },
  editButton: {
    backgroundColor: '#514078',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 14,
  },
  deleteButton: {
    backgroundColor: '#8B303B',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 14,
  },
  actionText: { color: 'white', fontWeight: 'bold' },
});
