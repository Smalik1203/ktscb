/**
 * ClassBridge UI Kit
 * 
 * A comprehensive set of reusable UI components that use theme tokens.
 * Import components from this file to ensure consistent styling.
 * 
 * NEVER use raw View/Text/TouchableOpacity with hardcoded styles.
 * All visual styling should come from these components and theme tokens.
 * 
 * @example
 * ```tsx
 * import { 
 *   Container, 
 *   Stack, 
 *   Row, 
 *   Heading, 
 *   Body, 
 *   Button, 
 *   Card, 
 *   Badge,
 *   Chip,
 *   Input,
 *   Avatar,
 * } from '@/ui';
 * 
 * function MyScreen() {
 *   return (
 *     <Container scroll>
 *       <Stack spacing="lg">
 *         <Row spacing="md" align="center">
 *           <Avatar name="John Doe" />
 *           <Heading level={3}>Welcome, John</Heading>
 *         </Row>
 *         
 *         <Input 
 *           label="Search" 
 *           placeholder="Search..."
 *           leftIcon={<SearchIcon />}
 *         />
 *         
 *         <Card variant="elevated">
 *           <Body>Card content</Body>
 *           <Badge variant="success">Active</Badge>
 *         </Card>
 *         
 *         <Row spacing="md">
 *           <Button onPress={handleAction}>Primary</Button>
 *           <Button variant="secondary" onPress={handleCancel}>Cancel</Button>
 *         </Row>
 *       </Stack>
 *     </Container>
 *   );
 * }
 * ```
 */

// ============================================================================
// LAYOUT COMPONENTS
// ============================================================================

export { Container } from './Container';
export type { ContainerProps } from './Container';

export { Stack, Row, Spacer, Center } from './Stack';
export type { StackProps, RowProps, SpacerProps, CenterProps } from './Stack';

export { Divider } from './Divider';
export type { DividerProps } from './Divider';

export { SectionBlock } from './SectionBlock';
export type { SectionBlockProps } from './SectionBlock';

// ============================================================================
// TYPOGRAPHY COMPONENTS
// ============================================================================

export { 
  Heading, 
  Body, 
  Caption, 
  Label, 
  Overline, 
  Link,
  Text,
} from './Text';

export type { 
  HeadingProps, 
  BodyProps, 
  CaptionProps, 
  LabelProps, 
  OverlineProps,
  LinkProps,
  TextProps,
} from './Text';

// ============================================================================
// ICON COMPONENT
// ============================================================================

export { Icon } from './Icon';
export type { IconProps } from './Icon';
export type { MaterialIconName } from './iconMap';
export { LUCIDE_TO_MATERIAL } from './iconMap';

// ============================================================================
// INTERACTIVE COMPONENTS
// ============================================================================

export { Button } from './Button';
export type { ButtonProps, ButtonVariant, ButtonSize } from './Button';

export { IconButton } from './IconButton';
export type { IconButtonProps, IconButtonVariant, IconButtonSize } from './IconButton';

export { FAB } from './FAB';
export type { FABProps, FABGroupProps, FABGroupAction, FABSize, FABVariant } from './FAB';

// ============================================================================
// FORM COMPONENTS
// ============================================================================

export { Input } from './Input';
export type { InputProps, InputVariant, InputSize } from './Input';

export { Checkbox } from './Checkbox';
export type { CheckboxProps, CheckboxSize } from './Checkbox';

// ============================================================================
// DISPLAY COMPONENTS
// ============================================================================

export { Card } from './Card';
export type { CardProps, CardVariant, CardPadding } from './Card';

export { Badge } from './Badge';
export type { BadgeProps, BadgeVariant, BadgeSize } from './Badge';

export { Chip } from './Chip';
export type { ChipProps, ChipVariant, ChipSize } from './Chip';

export { Avatar } from './Avatar';
export type { AvatarProps, AvatarSize, AvatarVariant, AvatarStatus } from './Avatar';

// ============================================================================
// FEEDBACK COMPONENTS
// ============================================================================

export { ProgressBar } from './ProgressBar';
export type { ProgressBarProps, ProgressBarVariant, ProgressBarSize } from './ProgressBar';

export { Skeleton, SkeletonText, SkeletonAvatar, SkeletonCard } from './Skeleton';
export type { SkeletonProps, SkeletonTextProps, SkeletonAvatarProps, SkeletonCardProps } from './Skeleton';

// ============================================================================
// OVERLAY COMPONENTS
// ============================================================================

export { Portal, PortalProvider } from './Portal';
export { Modal } from './Modal';
export type { ModalProps, ModalSize } from './Modal';
export { Menu } from './Menu';
export type { MenuProps } from './Menu';
export { ToastProvider, useToast } from './Toast';
export type { ToastConfig, ToastType } from './Toast';

// ============================================================================
// STATE COMPONENTS
// ============================================================================

export { EmptyState } from './EmptyState';
export type { EmptyStateProps } from './EmptyState';
export { LoadingView } from './LoadingView';
export type { LoadingViewProps } from './LoadingView';
export { ErrorView } from './ErrorView';
export type { ErrorViewProps } from './ErrorView';
export { EmptyStateIllustration } from './EmptyStateIllustration';
export { SuccessAnimation } from './SuccessAnimation';
export type { SuccessAnimationProps } from './SuccessAnimation';
export { NetworkStatus } from './NetworkStatus';
export { ProgressRing } from './ProgressRing';
export type { ProgressRingProps } from './ProgressRing';
export { SegmentedControl } from './SegmentedControl';
export type { SegmentedControlProps, SegmentOption } from './SegmentedControl';

export { SearchBar } from './SearchBar';
export type { SearchBarProps } from './SearchBar';
