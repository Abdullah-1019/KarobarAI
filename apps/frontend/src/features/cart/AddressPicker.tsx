import { useState } from 'react';
import { Button, Radio, Typography } from 'antd';
import { useTranslation } from 'react-i18next';

import type { AddressDTO } from '@karobarai/shared';
import { Modal } from '../../components';
import { AddressForm } from './AddressForm';

interface AddressPickerProps {
  addresses: AddressDTO[];
  value: string | undefined;
  onChange: (id: string) => void;
  onAddressCreated: (address: AddressDTO) => void;
}

export function AddressPicker({ addresses, value, onChange, onAddressCreated }: AddressPickerProps) {
  const { t } = useTranslation(['cart']);
  const [modalOpen, setModalOpen] = useState(false);

  return (
    <div>
      <Typography.Text strong>{t('address.title')}</Typography.Text>
      <Radio.Group
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8 }}
      >
        {addresses.map((address) => (
          <Radio key={address.id} value={address.id}>
            <Typography.Text strong>{address.recipientName}</Typography.Text>
            {address.label ? ` (${address.label})` : ''}
            <div>
              {address.line1}
              {address.line2 ? `, ${address.line2}` : ''}, {address.city}, {address.province}
            </div>
            <div>{address.contactPhone}</div>
          </Radio>
        ))}
      </Radio.Group>

      <Button style={{ marginTop: 12 }} onClick={() => setModalOpen(true)}>
        {t('address.addNew')}
      </Button>

      <Modal open={modalOpen} onCancel={() => setModalOpen(false)} footer={null} title={t('address.addNew')} destroyOnClose>
        <AddressForm
          onCreated={(address) => {
            onAddressCreated(address);
            setModalOpen(false);
          }}
        />
      </Modal>
    </div>
  );
}
