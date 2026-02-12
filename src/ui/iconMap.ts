/**
 * Icon Name Map
 * 
 * Maps lucide-react-native icon names to MaterialIcons equivalents.
 * Used during migration and by the Icon component.
 * 
 * MaterialIcons reference: https://fonts.google.com/icons
 */

import type { ComponentProps } from 'react';
import type MaterialIcons from '@expo/vector-icons/MaterialIcons';

/** All valid MaterialIcons names */
export type MaterialIconName = ComponentProps<typeof MaterialIcons>['name'];

/**
 * Complete mapping of every lucide icon used in the codebase
 * to its closest MaterialIcons equivalent.
 */
export const LUCIDE_TO_MATERIAL: Record<string, MaterialIconName> = {
  // Navigation & Actions
  ArrowLeft: 'arrow-back',
  ArrowRight: 'arrow-forward',
  ChevronDown: 'keyboard-arrow-down',
  ChevronLeft: 'chevron-left',
  ChevronRight: 'chevron-right',
  ChevronUp: 'keyboard-arrow-up',
  Menu: 'menu',
  MoreHorizontal: 'more-horiz',
  MoreVertical: 'more-vert',
  X: 'close',

  // Common Actions
  Check: 'check',
  Plus: 'add',
  Minus: 'remove',
  Edit: 'edit',
  Edit2: 'edit',
  Edit3: 'edit',
  Trash2: 'delete',
  Save: 'save',
  Copy: 'content-copy',
  Download: 'download',
  Upload: 'upload',
  Send: 'send',
  Search: 'search',
  Filter: 'filter-list',
  RefreshCw: 'refresh',
  RotateCcw: 'replay',

  // Status & Feedback
  AlertCircle: 'error',
  AlertTriangle: 'warning',
  CheckCircle: 'check-circle',
  CheckCircle2: 'check-circle',
  XCircle: 'cancel',
  Info: 'info',
  HelpCircle: 'help',
  Circle: 'radio-button-unchecked',

  // Communication
  Bell: 'notifications',
  Mail: 'email',
  Megaphone: 'campaign',
  MessageCircle: 'chat-bubble',
  MessageSquare: 'chat',
  MessageSquareMore: 'question-answer',
  Mic: 'mic',
  Inbox: 'inbox',

  // Users & Auth
  User: 'person',
  Users: 'group',
  UserCheck: 'how-to-reg',
  Lock: 'lock',
  Eye: 'visibility',
  EyeOff: 'visibility-off',
  Shield: 'shield',
  ShieldX: 'remove-moderator',
  GraduationCap: 'school',

  // Calendar & Time
  Calendar: 'event',
  CalendarDays: 'date-range',
  CalendarRange: 'date-range',
  Clock: 'schedule',

  // Files & Documents
  FileText: 'description',
  FileCheck: 'fact-check',
  Paperclip: 'attach-file',
  ClipboardList: 'assignment',

  // Media
  Image: 'image',
  ImageIcon: 'image',
  ImagePlus: 'add-photo-alternate',
  Camera: 'camera-alt',
  Video: 'videocam',
  Play: 'play-arrow',

  // Finance
  CreditCard: 'credit-card',
  DollarSign: 'attach-money',
  Receipt: 'receipt',
  Wallet: 'account-balance-wallet',

  // Charts & Analytics
  TrendingUp: 'trending-up',
  TrendingDown: 'trending-down',
  BarChart3: 'bar-chart',
  Activity: 'show-chart',

  // Learning & Education
  BookOpen: 'menu-book',
  BookMarked: 'bookmark',
  NotebookText: 'auto-stories',
  Lightbulb: 'lightbulb',
  Brain: 'psychology',

  // Science & Subjects
  Calculator: 'calculate',
  FlaskConical: 'science',
  Languages: 'translate',
  Globe: 'public',
  Palette: 'palette',
  Music: 'music-note',
  Dna: 'biotech',
  Dumbbell: 'fitness-center',

  // Misc
  Bot: 'smart-toy',
  Coffee: 'local-cafe',
  Flame: 'local-fire-department',
  Flag: 'flag',
  Hash: 'tag',
  LayoutDashboard: 'dashboard',
  List: 'list',
  ListTodo: 'playlist-add-check',
  MapPin: 'location-on',
  Monitor: 'desktop-windows',
  Package: 'inventory-2',
  Pin: 'push-pin',
  Printer: 'print',
  Settings: 'settings',
  Settings2: 'settings',
  Share2: 'share',
  Smartphone: 'smartphone',
  Sparkles: 'auto-awesome',
  Star: 'star',
  Target: 'gps-fixed',
  Wifi: 'wifi',
  WifiOff: 'wifi-off',
  Zap: 'bolt',
  Award: 'emoji-events',
};
