import React from 'react';
import { Avatar } from '@mantine/core';

interface AvatarCircleProps {
  text?: string;
  size?: number | string;
  textSize?: string;
}

const AvatarCircle = ({ text = '', size = 40, textSize = '16px' }: AvatarCircleProps) => {
  const displayChar = text ? text.charAt(0).toUpperCase() : 'U';
  return (
    <Avatar
      size={size}
      radius="xl"
      color="#00c9ff"
      styles={{
        placeholder: { fontSize: textSize, fontWeight: 700 }
      }}
    >
      {displayChar}
    </Avatar>
  );
};

export default AvatarCircle;
