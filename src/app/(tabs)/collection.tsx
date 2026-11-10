import * as ImagePicker from 'expo-image-picker';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Modal,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { supabase } from '../../lib/supabase';

type CollectionItem = {
  id: string;
  card_name: string;
  set_name: string | null;
  card_number: string | null;
  condition: string | null;
  quantity: number;
  estimated_value: number;
  image_url: string | null;
  rarity: string | null;
  card_type: string | null;
  edition: string | null;
  market_price: number | null;
  market_price_updated_at: string | null;
};

const RARITIES = [
  'All',
  'Common',
  'Uncommon',
  'Rare',
  'Rare Holo',
  'Ultra Rare',
  'Illustration Rare',
  'Special Illustration Rare',
  'Secret Rare',
  'Promo',
  'Other',
];

const CARD_TYPES = [
  'All',
  'Pokémon',
  'Trainer',
  'Energy',
];

const EDITIONS = [
  'All',
  '1st Edition',
  'Shadowless',
  'Unlimited',
  'Promo',
  'Other',
];

const CONDITIONS = [
  'Near Mint',
  'Lightly Played',
  'Moderately Played',
  'Heavily Played',
  'Damaged',
];

const formatMoney = (amount: number | null | undefined) =>
  `$${Number(amount ?? 0).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

export default function CollectionScreen() {
  const [items, setItems] = useState<CollectionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [checkingPrice, setCheckingPrice] = useState(false);

  const [selectedCard, setSelectedCard] =
    useState<CollectionItem | null>(null);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);

  const [cardName, setCardName] = useState('');
  const [setName, setSetName] = useState('');
  const [cardNumber, setCardNumber] = useState('');
  const [condition, setCondition] = useState('Near Mint');
  const [quantity, setQuantity] = useState('1');
  const [estimatedValue, setEstimatedValue] = useState('');
  const [rarity, setRarity] = useState('Rare');
  const [cardType, setCardType] = useState('Pokémon');
  const [edition, setEdition] = useState('Unlimited');
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [existingImageUrl, setExistingImageUrl] =
    useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [rarityFilter, setRarityFilter] = useState('All');
  const [typeFilter, setTypeFilter] = useState('All');
  const [editionFilter, setEditionFilter] = useState('All');

  const [sortByValue, setSortByValue] = useState(false);

  const loadCollection = useCallback(async () => {
    setLoading(true);

    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError) {
        throw userError;
      }

      if (!user) {
        setItems([]);
        return;
      }

      const { data, error } = await supabase
        .from('collection_items')
        .select(
          'id, card_name, set_name, card_number, condition, quantity, estimated_value, image_url, rarity, card_type, edition, market_price, market_price_updated_at'
        )
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) {
        throw error;
      }

      const loadedItems = (data ?? []) as CollectionItem[];

      const itemsWithImages = await Promise.all(
        loadedItems.map(async (item) => {
          if (!item.image_url) {
            return item;
          }

          // Stored images are expected to be paths in the
          // private "card-images" bucket.
          const { data: signedData, error: signedError } =
            await supabase.storage
              .from('card-images')
              .createSignedUrl(item.image_url, 60 * 60);

          if (signedError || !signedData?.signedUrl) {
            return item;
          }

          return {
            ...item,
            image_url: signedData.signedUrl,
          };
        })
      );

      setItems(itemsWithImages);
    } catch (error: any) {
      Alert.alert(
        'Could not load collection',
        error?.message ?? 'Please try again.'
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadCollection();
    }, [loadCollection])
  );

  const resetForm = () => {
    setEditingId(null);
    setCardName('');
    setSetName('');
    setCardNumber('');
    setCondition('Near Mint');
    setQuantity('1');
    setEstimatedValue('');
    setRarity('Rare');
    setCardType('Pokémon');
    setEdition('Unlimited');
    setImageUri(null);
    setExistingImageUrl(null);
  };

  const openAddForm = () => {
    resetForm();
    setSelectedCard(null);
    setShowForm(true);
  };

  const startEditing = (item: CollectionItem) => {
    setEditingId(item.id);
    setCardName(item.card_name);
    setSetName(item.set_name ?? '');
    setCardNumber(item.card_number ?? '');
    setCondition(item.condition ?? 'Near Mint');
    setQuantity(String(item.quantity ?? 1));
    setEstimatedValue(String(item.estimated_value ?? 0));
    setRarity(item.rarity ?? 'Rare');
    setCardType(item.card_type ?? 'Pokémon');
    setEdition(item.edition ?? 'Unlimited');
    setImageUri(null);
    setExistingImageUrl(item.image_url);
    setSelectedCard(null);
    setShowForm(true);
  };

  const chooseImage = async () => {
    try {
      const permission =
        await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (!permission.granted) {
        Alert.alert(
          'Permission needed',
          'Allow photo-library access to add a card image.'
        );
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [3, 4],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]?.uri) {
        setImageUri(result.assets[0].uri);
      }
    } catch (error: any) {
      Alert.alert(
        'Image error',
        error?.message ?? 'Could not select that image.'
      );
    }
  };

  const uploadImage = async (
    uri: string,
    userId: string
  ): Promise<string> => {
    const response = await fetch(uri);
    const blob = await response.blob();

    const extension = uri.split('.').pop()?.split('?')[0] || 'jpg';
    const path = `${userId}/${Date.now()}.${extension}`;

    const { error } = await supabase.storage
      .from('card-images')
      .upload(path, blob, {
        contentType: blob.type || 'image/jpeg',
        upsert: false,
      });

    if (error) {
      throw error;
    }

    return path;
  };

  const saveCard = async () => {
    if (!cardName.trim()) {
      Alert.alert('Card name required', 'Enter the card name first.');
      return;
    }

    const parsedQuantity = Number.parseInt(quantity, 10);
    const parsedValue = Number.parseFloat(estimatedValue || '0');

    if (
      !Number.isFinite(parsedQuantity) ||
      parsedQuantity < 1
    ) {
      Alert.alert(
        'Invalid quantity',
        'Quantity must be at least 1.'
      );
      return;
    }

    if (!Number.isFinite(parsedValue) || parsedValue < 0) {
      Alert.alert(
        'Invalid value',
        'Estimated value must be zero or greater.'
      );
      return;
    }

    setSaving(true);

    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError) {
        throw userError;
      }

      if (!user) {
        Alert.alert(
          'Sign in required',
          'Sign in to save cards to your collection.'
        );
        return;
      }

      let storedImagePath = editingId
        ? items.find((item) => item.id === editingId)?.image_url ?? null
        : null;

      // When editing, keep the existing storage path unless
      // the user chooses a new photo.
      if (imageUri) {
        storedImagePath = await uploadImage(imageUri, user.id);
      }

      const cardData = {
        user_id: user.id,
        card_name: cardName.trim(),
        set_name: setName.trim() || null,
        card_number: cardNumber.trim() || null,
        condition,
        quantity: parsedQuantity,
        estimated_value: parsedValue,
        image_url: storedImagePath,
        rarity,
        card_type: cardType,
        edition,
        updated_at: new Date().toISOString(),
      };

      if (editingId) {
        const { error } = await supabase
          .from('collection_items')
          .update(cardData)
          .eq('id', editingId)
          .eq('user_id', user.id);

        if (error) {
          throw error;
        }
      } else {
        const { error } = await supabase
          .from('collection_items')
          .insert(cardData);

        if (error) {
          throw error;
        }
      }

      setShowForm(false);
      resetForm();
      await loadCollection();

      Alert.alert(
        'Saved',
        editingId ? 'Your card was updated.' : 'Your card was added.'
      );
    } catch (error: any) {
      Alert.alert(
        'Could not save card',
        error?.message ?? 'Please try again.'
      );
    } finally {
      setSaving(false);
    }
  };

  const removeCard = (item: CollectionItem) => {
    Alert.alert(
      'Remove card?',
      `Remove ${item.card_name} from your collection?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              const {
                data: { user },
              } = await supabase.auth.getUser();

              if (!user) {
                Alert.alert('Sign in required', 'Please sign in again.');
                return;
              }

              const { error } = await supabase
                .from('collection_items')
                .delete()
                .eq('id', item.id)
                .eq('user_id', user.id);

              if (error) {
                throw error;
              }

              setSelectedCard(null);
              await loadCollection();
            } catch (error: any) {
              Alert.alert(
                'Could not remove card',
                error?.message ?? 'Please try again.'
              );
            }
          },
        },
      ]
    );
  };

  const checkMarketPrice = async (item: CollectionItem) => {
    const backendUrl =
      process.env.EXPO_PUBLIC_BACKEND_URL?.replace(/\/$/, '');

    if (!backendUrl) {
      Alert.alert(
        'Backend not configured',
        'Set EXPO_PUBLIC_BACKEND_URL in your app .env file and restart Expo.'
      );
      return;
    }

    setCheckingPrice(true);

    try {
      const params = new URLSearchParams();
      params.append('q', item.card_name);

      if (item.set_name) {
        params.append('set', item.set_name);
      }

      if (item.card_number) {
        params.append('number', item.card_number);
      }

      const response = await fetch(
        `${backendUrl}/market-price?${params.toString()}`
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          result?.error ?? 'Market-price lookup failed.'
        );
      }

      const results = Array.isArray(result?.data)
        ? result.data
        : [];

      const match = results.find((candidate: any) => {
        const sameName =
          String(candidate.name ?? '').toLowerCase() ===
          item.card_name.toLowerCase();

        const sameSet =
          !item.set_name ||
          String(candidate.setName ?? '').toLowerCase() ===
          item.set_name.toLowerCase();

        const sameNumber =
          !item.card_number ||
          String(candidate.cardNumber ?? '').toLowerCase() ===
          item.card_number.toLowerCase();

        return sameName && sameSet && sameNumber;
      });

      if (
        !match ||
        match.marketPrice == null ||
        !Number.isFinite(Number(match.marketPrice))
      ) {
        Alert.alert(
          'No price found',
          'No matching market price was returned for this card.'
        );
        return;
      }

      const marketPrice = Number(match.marketPrice);

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        Alert.alert('Sign in required', 'Please sign in again.');
        return;
      }

      const updatedAt = new Date().toISOString();

      const { error } = await supabase
        .from('collection_items')
        .update({
          market_price: marketPrice,
          market_price_updated_at: updatedAt,
        })
        .eq('id', item.id)
        .eq('user_id', user.id);

      if (error) {
        throw error;
      }

      await loadCollection();

      setSelectedCard((current) =>
        current?.id === item.id
          ? {
            ...current,
            market_price: marketPrice,
            market_price_updated_at: updatedAt,
          }
          : current
      );

      Alert.alert(
        'Market price updated',
        `${item.card_name}: ${formatMoney(marketPrice)}`
      );
    } catch (error: any) {
      Alert.alert(
        'Price lookup failed',
        error?.message ??
        'Check that your backend and market-price endpoint are running.'
      );
    } finally {
      setCheckingPrice(false);
    }
  };

  const filteredItems = items
    .filter((item) => {
      const query = search.trim().toLowerCase();

      const matchesSearch =
        !query ||
        item.card_name.toLowerCase().includes(query) ||
        (item.set_name ?? '').toLowerCase().includes(query) ||
        (item.card_number ?? '').toLowerCase().includes(query);

      const matchesRarity =
        rarityFilter === 'All' || item.rarity === rarityFilter;

      const matchesType =
        typeFilter === 'All' || item.card_type === typeFilter;

      const matchesEdition =
        editionFilter === 'All' || item.edition === editionFilter;

      return (
        matchesSearch &&
        matchesRarity &&
        matchesType &&
        matchesEdition
      );
    })
    .sort((a, b) =>
      sortByValue
        ? b.estimated_value * b.quantity -
        a.estimated_value * a.quantity
        : 0
    );

  const totalValue = items.reduce(
    (total, item) =>
      total + Number(item.estimated_value || 0) * item.quantity,
    0
  );

  const totalCards = items.reduce(
    (total, item) => total + item.quantity,
    0
  );

  const topCards = [...items]
    .sort(
      (a, b) =>
        b.estimated_value * b.quantity -
        a.estimated_value * a.quantity
    )
    .slice(0, 5);

  const renderFilterButtons = (
    options: string[],
    selected: string,
    onSelect: (value: string) => void
  ) => (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator = { false}
  contentContainerStyle = { styles.filterRow }
    >
  {
    options.map((option) => (
      <Pressable
          key= { option }
          onPress = {() => onSelect(option)}
  style = {
    [
    styles.filterChip,
    selected === option && styles.filterChipSelected,
          ]}
    >
    <Text
            style={
    [
      styles.filterChipText,
      selected === option && styles.filterChipTextSelected,
    ]
  }
          >
    { option }
    </Text>
    </Pressable>
      ))
}
</ScrollView>
  );
