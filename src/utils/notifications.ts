export const requestNotificationPermission = async (): Promise<boolean> => {
  if (!('Notification' in window)) return false;
  if (Notification.permission === 'granted') return true;
  if (Notification.permission === 'denied') return false;
  const result = await Notification.requestPermission();
  return result === 'granted';
};

export const sendNotification = (
  title: string,
  body: string,
  tag: string
): void => {
  if (Notification.permission !== 'granted') return;
  new Notification(title, { body, tag, icon: '/vite.svg' });
};
