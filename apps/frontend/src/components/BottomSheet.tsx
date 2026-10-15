import React from 'react';
import { Drawer } from 'antd';

interface BottomSheetProps {
  open: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  /** `bottom` for mobile sheets, `right` for desktop side panels. */
  placement?: 'bottom' | 'right';
  height?: number | string;
  width?: number | string;
}

export function BottomSheet({
  open,
  onClose,
  title,
  children,
  footer,
  placement = 'bottom',
  height,
  width,
}: BottomSheetProps) {
  return (
    <Drawer
      open={open}
      onClose={onClose}
      title={title}
      footer={footer}
      placement={placement}
      height={height}
      width={width}
      rootClassName="karobarai-sheet"
      destroyOnClose
      styles={{ body: { padding: 'var(--sp-5) var(--sp-4)' } }}
    >
      {children}
    </Drawer>
  );
}