const renderCard = ({ item }: { item: CollectionItem }) => (
  <Pressable
      style= { styles.cardTile }
onPress = {() => setSelectedCard(item)}
    >
{
  item.image_url ? (
    <Image
          source= {{ uri: item.image_url }}
style = { styles.cardImage }
resizeMode = "cover"
  />
      ) : (
  <View style= { [styles.cardImage, styles.imagePlaceholder]} >
  <Text style={ styles.placeholderText }> No photo </Text>
    </View>
      )}

<View style={ styles.cardInfo }>
  <Text style={ styles.cardName } numberOfLines = { 2} >
    { item.card_name }
    </Text>

    < Text style = { styles.mutedText } numberOfLines = { 1} >
      { item.set_name || 'Unknown set' }
{ item.card_number ? ` • #${item.card_number}` : '' }
</Text>

  < Text style = { styles.valueText } >
    Estimated: { formatMoney(item.estimated_value) }
</Text>

{
  item.market_price != null && (
    <Text style={ styles.marketText }>
      Market: { formatMoney(item.market_price) }
  </Text>
        )
}

<Text style={ styles.mutedText }>
  Qty: { item.quantity } • { item.condition || 'Condition unknown' }
</Text>

  < View style = { styles.badgeRow } >
    {!!item.rarity && (
      <Text style={ styles.badge }> { item.rarity } </Text>
          )}
{
  !!item.edition && (
    <Text style={ styles.badge }> { item.edition } </Text>
          )
}
</View>
  </View>
  </Pressable>
  );

