import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

const TOKEN_KEY = 'trackme_push_token';

export const registerForPushNotifications = async (): Promise<string | null> => {
  const existing = await AsyncStorage.getItem(TOKEN_KEY);
  if (existing) return existing;

  const { status } = await Notifications.requestPermissionsAsync();
  if (status !== 'granted') return null;

  const token = (await Notifications.getExpoPushTokenAsync()).data;
  await AsyncStorage.setItem(TOKEN_KEY, token);
  return token;
};

export const sendLocalNotification = async (
  title: string,
  body: string
): Promise<void> => {
  await Notifications.scheduleNotificationAsync({
    content: { title, body, sound: true },
    trigger: null,
  });
};

export const getPushToken = (): Promise<string | null> =>
  AsyncStorage.getItem(TOKEN_KEY);
