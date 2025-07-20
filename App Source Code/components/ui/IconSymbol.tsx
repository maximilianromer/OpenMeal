// Uses MaterialIcons across all platforms and environments

import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { ComponentProps } from 'react';
import { OpaqueColorValue, type StyleProp, type TextStyle } from 'react-native';

type IconMapping = Record<string, ComponentProps<typeof MaterialIcons>['name']>;
type IconSymbolName = keyof typeof MAPPING;

/**
 * Add your SF Symbols to Material Icons mappings here.
 * - see Material Icons in the [Icons Directory](https://icons.expo.fyi).
 * - see SF Symbols in the [SF Symbols](https://developer.apple.com/sf-symbols/) app.
 */
const MAPPING = {
  'house.fill': 'home',
  'paperplane.fill': 'send',
  'chevron.left.forwardslash.chevron.right': 'code',
  'chevron.right': 'chevron-right',
  'camera.fill': 'camera-alt',
  'list.bullet': 'list',
  'person.fill': 'person',
  'photo.fill': 'photo',
  'xmark': 'close',
  'photo': 'photo-library',
  'plus': 'add',
  'trash': 'delete',
  'edit': 'edit',
  'checkmark': 'check',
  'key': 'key',
  'wand.and.stars': 'auto-fix-high',
  'bell': 'notifications',
  'bell.edit': 'edit-notifications',
  'target': 'emoji-events',
  'link': 'link',
  'arrow.up.circle': 'sync',
  'heart': 'favorite',
  'heart.outline': 'favorite-border',
  'checkmark.circle': 'check-circle',
  'square.and.arrow.down': 'download',
  'psychology': 'psychology',
  'insights': 'insights',
  'recommend': 'recommend',
  'relog': 'replay',
  'rebase-edit': 'content-copy',
} as const;

/**
 * An icon component that uses Material Icons across all platforms and environments.
 * This ensures a consistent look across platforms.
 * Icon `name`s are based on SF Symbols and require manual mapping to Material Icons.
 */
export function IconSymbol({
  name,
  size = 24,
  color,
  style,
}: {
  name: IconSymbolName;
  size?: number;
  color: string | OpaqueColorValue;
  style?: StyleProp<TextStyle>;
}) {
  const materialIconName = MAPPING[name] || 'help';
  return <MaterialIcons color={color} size={size} name={materialIconName} style={style} />;
}
