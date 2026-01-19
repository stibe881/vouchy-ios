import React from 'react';
import { Ionicons } from '@expo/vector-icons';
import { StyleProp, TextStyle } from 'react-native';

interface IconProps {
  name: any; // Using any to avoid strict type checks on existing usage strings, though keyof typeof Ionicons.glyphMap is better
  size?: number;
  color?: string;
  style?: StyleProp<TextStyle>;
}

const Icon: React.FC<IconProps> = ({ name, size = 24, color = '#000', style }) => {
  return (
    <Ionicons
      name={name}
      size={size}
      color={color}
      style={style}
    />
  );
};

export default Icon;
