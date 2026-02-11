/**
 * Safe haptics wrapper — gracefully degrades on devices without a vibrator
 * (e.g. EDLA IFPs, some tablets, kiosks).
 *
 * Usage:
 *   import { safeImpact, safeNotification, safeSelection } from '@/utils/haptics';
 *   safeImpact('Light');
 *   safeNotification('Success');
 *   safeSelection();
 */
import * as Haptics from 'expo-haptics';

export async function safeImpact(
  style: Haptics.ImpactFeedbackStyle = Haptics.ImpactFeedbackStyle.Medium,
): Promise<void> {
  try {
    await Haptics.impactAsync(style);
  } catch {
    // Device has no vibrator — silently ignore
  }
}

export async function safeNotification(
  type: Haptics.NotificationFeedbackType = Haptics.NotificationFeedbackType.Success,
): Promise<void> {
  try {
    await Haptics.notificationAsync(type);
  } catch {
    // Device has no vibrator — silently ignore
  }
}

export async function safeSelection(): Promise<void> {
  try {
    await Haptics.selectionAsync();
  } catch {
    // Device has no vibrator — silently ignore
  }
}
