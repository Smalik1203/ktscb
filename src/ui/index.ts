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
// INTERACTIVE COMPONENTS
// ============================================================================

export { Button } from './Button';
export type { ButtonProps, ButtonVariant, ButtonSize } from './Button';

export { IconButton } from './IconButton';
export type { IconButtonProps, IconButtonVariant, IconButtonSize } from './IconButton';

// ============================================================================
// FORM COMPONENTS
// ============================================================================

export { Input } from './Input';
export type { InputProps, InputVariant, InputSize } from './Input';

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
// STATE COMPONENTS (from existing)
// ============================================================================

export { EmptyState } from '../components/ui/EmptyState';
export { LoadingView } from '../components/ui/LoadingView';
export { ErrorView } from '../components/ui/ErrorView';
