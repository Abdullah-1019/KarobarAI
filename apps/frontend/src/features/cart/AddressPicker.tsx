import { useState } from 'react';
import { Button, Radio, Typography } from 'antd';
import { useTranslation } from 'react-i18next';

import type { AddressDTO } from '@karobarai/shared';
import { Modal } from '../../components';
import { AddressForm } from './AddressForm';
import { SelectableOptionCard } from './SelectableOptionCard';

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
      <Radio.Group
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-3)', width: '100%' }}
      >
        {addresses.map((address) => (
          <SelectableOptionCard key={address.id} selected={value === address.id}>
            <Radio value={address.id} style={{ width: '100%' }}>
              <Typography.Text strong>{address.recipientName}</Typography.Text>
              {address.label ? ` (${address.label})` : ''}
              <div>
                {address.line1}
                {address.line2 ? `, ${address.line2}` : ''}, {address.city}, {address.province}
              </div>
              <Typography.Text type="secondary">{address.contactPhone}</Typography.Text>
            </Radio>
          </SelectableOptionCard>
        ))}
      </Radio.Group>

      <Button style={{ marginTop: 'var(--sp-3)' }} onClick={() => setModalOpen(true)}>
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
