import * as functions from 'firebase-functions/v2/firestore';
import { getFirestore } from 'firebase-admin/firestore';
import { Expo, ExpoPushMessage, ExpoPushTicket } from 'expo-server-sdk';

const expo = new Expo();

export const sendPushOnNotifWrite = functions.onDocumentCreated(
  'users/{userId}/notifications/{notifId}',
  async (event) => {
    const db = getFirestore();
    const userId = event.params.userId;

    const snap = event.data;
    if (!snap) return;

    const notif = snap.data() as any;
    const type = notif?.type;
    const fromUserId = notif?.fromUserId;

    // Do not send push for reminders the user created for themself, etc.
    if (!type || type === 'eventReminder') return;

    // Pull all push tokens for the recipient
    const tokensSnap = await db.collection('users').doc(userId).collection('push_tokens').get();
    if (tokensSnap.empty) return;

    // Optional: fetch extra display info (club name, etc.)
    const clubName = notif?.clubName;
    const eventTitle = notif?.eventTitle;

    // Build a readable title/body based on your types
    let title = 'Vitola';
    let body = 'You have a new notification.';
    switch (type) {
      case 'like':
        title = 'New Like';
        body = 'Someone liked your post.';
        break;
      case 'comment':
        title = 'New Comment';
        body = 'You received a new comment.';
        break;
      case 'follow':
        title = 'New Follower';
        body = 'Someone started following you.';
        break;
      case 'invite':
        title = 'Club Invite';
        body = clubName ? `You’ve been invited to ${clubName}.` : 'You’ve been invited to a club.';
        break;
      case 'eventAttend':
        title = 'New Event Attendee';
        body = eventTitle ? `Someone is attending: ${eventTitle}` : 'Someone is attending your event.';
        break;
    }

    // Make messages
    const messages: ExpoPushMessage[] = [];
    tokensSnap.forEach((doc) => {
      const token = doc.data()?.expo as string | undefined;
      if (!token || !Expo.isExpoPushToken(token)) return;
      messages.push({
        to: token,
        title,
        body,
        data: {
          type,
          fromUserId,
          clubId: notif?.clubId || null,
          eventId: notif?.eventId || null,
        },
        // You can set channelId on Android once you create it client-side
      });
    });

    if (messages.length === 0) return;

    // Chunk & send
    const chunks = expo.chunkPushNotifications(messages);
    const tickets: ExpoPushTicket[] = [];
    for (const chunk of chunks) {
      try {
        const ticketChunk = await expo.sendPushNotificationsAsync(chunk);
        tickets.push(...ticketChunk);
      } catch (err) {
        console.error('[push] send error', err);
      }
    }

    // Clean up invalid tokens (optional)
    // (In production, also check receipts to prune)
    tickets.forEach((t, idx) => {
      const msg = messages[idx];
      if (t.status === 'error' && (t.details as any)?.error === 'DeviceNotRegistered') {
        const badToken = msg.to as string;
        db.collection('users').doc(userId).collection('push_tokens').doc(badToken).delete().catch(() => {});
      }
    });
  }
);