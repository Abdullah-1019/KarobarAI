import { Modal as AntModal, type ModalProps } from 'antd';

// Thin wrapper over AntD's Modal, themed via the app's ConfigProvider (UIUX §11) — kept as a
// shared shell so future features don't import `antd` Modal directly and can grow shared
// defaults (e.g. mandatory-reason confirms, §Admin) in one place.
export function Modal(props: ModalProps) {
  return <AntModal centered {...props} />;
}
