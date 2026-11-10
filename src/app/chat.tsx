
import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
} from 'react-native';
import { Stack } from 'expo-router';

type Message = {
  id: string;
  text: string;
  sender: 'bot' | 'user';
};

const initialMessage: Message = {
  id: 'welcome',
  sender: 'bot',
  text: "Hey, Trainer! 👋 I'm VaultBot. Ask me about Pokémon cards, orders, selling cards, or using CardVault!",
};

function getBotReply(message: string): string {
  const text = message.toLowerCase();

  if (text.includes('charizard')) {
    return '🔥 Charizard is a fan favorite! Open Explore to browse available cards. Check the set, condition, and price before buying.';
  }

  if (
    text.includes('sell') ||
    text.includes('selling') ||
    text.includes('list my')
  ) {
    return '💰 Want to sell cards? Open the Sell page to add your card photos, name, set number, condition, description, and asking price.';
  }

  if (
    text.includes('cart') ||
    text.includes('checkout') ||
    text.includes('buy')
  ) {
    return '🛒 Head to your Cart to review your items, then continue to Checkout. Always review your order total before placing an order.';
  }

  if (
    text.includes('price') ||
    text.includes('value') ||
    text.includes('worth')
  ) {
    return '💎 A card’s value depends on its set, rarity, condition, authenticity, and recent sold prices. Tell me the card name and number to get started.';
  }

  if (
    text.includes('condition') ||
    text.includes('grading') ||
    text.includes('grade')
  ) {
    return '🔎 Card condition ranges from damaged to near mint. Look closely at corners, edges, surface scratches, whitening, and centering.';
  }

  if (
    text.includes('fake') ||
    text.includes('authentic') ||
    text.includes('real card')
  ) {
    return '🧐 I can help you learn authentication checks, but a reliable assessment may require clear photos of both sides, texture, printing, and other details.';
  }

  if (
    text.includes('order') ||
    text.includes('shipping') ||
    text.includes('delivery')
  ) {
    return '📦 For order status or shipping updates, check your order details if available. This version of VaultBot cannot access live order records yet.';
  }

  if (
    text.includes('hello') ||
    text.includes('hi ') ||
    text === 'hi' ||
    text.includes('hey')
  ) {
    return 'Hey! 👋 Welcome to CardVault! Are you shopping for cards, checking card values, or selling your collection?';
  }

  return "I'm here to help with Pokémon cards and CardVault! Try asking about Charizard, card values, selling cards, card condition, your cart, or checkout.";
}

export default function ChatScreen() {
  const [messages, setMessages] = useState<Message[]>([
    initialMessage,
  ]);
  const [input, setInput] = useState('');

  function sendMessage() {
    const trimmed = input.trim();

    if (!trimmed) return;

    const userMessage: Message = {
      id: `${Date.now()}-user`,
      text: trimmed,
      sender: 'user',
    };

    const botMessage: Message = {
      id: `${Date.now()}-bot`,
      text: getBotReply(trimmed),
      sender: 'bot',
    };

    setMessages((current) => [
      ...current,
      userMessage,
      botMessage,
    ]);

    setInput('');
  }

  return (
    <>
      <Stack.Screen
        options={{
          title: 'VaultBot',
          headerStyle: { backgroundColor: '#17152F' },
          headerTintColor: '#FFFFFF',
        }}
      />

      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={90}
      >
        <View style={styles.header}>
          <View style={styles.botIcon}>
            <Text style={styles.botEmoji}>🤖</Text>
          </View>

          <View>
            <Text style={styles.headerTitle}>VaultBot</Text>
            <Text style={styles.status}>
              ● Your CardVault assistant
            </Text>
          </View>
        </View>

        <ScrollView
          style={styles.chat}
          contentContainerStyle={styles.chatContent}
          keyboardShouldPersistTaps="handled"
        >
          {messages.map((message) => {
            const isUser = message.sender === 'user';

            return (
              <View
                key={message.id}
                style={[
                  styles.messageRow,
                  isUser && styles.userRow,
                ]}
              >
                <View
                  style={[
                    styles.bubble,
                    isUser
                      ? styles.userBubble
                      : styles.botBubble,
                  ]}
                >
                  <Text
                    style={[
                      styles.messageText,
                      isUser && styles.userText,
                    ]}
                  >
                    {message.text}
                  </Text>
                </View>
              </View>
            );
          })}
        </ScrollView>

        <View style={styles.suggestions}>
          {['Card values', 'Selling cards', 'Charizard'].map(
            (suggestion) => (
              <Pressable
                key={suggestion}
                style={styles.suggestion}
                onPress={() => setInput(suggestion)}
              >
                <Text style={styles.suggestionText}>
                  {suggestion}
                </Text>
              </Pressable>
            )
          )}
        </View>

        <View style={styles.inputRow}>
          <TextInput
            style={styles.input}
            value={input}
            onChangeText={setInput}
            placeholder="Ask VaultBot anything..."
            placeholderTextColor="#8B8BA3"
            returnKeyType="send"
            onSubmitEditing={sendMessage}
          />

          <Pressable
            style={styles.sendButton}
            onPress={sendMessage}
            accessibilityLabel="Send message"
          >
            <Text style={styles.sendText}>➤</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'teal',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 18,
    gap: 12,
    backgroundColor: 'blueviolet',
  },
  botIcon: {
    width: 46,
    height: 46,
    borderRadius: 15,
    backgroundColor: '#4338CA',
    alignItems: 'center',
    justifyContent: 'center',
  },
  botEmoji: {
    fontSize: 25,
  },
  headerTitle: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: 'bold',
  },
  status: {
    color: '#A5F3C5',
    fontSize: 12,
    marginTop: 3,
  },
  chat: {
    flex: 1,
  },
  chatContent: {
    padding: 16,
    gap: 14,
  },
  messageRow: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
  },
  userRow: {
    justifyContent: 'flex-end',
  },
  bubble: {
    maxWidth: '88%',
    padding: 13,
    borderRadius: 17,
  },
  botBubble: {
    backgroundColor: '#25243D',
    borderBottomLeftRadius: 5,
  },
  userBubble: {
    backgroundColor: '#5145E5',
    borderBottomRightRadius: 5,
  },
  messageText: {
    color: '#F4F3FF',
    fontSize: 15,
    lineHeight: 22,
  },
  userText: {
    color: '#FFFFFF',
  },
  suggestions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 8,
  },
  suggestion: {
    borderWidth: 1,
    borderColor: '#5145E5',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  suggestionText: {
    color: '#C9C5FF',
    fontSize: 12,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    paddingBottom: Platform.OS === 'ios' ? 20 : 12,
    gap: 10,
    borderTopWidth: 1,
    borderTopColor: '#292740',
  },
  input: {
    flex: 1,
    backgroundColor: '#25243D',
    borderRadius: 25,
    paddingHorizontal: 17,
    paddingVertical: 13,
    color: '#FFFFFF',
    fontSize: 15,
  },
  sendButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#5145E5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendText: {
    color: '#FFFFFF',
    fontSize: 23,
  },
});
