import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import { supabase } from './supabase';

// Configure notification behavior
Notifications.setNotificationHandler({
    handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: true,
        shouldShowBanner: true,
        shouldShowList: true,
    }),
});

export interface NotificationData {
    type: 'voucher_expiry' | 'family_invitation' | 'invitation_accepted' | 'invitation_rejected';
    voucherId?: string;
    familyId?: string;
    message?: string;
    [key: string]: unknown;
}

/**
 * Register for push notifications and save token to Supabase
 */
export async function registerForPushNotifications(userId: string): Promise<string | null> {
    if (!Device.isDevice) {
        console.log('Push notifications require a physical device');
        return null;
    }

    try {
        // Check existing permissions
        const { status: existingStatus } = await Notifications.getPermissionsAsync();
        let finalStatus = existingStatus;

        // Request permissions if not granted
        if (existingStatus !== 'granted') {
            const { status } = await Notifications.requestPermissionsAsync();
            finalStatus = status;
        }

        if (finalStatus !== 'granted') {
            console.log('Push notification permission not granted');
            return null;
        }

        // Get the Expo push token
        const tokenData = await Notifications.getExpoPushTokenAsync({
            projectId: 'bdf2d798-7677-45e1-8b50-ccd7c6e0c4f6'
        });
        const pushToken = tokenData.data;

        console.log('Push token:', pushToken);

        // Save token to user's profile
        await supabase
            .from('profiles')
            .update({ push_token: pushToken })
            .eq('id', userId);

        return pushToken;
    } catch (error) {
        console.error('Error registering for push notifications:', error);
        return null;
    }
}

/**
 * Schedule local notifications for a voucher's expiry
 */
export async function scheduleExpiryNotifications(voucherId: string, voucherTitle: string, expiryDate: string): Promise<void> {
    // Cancel any existing notifications for this voucher
    await cancelExpiryNotifications(voucherId);

    if (!expiryDate) return;

    const expiry = new Date(expiryDate);
    const now = new Date();

    // Notification intervals in days
    const intervals = [30, 14, 7, 1];

    for (const days of intervals) {
        const notificationDate = new Date(expiry);
        notificationDate.setDate(notificationDate.getDate() - days);

        // Only schedule if the notification date is in the future
        if (notificationDate > now) {
            const trigger = notificationDate;

            await Notifications.scheduleNotificationAsync({
                content: {
                    title: `Gutschein läuft ${days === 1 ? 'morgen' : `in ${days} Tagen`} ab`,
                    body: `${voucherTitle} - Nicht vergessen einzulösen!`,
                    data: { type: 'voucher_expiry', voucherId },
                    sound: true,
                },
                trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: notificationDate },
                identifier: `expiry-${voucherId}-${days}`,
            });

            console.log(`Scheduled notification for ${voucherTitle} in ${days} days`);
        }
    }
}

/**
 * Cancel all expiry notifications for a voucher
 */
export async function cancelExpiryNotifications(voucherId: string): Promise<void> {
    const intervals = [30, 14, 7, 1];
    for (const days of intervals) {
        try {
            await Notifications.cancelScheduledNotificationAsync(`expiry-${voucherId}-${days}`);
        } catch (e) {
            // Notification might not exist
        }
    }
}

/**
 * Send a push notification via Expo Push API (for backend use or testing)
 */
export async function sendPushNotification(
    pushToken: string,
    title: string,
    body: string,
    data: NotificationData
): Promise<void> {
    const message = {
        to: pushToken,
        sound: 'default',
        title,
        body,
        data,
    };

    try {
        await fetch('https://exp.host/--/api/v2/push/send', {
            method: 'POST',
            headers: {
                Accept: 'application/json',
                'Accept-encoding': 'gzip, deflate',
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(message),
        });
    } catch (error) {
        console.error('Error sending push notification:', error);
    }
}

/**
 * Handle notification response (when user taps on notification)
 * Returns the voucher ID if the notification was for a voucher
 */
export function getVoucherIdFromNotification(response: Notifications.NotificationResponse): string | null {
    const data = response.notification.request.content.data as NotificationData;
    if (data?.type === 'voucher_expiry' && data?.voucherId) {
        return data.voucherId;
    }
    return null;
}

/**
 * Add notification listener for handling notification taps
 */
export function addNotificationResponseListener(
    callback: (voucherId: string) => void
): Notifications.EventSubscription {
    return Notifications.addNotificationResponseReceivedListener((response) => {
        const voucherId = getVoucherIdFromNotification(response);
        if (voucherId) {
            callback(voucherId);
        }
    });
}

/**
 * Send invitation response notification to inviter
 */
export async function sendInviteResponseNotification(
    inviterPushToken: string,
    inviteeName: string,
    familyName: string,
    response: 'accepted' | 'rejected'
): Promise<void> {
    if (!inviterPushToken) return;

    const title = response === 'accepted'
        ? 'Einladung angenommen! 🎉'
        : 'Einladung abgelehnt';

    const body = response === 'accepted'
        ? `${inviteeName} ist jetzt Mitglied von "${familyName}"`
        : `${inviteeName} hat die Einladung zu "${familyName}" abgelehnt`;

    await sendPushNotification(inviterPushToken, title, body, {
        type: response === 'accepted' ? 'invitation_accepted' : 'invitation_rejected',
        message: body
    });
}
