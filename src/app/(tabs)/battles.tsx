
import { useCallback, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Animated,
    Image,
    Pressable,
    SafeAreaView,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/auth-context';
import { useAudioPlayer } from 'expo-audio';
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

type Fighter = {
    id: string;
    name: string;
    image: string | null;
    hp: number;
    maxHp: number;
    attack: number;
};

function getStats(card: CollectionItem) {
    const value = Number(card.market_price ?? card.estimated_value ?? 0);
    const rarity = (card.rarity ?? '').toLowerCase();

    const rarityBonus =
        rarity.includes('secret') || rarity.includes('ultra')
            ? 15
            : rarity.includes('rare') || rarity.includes('holo')
                ? 10
                : 0;

    return {
        hp:
            80 +
            Math.min(40, Math.floor(Math.max(0, value) / 10)) +
            rarityBonus,
        attack:
            12 +
            Math.min(15, Math.floor(Math.max(0, value) / 20)) +
            Math.floor(rarityBonus / 3),
    };
}

function makeFighter(card: CollectionItem): Fighter {
    const stats = getStats(card);

    return {
        id: card.id,
        name: card.card_name,
        image: card.image_url,
        hp: stats.hp,
        maxHp: stats.hp,
        attack: stats.attack,
    };
}

function makeComputer(): Fighter {
    const opponents = [
        { name: 'Pikachu', hp: 100, attack: 17 },
        { name: 'Charizard', hp: 125, attack: 22 },
        { name: 'Blastoise', hp: 115, attack: 19 },
        { name: 'Mewtwo', hp: 120, attack: 21 },
        { name: 'Eevee', hp: 90, attack: 15 },
    ];

    const opponent = opponents[Math.floor(Math.random() * opponents.length)];

    return {
        id: `computer-${opponent.name}`,
        name: opponent.name,
        image: null,
        hp: opponent.hp,
        maxHp: opponent.hp,
        attack: opponent.attack,
    };
}

export default function BattlesScreen() {
    const { session, loading: authLoading } = useAuth();
    const quickAttackSound = useAudioPlayer(
        require('../../../assets/sounds/quick-attack.wav'));
    const powerStrikeSound = useAudioPlayer(
        require('../../../assets/sounds/power-strike.wav')
    );
    const [cards, setCards] = useState<CollectionItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [player, setPlayer] = useState<Fighter | null>(null);
    const [computer, setComputer] = useState<Fighter | null>(null);
    const [message, setMessage] = useState('Choose a Pokémon to begin.');
    const [busy, setBusy] = useState(false);
    const [battleOver, setBattleOver] = useState(false);

    const [powerUses, setPowerUses] = useState(2);
    const [healUses, setHealUses] = useState(2);
    const [shieldUses, setShieldUses] = useState(1);
    const attackPosition = useRef(new Animated.Value(0)).current;
    const computerShake = useRef(new Animated.Value(0)).current; 
    const victoryScale = useRef(new Animated.Value(1)).current;
    const healScale = useRef(new Animated.Value(1)).current;
   
    useFocusEffect(
        useCallback(() => {
            let active = true;

            async function loadCards() {
                if (authLoading) return;

                setLoading(true);

                if (!session?.user) {
                    if (active) {
                        setCards([]);
                        setLoading(false);
                    }
                    return;
                }

                const { data, error } = await supabase
                    .from('collection_items')
                    .select(
                        'id, card_name, set_name, card_number, condition, quantity, estimated_value, image_url, rarity, card_type, edition, market_price, market_price_updated_at'
                    )
                    .eq('user_id', session.user.id)
                    .order('created_at', { ascending: false });

                if (!active) return;

                if (error) {
                    console.error('Could not load battle cards:', error.message);
                    Alert.alert('Could not load cards', error.message);
                    setCards([]);
                } else {
                    setCards((data ?? []) as CollectionItem[]);
                }

                setLoading(false);
            }

            loadCards();

            return () => {
                active = false;
            };
        }, [session?.user?.id, authLoading])
    );
    function animateAttack() {
        attackPosition.setValue(0);

        Animated.sequence([
            Animated.timing(attackPosition, {
                toValue: 25,
                duration: 150,
                useNativeDriver: true,
            }),
            Animated.spring(attackPosition, {
                toValue: 0,
                friction: 4,
                tension: 90,
                useNativeDriver: true,
            }),
        ]).start();
    } function animateVictory() {
        victoryScale.setValue(1);

        Animated.sequence([
            Animated.spring(victoryScale, {
                toValue: 1.25,
                friction: 3,
                tension: 80,
                useNativeDriver: true,
            }),
            Animated.spring(victoryScale, {
                toValue: 1,
                friction: 4,
                tension: 60,
                useNativeDriver: true,
            }),
        ]).start();
    }
    function animateComputerHit() {
        computerShake.setValue(0);

        Animated.sequence([
            Animated.timing(computerShake, {
                toValue: -10,
                duration: 60,
                useNativeDriver: true,
            }),
            Animated.timing(computerShake, {
                toValue: 10,
                duration: 60,
                useNativeDriver: true,
            }),
            Animated.timing(computerShake, {
                toValue: -6,
                duration: 60,
                useNativeDriver: true,
            }),
            Animated.timing(computerShake, {
                toValue: 6,
                duration: 60,
                useNativeDriver: true,
            }),
            Animated.timing(computerShake, {
                toValue: 0,
                duration: 60,
                useNativeDriver: true,
            }),
        ]).start();
    }
    function startBattle(card: CollectionItem) {
        setSelectedId(card.id);
        setPlayer(makeFighter(card));
        setComputer(makeComputer());
        setPowerUses(2);
        setHealUses(2);
        setShieldUses(1);
        setMessage(`${card.card_name} enters the battle! Your turn.`);
        setBattleOver(false);
        setBusy(false);
        victoryScale.setValue(1);
    }

    function resetBattle() {
        setPlayer(null);
        setComputer(null);
        setSelectedId(null);
        setMessage('Choose a Pokémon to begin.');
        setBattleOver(false);
        setBusy(false);
        setPowerUses(2);
        setHealUses(2);
        setShieldUses(1);
        victoryScale.setValue(1);

    }

    function useMove(move: 'quick' | 'power' | 'heal' | 'shield') {
        if (!player || !computer || busy || battleOver) return;

        if (move === 'power' && powerUses <= 0) {
            setMessage('No Power Strikes left!');
            return;
        }

        if (move === 'heal' && healUses <= 0) {
            setMessage('No heals left!');
            return;
        }

        if (move === 'heal' && player.hp >= player.maxHp) {
            setMessage('Your Pokémon already has full HP!');
            return;
        }

        if (move === 'shield' && shieldUses <= 0) {
            setMessage('Your Shield has already been used!');
            return;
        }

        setBusy(true);

        let nextPlayer = { ...player };
        let nextComputer = { ...computer };
        let actionMessage = '';
        const shieldThisTurn = move === 'shield';

        if (move === 'quick' || move === 'power') {
            animateAttack();

            if (move === 'quick') {
                quickAttackSound.seekTo(0)
                    .then(() => quickAttackSound.play())
                    .catch((error) => {
                        console.log('Quick Attack audio error:', error);
                    });
            }

            const bonus = move === 'power' ? 20 : 0;
            const damage =
                player.attack + bonus + Math.floor(Math.random() * 9);

            nextComputer = {
                ...computer,
                hp: Math.max(0, computer.hp - damage),
            };

            setComputer(nextComputer);
            animateComputerHit();

            if (move === 'power') {
                setPowerUses((uses) => uses - 1);
            }
            if (move === 'power') {
                powerStrikeSound.seekTo(0)
                    .then(() => powerStrikeSound.play())
                    .catch((error) => {
                        console.log('Power Strike audio error:', error);
                    });
            }
            actionMessage =
                move === 'power'
                    ? `${player.name} used Power Strike for ${damage} damage!`
                    : `${player.name} used Quick Attack for ${damage} damage!`;
        } else if (move === 'heal') {
            const healedHp = Math.min(player.maxHp, player.hp + 25);
            const healedAmount = healedHp - player.hp;

            nextPlayer = { ...player, hp: healedHp };
            setPlayer(nextPlayer);
            setHealUses((uses) => uses - 1);
            actionMessage = `${player.name} recovered ${healedAmount} HP!`;
        } else {
            setShieldUses((uses) => uses - 1);
            actionMessage = `${player.name} raised a Shield! Incoming damage is halved.`;
        }

        if (nextComputer.hp <= 0) {
            setMessage(`${player.name} wins! Your opponent has been defeated.`);
            setBattleOver(true);
            setBusy(false);
            return;
        }
        if (nextComputer.hp <= 0) {
            animateVictory();

            setMessage(`${player.name} wins! Your opponent has been defeated.`);
            setBattleOver(true);
            setBusy(false);
            return;
        }
        setMessage(actionMessage);

        setTimeout(() => {
            const rawDamage =
                nextComputer.attack + Math.floor(Math.random() * 8);

            const computerDamage = shieldThisTurn
                ? Math.floor(rawDamage / 2)
                : rawDamage;

            const remainingPlayerHp = Math.max(
                0,
                nextPlayer.hp - computerDamage
            );

            const finalPlayer = {
                ...nextPlayer,
                hp: remainingPlayerHp,
            };

            setPlayer(finalPlayer);

            if (remainingPlayerHp <= 0) {
                setMessage(`${nextComputer.name} wins! Try another Pokémon.`);
                setBattleOver(true);
            } else {
                setMessage(
                    `${nextComputer.name} dealt ${computerDamage} damage. Your turn!`
                );
            }

            setBusy(false);
        }, 700);
    }

    const playerPercent = player
        ? Math.max(0, (player.hp / player.maxHp) * 100)
        : 100;

    const computerPercent = computer
        ? Math.max(0, (computer.hp / computer.maxHp) * 100)
        : 100;

    return (
        <SafeAreaView style= { styles.safe } >
        <ScrollView contentContainerStyle={ styles.content }>
            <Text style={ styles.brand }> CARDVAULT </Text>
                <Text  style = { styles.heading } > Practice Battles </Text>
                    <Text style = { styles.subtitle } >
                        Train your Pokémon against the computer.
        </Text>

    {
        authLoading || loading ? (
            <ActivityIndicator size= "large" color = "#36D6C4" />
        ) : !session?.user ? (
            <View style= { styles.panel } >
            <Text style={ styles.panelTitle }> Sign in to battle </Text>
                < Text style = { styles.body } >
                    Sign in to use Pokémon from your own collection.
            </Text>
                        </View>
        ) : cards.length === 0 ? (
            <View style= { styles.panel } >
            <Text style={ styles.panelTitle }> Your collection is empty </Text>
                < Text style = { styles.body } >
                    Add Pokémon to your collection first, then return here to battle.
            </Text>
                        </View>
        ) : player && computer ? (
            <View style= { styles.battleArea } >
            <Animated.View
  style={
            [
                styles.fighter,
                {
                    transform: [
                        { translateX: attackPosition },
                        { scale: Animated.multiply(healScale, victoryScale) },
                    ],
                },
            ]
        }
>
            <Text style={ styles.fighterLabel }> YOUR POKÉMON </Text>
        {
            player.image ? (
                <Image
                  source= {{ uri: player.image }
        }
        style = { styles.fighterImage }
        resizeMode = "contain"
            />
              ) : (
            <View style= { styles.placeholder } >
            <Text style={ styles.placeholderText }>⚡</Text>
                </View>
              )
    }
    <Text style={ styles.fighterName }> { player.name } </Text>
        < Text style = { styles.hpText } >
            HP { player.hp } / {player.maxHp}
                </Text>
                < View style = { styles.hpTrack } >
                    <View
                  style={ [styles.hpFill, { width: `${playerPercent}%` }] }
                />
        </View>
        <Text  style = { styles.stat } > Attack: { player.attack } </Text>
            </Animated.View>         
        

            <Text style = { styles.vs }> VS </Text>
                

        < Animated.View
    style = {
        [
        styles.fighter,
        { transform: [{ translateX: computerShake }] },
  ]}
        >
        <Text style={ styles.fighterLabel }> COMPUTER </Text>
                        < View style = { styles.placeholder } >
                            <Text style={ styles.placeholderText }>🤖</Text>
                                </View>
                                < Text style = { styles.fighterName } > { computer.name } </Text>
                                    < Text style = { styles.hpText } >
                                        HP { computer.hp } / {computer.maxHp}
                                            </Text>
                                            < View style = { styles.hpTrack } >
                                                <View
                  style={
        [
            styles.hpFill,
            styles.computerHp,
            { width: `${computerPercent}%` },
        ]
    }
                />
        </View>
        <Text  style = { styles.stat } > Attack: { computer.attack } </Text>
            </Animated.View>


            < View style = {styles.messageBox}>
                <Text style={ styles.message }> { message } </Text>
                    </View>

    {!battleOver ? (
            <View style= { styles.moves } >
            <Pressable
                  style={ [styles.moveButton, busy && styles.disabled] }
        onPress = {() => useMove('quick')
    }
    disabled = { busy }
        >
        <Text style={ styles.moveTitle }>⚔️ Quick Attack </Text>
            < Text style = { styles.moveSubtitle } > Normal damage </Text>
                </Pressable>

                < Pressable
    style = {
        [
        styles.moveButton,
        styles.powerButton,
        (busy || powerUses <= 0) && styles.disabled,
                  ]}
    onPress = {() => useMove('power')
}
disabled = { busy || powerUses <= 0}
                >
    <Text style={ styles.moveTitle }>💥 Power Strike </Text>
        < Text style = { styles.moveSubtitle } >
            +20 damage · Uses left: { powerUses }
</Text>
    </Pressable>

    < Pressable
style = {
    [
    styles.moveButton,
    styles.healButton,
    (busy || healUses <= 0 || player.hp >= player.maxHp) &&
    styles.disabled,
                  ]}
onPress = {() => useMove('heal')}
disabled = {
    busy || healUses <= 0 || player.hp >= player.maxHp
                  }
                >
    <Text style={ styles.moveTitle }>💚 Heal </Text>
        < Text style = { styles.moveSubtitle } >
            Restore up to 25 HP · Uses left: { healUses }
</Text>
    </Pressable>

    < Pressable
style = {
    [
    styles.moveButton,
    styles.shieldButton,
    (busy || shieldUses <= 0) && styles.disabled,
                  ]}
onPress = {() => useMove('shield')}
disabled = { busy || shieldUses <= 0}
                >
    <Text style={ styles.moveTitle }>🛡️ Shield </Text>
        < Text style = { styles.moveSubtitle } >
            Halve next hit · Uses left: { shieldUses }
</Text>
    </Pressable>

{
    busy && (
        <Text style={ styles.turnText }> TURN IN PROGRESS…</Text>
                )
}
</View>
            ) : (
    <View style= { styles.resultBox } >
    <Text style={ styles.resultText }>
        { player.hp > 0 ? '🏆 VICTORY!' : '💥 DEFEAT' }
        </Text>
        </View>
            )}

<Pressable
              style={ styles.secondaryButton }
onPress = { resetBattle }
    >
    <Text style={ styles.secondaryText }>
        Choose Another Pokémon
            </Text>
            </Pressable>
            </View>
        ) : (
    <View style= { styles.panel } >
    <Text style={ styles.panelTitle }> Choose your fighter </Text>
        < Text style = { styles.body } >
            Select a Pokémon from your collection to start a practice match.
            </Text>

{
    cards.map((card) => {
        const stats = getStats(card);

        return (
            <Pressable
                  key= { card.id }
        style = {
            [
            styles.cardOption,
            selectedId === card.id && styles.selectedCard,
                  ]}
        onPress = {() => startBattle(card)
    }
                >
        {
            card.image_url ? (
                <Image
                      source= {{ uri: card.image_url }}
style = { styles.cardImage }
resizeMode = "contain"
    />
                  ) : (
    <View style= { styles.smallPlaceholder } >
    <Text style={ styles.placeholderText }>⚡</Text>
        </View>
                  )}

<View style={ styles.cardInfo }>
    <Text style={ styles.cardName }> { card.card_name } </Text>
        < Text style = { styles.cardDetails } >
            { card.set_name ?? 'Pokémon card' }
            </Text>
            < Text style = { styles.cardStats } >
                HP { stats.hp } · Attack { stats.attack }
</Text>
    </View>

    < Text style = { styles.selectLabel } > SELECT </Text>
        </Pressable>
              );
            })}
</View>
        )}

<Text style={ styles.footer }>
    Practice mode only.Battles do not change your collection or involve
purchases.
        </Text>
    </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
    safe: { flex: 1, backgroundColor: '#25243D' },
    content: { padding: 18, paddingBottom: 36 },
    brand: {
        color: '#36D6C4',
        fontSize: 14,
        fontWeight: '900',
        letterSpacing: 2,
    },
    heading: {
        color: '#FFFFFF',
        fontSize: 30,
        fontWeight: '900',
        marginTop: 8,
    },
    subtitle: {
        color: '#B9C0D8',
        fontSize: 14,
        marginTop: 6,
        marginBottom: 22,
    },
    panel: {
        backgroundColor: '#34334E',
        borderRadius: 18,
        padding: 16,
        marginTop: 8,
    },
    panelTitle: { color: '#FFFFFF', fontSize: 20, fontWeight: '900' },
    body: {
        color: '#C5C9DA',
        lineHeight: 21,
        marginTop: 8,
        marginBottom: 12,
    },
    cardOption: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#25243D',
        borderColor: '#4B4A66',
        borderWidth: 1,
        borderRadius: 14,
        padding: 10,
        marginTop: 10,
    },
    selectedCard: { borderColor: '#36D6C4', borderWidth: 2 },
    cardImage: { width: 66, height: 92 },
    smallPlaceholder: {
        width: 66,
        height: 92,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#45445F',
        borderRadius: 8,
    },
    cardInfo: { flex: 1, paddingHorizontal: 10 },
    cardName: { color: '#FFFFFF', fontSize: 16, fontWeight: '900' },
    cardDetails: { color: '#B9C0D8', fontSize: 12, marginTop: 4 },
    cardStats: {
        color: '#36D6C4',
        fontSize: 12,
        fontWeight: '800',
        marginTop: 7,
    },
    selectLabel: { color: '#36D6C4', fontSize: 10, fontWeight: '900' },
    battleArea: {
        backgroundColor: '#34334E',
        borderRadius: 18,
        padding: 14,
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    fighter: {
        width: '44%',
        alignItems: 'center',
        paddingVertical: 8,
    },
    fighterLabel: {
        color: '#B9C0D8',
        fontSize: 10,
        fontWeight: '900',
        marginBottom: 8,
    },
    fighterImage: { width: 100, height: 125 },
    placeholder: {
        width: 100,
        height: 125,
        borderRadius: 12,
        backgroundColor: '#45445F',
        alignItems: 'center',
        justifyContent: 'center',
    },
    placeholderText: { fontSize: 40 },
    fighterName: {
        color: '#FFFFFF',
        fontWeight: '900',
        fontSize: 16,
        textAlign: 'center',
        marginTop: 8,
    },
    hpText: { color: '#D8DBE8', fontSize: 11, marginTop: 8 },
    hpTrack: {
        height: 8,
        width: '100%',
        backgroundColor: '#19182C',
        borderRadius: 6,
        overflow: 'hidden',
        marginTop: 6,
    },
    hpFill: {
        height: '100%',
        backgroundColor: '#36D6C4',
        borderRadius: 6,
    },
    computerHp: { backgroundColor: '#FF8D8D' },
    stat: { color: '#B9C0D8', fontSize: 11, marginTop: 7 },
    vs: {
        color: '#F4D35E',
        fontSize: 20,
        fontWeight: '900',
        width: '12%',
        textAlign: 'center',
    },
    messageBox: {
        width: '100%',
        backgroundColor: '#25243D',
        borderRadius: 12,
        padding: 14,
        marginTop: 16,
    },
    message: { color: '#FFFFFF', textAlign: 'center', lineHeight: 21 },
    moves: {
        width: '100%',
        marginTop: 8,
    },
    moveButton: {
        backgroundColor: '#36D6C4',
        borderRadius: 12,
        padding: 13,
        alignItems: 'center',
        marginTop: 8,
    },
    powerButton: { backgroundColor: '#F4D35E' },
    healButton: { backgroundColor: '#9BE7A5' },
    shieldButton: { backgroundColor: '#A9B8FF' },
    moveTitle: {
        color: '#25243D',
        fontWeight: '900',
        fontSize: 15,
    },
    moveSubtitle: {
        color: '#34334E',
        fontSize: 12,
        marginTop: 3,
        textAlign: 'center',
    },
    turnText: {
        color: '#B9C0D8',
        textAlign: 'center',
        marginTop: 12,
        fontWeight: '800',
    },
    disabled: { opacity: 0.45 },
    resultBox: {
        width: '100%',
        backgroundColor: '#F4D35E',
        borderRadius: 12,
        padding: 15,
        alignItems: 'center',
        marginTop: 14,
    },
    resultText: { color: '#25243D', fontSize: 19, fontWeight: '900' },
    secondaryButton: {
        width: '100%',
        borderColor: '#36D6C4',
        borderWidth: 1,
        borderRadius: 12,
        padding: 13,
        alignItems: 'center',
        marginTop: 10,
    },
    secondaryText: { color: '#36D6C4', fontWeight: '800' },
    footer: {
        color: '#969BB5',
        textAlign: 'center',
        fontSize: 11,
        lineHeight: 17,
        marginTop: 22,
    },
});