return (
  <SafeAreaView style= { styles.safeArea } >
  {
    loading?(
        <View style = { styles.loadingContainer } >
        <ActivityIndicator size="large" color = "#146EF5" />
          <Text style={ styles.mutedText
  } > Loading your collection...</Text>
    </View>
      ) : (
  <FlatList
          data= { filteredItems }
keyExtractor = {(item) => item.id}
renderItem = { renderCard }
contentContainerStyle = { styles.listContent }
ListHeaderComponent = {
            < View >
  <View style={ styles.headerRow }>
    <View style={ styles.headerTextContainer }>
      <Text style={ styles.title }> My Collection </Text>
        < Text style = { styles.subtitle } >
          Your personal Pokémon card binder
            </Text>
            </View>

            < Pressable
style = { styles.primaryButton }
onPress = { openAddForm }
  >
  <Text style={ styles.primaryButtonText }> + Add </Text>
    </Pressable>
    </View>

    < View style = { styles.statsRow } >
      <View style={ styles.statCard }>
        <Text style={ styles.statLabel }> Estimated Value </Text>
          < Text style = { styles.statValue } >
            { formatMoney(totalValue) }
            </Text>
            </View>

            < View style = { styles.statCard } >
              <Text style={ styles.statLabel }> Total Cards </Text>
                < Text style = { styles.statValue } > { totalCards } </Text>
                  </View>

                  < View style = { styles.statCard } >
                    <Text style={ styles.statLabel }> Entries </Text>
                      < Text style = { styles.statValue } > { items.length } </Text>
                        </View>
                        </View>

                        < View style = { styles.section } >
                          <Text style={ styles.sectionTitle }>
                            Top 5 Most Valuable
                              </Text>

{
  topCards.length === 0 ? (
    <Text style= { styles.mutedText } >
    Add cards to see your most valuable entries.
                  </Text>
                ) : (
    topCards.map((item, index) => (
      <Pressable
                      key= { item.id }
                      style = { styles.topCardRow }
                      onPress = {() => setSelectedCard(item)}
                    >
  <Text style={ styles.rankText }> { index + 1}.</Text>

    < View style = { styles.topCardInfo } >
      <Text style={ styles.topCardName }>
        { item.card_name }
        </Text>
        < Text style = { styles.mutedText } >
          Qty: { item.quantity }
</Text>
  </View>

  < Text style = { styles.valueText } >
  {
    formatMoney(
      item.estimated_value * item.quantity
                        )
  }
    </Text>
    </Pressable>
                  ))
                )}
</View>

  < View style = { styles.section } >
    <Text style={ styles.sectionTitle }> Find Your Cards </Text>

      < TextInput
style = { styles.input }
placeholder = "Search name, set, or card number..."
placeholderTextColor = "#8B93A1"
value = { search }
onChangeText = { setSearch }
autoCapitalize = "none"
  />

  <Text style={ styles.filterLabel }> Rarity </Text>
{
  renderFilterButtons(
    RARITIES,
    rarityFilter,
    setRarityFilter
  )
}

<Text style={ styles.filterLabel }> Card Type </Text>
{
  renderFilterButtons(
    CARD_TYPES,
    typeFilter,
    setTypeFilter
  )
}

<Text style={ styles.filterLabel }> Edition </Text>
{
  renderFilterButtons(
    EDITIONS,
    editionFilter,
    setEditionFilter
  )
}

<Pressable
                  style={ styles.secondaryButton }
onPress = {() => setSortByValue((current) => !current)}
                >
  <Text style={ styles.secondaryButtonText }>
  {
    sortByValue
    ? 'Sorted by value · Tap for newest'
      : 'Sort by estimated value'
  }
    </Text>
    </Pressable>

    < Text style = { styles.resultsText } >
      Showing { filteredItems.length } of { items.length } entries
        </Text>
        </View>
        </View>
          }
ListEmptyComponent = {
            < View style = { styles.emptyContainer } >
  <Text style={ styles.emptyTitle }>
  {
    items.length === 0
      ? 'Your collection is empty'
      : 'No matching cards'
  }
    </Text>
    < Text style = { styles.mutedText } >
    {
      items.length === 0
        ? 'Tap + Add to add your first card.'
        : 'Try changing your search or filters.'
    }
      </Text>
      </View>
          }
ListFooterComponent = {< View style = {{ height: 30 }} />}
        />
      )}

{/* Add or edit card form */ }
<Modal
        visible={ showForm }
animationType = "slide"
onRequestClose = {() => setShowForm(false)}
      >
  <SafeAreaView style={ styles.modalSafeArea }>
    <ScrollView
            contentContainerStyle={ styles.formContent }
keyboardShouldPersistTaps = "handled"
  >
  <Text style={ styles.title }>
    { editingId? 'Edit Card': 'Add a Card' }
    </Text>

    < Text style = { styles.fieldLabel } > Card Name * </Text>
      < TextInput
style = { styles.input }
value = { cardName }
onChangeText = { setCardName }
placeholder = "Example: Charizard"
placeholderTextColor = "#8B93A1"
  />

  <Text style={ styles.fieldLabel }> Set Name </Text>
    < TextInput
style = { styles.input }
value = { setName }
onChangeText = { setSetName }
placeholder = "Example: Base Set"
placeholderTextColor = "#8B93A1"
  />

  <Text style={ styles.fieldLabel }> Card Number </Text>
    < TextInput
style = { styles.input }
value = { cardNumber }
onChangeText = { setCardNumber }
placeholder = "Example: 4/102"
placeholderTextColor = "#8B93A1"
  />

  <Text style={ styles.fieldLabel }> Estimated Value($) </Text>
    < TextInput
style = { styles.input }
value = { estimatedValue }
onChangeText = { setEstimatedValue }
placeholder = "0.00"
placeholderTextColor = "#8B93A1"
keyboardType = "decimal-pad"
  />

  <Text style={ styles.fieldLabel }> Quantity </Text>
    < TextInput
style = { styles.input }
value = { quantity }
onChangeText = { setQuantity }
placeholder = "1"
placeholderTextColor = "#8B93A1"
keyboardType = "number-pad"
  />

  <Text style={ styles.fieldLabel }> Condition </Text>
{
  renderFilterButtons(
    CONDITIONS,
    condition,
    setCondition
  )
}

<Text style={ styles.fieldLabel }> Rarity </Text>
{
  renderFilterButtons(
    RARITIES.filter((value) => value !== 'All'),
    rarity,
    setRarity
  )
}

<Text style={ styles.fieldLabel }> Card Type </Text>
{
  renderFilterButtons(
    CARD_TYPES.filter((value) => value !== 'All'),
    cardType,
    setCardType
  )
}

<Text style={ styles.fieldLabel }> Edition </Text>
{
  renderFilterButtons(
    EDITIONS.filter((value) => value !== 'All'),
    edition,
    setEdition
  )
}

<Text style={ styles.fieldLabel }> Card Photo </Text>

{
  (imageUri || existingImageUrl) && (
    <Image
                source={
    {
      uri: imageUri || existingImageUrl || undefined,
                }
  }
  style = { styles.formImage }
  resizeMode = "cover"
    />
            )
}

<Pressable
              style={ styles.secondaryButton }
onPress = { chooseImage }
  >
  <Text style={ styles.secondaryButtonText }>
    Choose Card Photo
      </Text>
      </Pressable>

      < Pressable
style = {
  [
  styles.primaryButton,
  styles.fullWidthButton,
  saving && styles.disabledButton,
              ]}
onPress = { saveCard }
disabled = { saving }
  >
{
  saving?(
                <ActivityIndicator color = "#FFFFFF" />
              ): (
      <Text style = {styles.primaryButtonText} >
  { editingId? 'Save Changes': 'Add to Collection' }
  </Text>
              )}
</Pressable>

  < Pressable
style = { styles.secondaryButton }
onPress = {() => {
  setShowForm(false);
  resetForm();
}}
            >
  <Text style={ styles.secondaryButtonText }> Cancel </Text>
    </Pressable>
    </ScrollView>
    </SafeAreaView>
    </Modal>

{/* Card details */ }
<Modal
        visible={ selectedCard !== null }
animationType = "slide"
transparent
onRequestClose = {() => setSelectedCard(null)}
      >
  <View style={ styles.overlay }>
    <View style={ styles.detailModal }>
      { selectedCard && (
        <ScrollView
                showsVerticalScrollIndicator={ false }
contentContainerStyle = { styles.detailContent }
  >
  <Text style={ styles.title }>
    { selectedCard.card_name }
    </Text>

{
  selectedCard.image_url ? (
    <Image
                    source= {{ uri: selectedCard.image_url }
}
style = { styles.detailImage }
resizeMode = "contain"
  />
                ) : (
  <View
                    style= {
    [
    styles.detailImage,
    styles.imagePlaceholder,
                    ]}
  >
  <Text style={ styles.placeholderText }>
    No photo added
      </Text>
      </View>
                )}

<Text style={ styles.detailText }>
  Set: { selectedCard.set_name || 'Not specified' }
</Text>
  < Text style = { styles.detailText } >
    Card number: { selectedCard.card_number || 'Not specified' }
</Text>
  < Text style = { styles.detailText } >
    Condition: { selectedCard.condition || 'Not specified' }
</Text>
  < Text style = { styles.detailText } >
    Rarity: { selectedCard.rarity || 'Not specified' }
</Text>
  < Text style = { styles.detailText } >
    Type: { selectedCard.card_type || 'Not specified' }
</Text>
  < Text style = { styles.detailText } >
    Edition: { selectedCard.edition || 'Not specified' }
</Text>
  < Text style = { styles.detailText } >
    Quantity: { selectedCard.quantity }
</Text>

  < View style = { styles.priceBox } >
    <Text style={ styles.priceBoxLabel }>
      Your Estimated Value
        </Text>
        < Text style = { styles.priceBoxValue } >
          { formatMoney(selectedCard.estimated_value) }
          </Text>

          < Text style = { styles.priceBoxLabel } >
            Market Price
              </Text>
              < Text style = { styles.priceBoxValue } >
              {
                selectedCard.market_price == null
                  ? 'Not checked yet'
                  : formatMoney(selectedCard.market_price)
              }
                </Text>

{
  selectedCard.market_price != null && (
    <Text
                      style={
    [
      styles.detailText,
      selectedCard.market_price -
        selectedCard.estimated_value >=
        0
        ? styles.positiveText
        : styles.negativeText,
    ]
  }
                    >
    Difference: { ' ' }
  {
    formatMoney(
      selectedCard.market_price -
      selectedCard.estimated_value
    )
  }
  </Text>
                  )
}

{
  selectedCard.market_price_updated_at && (
    <Text style={ styles.mutedText }>
      Updated: { ' ' }
  {
    new Date(
      selectedCard.market_price_updated_at
    ).toLocaleString()
  }
  </Text>
                  )
}
</View>

  < Pressable
style = {
  [
  styles.primaryButton,
  styles.fullWidthButton,
  checkingPrice && styles.disabledButton,
                  ]}
onPress = {() => checkMarketPrice(selectedCard)}
disabled = { checkingPrice }
  >
{
  checkingPrice?(
                    <ActivityIndicator color = "#FFFFFF" />
                  ): (
      <Text style = {styles.primaryButtonText} >
  Check Market Price
    </Text>
                  )}
</Pressable>

  < Pressable
style = { styles.secondaryButton }
onPress = {() => startEditing(selectedCard)}
                >
  <Text style={ styles.secondaryButtonText }>
    Edit Card
      </Text>
      </Pressable>

      < Pressable
style = { styles.dangerButton }
onPress = {() => removeCard(selectedCard)}
                >
  <Text style={ styles.dangerButtonText }>
    Remove Card
      </Text>
      </Pressable>

      < Pressable
style = { styles.secondaryButton }
onPress = {() => setSelectedCard(null)}
                >
  <Text style={ styles.secondaryButtonText }> Close </Text>
    </Pressable>
    </ScrollView>
            )}
</View>
  </View>
  </Modal>
  </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#25243D',
  },
  modalSafeArea: {
    flex: 1,
    backgroundColor: 'white',
  },
  listContent: {
    padding: 16,
    paddingBottom: 30,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
    gap: 12,
  },
  headerTextContainer: {
    flex: 1,
  },
  title: {
    fontSize: 25,
    fontWeight: '800',
    color: 'teal',
    marginBottom: 5,
  },
  subtitle: {
    fontSize: 13,
    color: 'white',
  },
  statsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 22,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E6EAF1',
  },
  statLabel: {
    fontSize: 11,
    color: '#737D8E',
    marginBottom: 8,
  },
  statValue: {
    fontSize: 16,
    fontWeight: '800',
    color: '#172033',
  },
  section: {
    marginBottom: 22,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: 'blueviolet',
    marginBottom: 12,
  },
  topCardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 10,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#EDF0F5',
  },
  rankText: {
    width: 28,
    fontWeight: '800',
    color: '#146EF5',
  },
  topCardInfo: {
    flex: 1,
  },
  topCardName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#172033',
  },
  input: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#DDE3EC',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: '#172033',
    fontSize: 15,
    marginBottom: 12,
  },
  fieldLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: '#303A4C',
    marginTop: 8,
    marginBottom: 8,
  },
  filterLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#536074',
    marginTop: 8,
    marginBottom: 5,
  },
  filterRow: {
    flexDirection: 'row',
    gap: 8,
    paddingVertical: 5,
    paddingRight: 8,
  },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 20,
    backgroundColor: '#E9EDF4',
    borderWidth: 1,
    borderColor: '#E0E5ED',
  },
  filterChipSelected: {
    backgroundColor: '#146EF5',
    borderColor: '#146EF5',
  },
  filterChipText: {
    fontSize: 12,
    color: '#465267',
    fontWeight: '600',
  },
  filterChipTextSelected: {
    color: '#FFFFFF',
  },
  primaryButton: {
    backgroundColor: '#146EF5',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
  secondaryButton: {
    backgroundColor: '#E9EDF4',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
  },
  secondaryButtonText: {
    color: '#303A4C',
    fontSize: 14,
    fontWeight: '700',
  },
  dangerButton: {
    backgroundColor: '#FDECEC',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
  },
  dangerButtonText: {
    color: '#B42318',
    fontSize: 14,
    fontWeight: '800',
  },
  fullWidthButton: {
    marginTop: 16,
    width: '100%',
    minHeight: 46,
  },
  disabledButton: {
    opacity: 0.6,
  },
  resultsText: {
    marginTop: 12,
    fontSize: 12,
    color: '#737D8E',
  },
  cardTile: {
    flexDirection: 'row',
    gap: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: 15,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E6EAF1',
  },
  cardImage: {
    width: 100,
    height: 140,
    borderRadius: 9,
    backgroundColor: '#EDF1F7',
  },
  imagePlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E0E5ED',
  },
  placeholderText: {
    fontSize: 12,
    color: '#737D8E',
    textAlign: 'center',
    paddingHorizontal: 8,
  },
  cardInfo: {
    flex: 1,
    justifyContent: 'center',
    gap: 5,
  },
  cardName: {
    fontSize: 16,
    fontWeight: '800',
    color: '#172033',
  },
  mutedText: {
    fontSize: 12,
    color: '#737D8E',
  },
  valueText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#172033',
  },
  marketText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#146B46',
  },
  badgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 5,
    marginTop: 3,
  },
  badge: {
    overflow: 'hidden',
    backgroundColor: '#EEF3FF',
    color: '#2458B8',
    fontSize: 10,
    paddingHorizontal: 7,
    paddingVertical: 4,
    borderRadius: 8,
  },
  emptyContainer: {
    alignItems: 'center',
    padding: 28,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    marginTop: 5,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#172033',
    marginBottom: 8,
  },
  formContent: {
    padding: 20,
    paddingBottom: 40,
  },
  formImage: {
    width: 150,
    height: 200,
    borderRadius: 12,
    alignSelf: 'center',
    marginVertical: 10,
    backgroundColor: '#EDF1F7',
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(10, 18, 32, 0.55)',
    justifyContent: 'center',
    padding: 16,
  },
  detailModal: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    maxHeight: '90%',
    overflow: 'hidden',
  },
  detailContent: {
    padding: 20,
    paddingBottom: 24,
  },
  detailImage: {
    width: 180,
    height: 240,
    alignSelf: 'center',
    borderRadius: 12,
    backgroundColor: '#EDF1F7',
    marginVertical: 14,
  },
  detailText: {
    fontSize: 14,
    color: '#303A4C',
    marginBottom: 8,
  },
  priceBox: {
    backgroundColor: '#F5F7FB',
    borderRadius: 12,
    padding: 14,
    marginTop: 8,
  },
  priceBoxLabel: {
    fontSize: 12,
    color: '#737D8E',
    marginBottom: 4,
  },
  priceBoxValue: {
    fontSize: 20,
    fontWeight: '800',
    color: '#172033',
    marginBottom: 12,
  },
  positiveText: {
    color: '#15803D',
    fontWeight: '800',
  },
  negativeText: {
    color: '#B42318',
    fontWeight: '800',
  },
});