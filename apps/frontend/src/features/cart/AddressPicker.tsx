import { useState } from 'react';
import { Check, MapPin, Plus } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import type { AddressDTO } from '@karobarai/shared';
import { Modal } from '../../components';
import { AddressForm } from './AddressForm';
import { formatAddress } from './addressFormat';

interface AddressPickerProps {
  addresses: AddressDTO[];
  value: string | undefined;
  onChange: (id: string) => void;
  onAddressCreated: (address: AddressDTO) => void;
}

// Checkout step 1: saved addresses as selectable cards (a real radio inside each, so arrow keys and
// screen readers work as a radio group) plus a dashed "Add new address" card that opens the form.
// Selected is ink, never persimmon (DESIGN.md "Selected-Is-Ink").
export function AddressPicker({ addresses, value, onChange, onAddressCreated }: AddressPickerProps) {
  const { t } = useTranslation(['cart']);
  const [modalOpen, setModalOpen] = useState(false);

  return (
    <div>
      <div className="addr-grid" role="radiogroup" aria-label={t('address.title')}>
        {addresses.map((address) => (
          <label key={address.id} className="addr-card" data-selected={value === address.id || undefined}>
            <input type="radio" name="delivery-address" value={address.id} checked={value === address.id} onChange={() => onChange(address.id)} />
            <span className="addr-card__top">
              <span className="addr-card__icon" aria-hidden="true">
                <MapPin size={18} strokeWidth={1.8} />
              </span>
              <strong className="addr-card__name" dir="auto">
                {address.recipientName}
              </strong>
              {address.label && <span className="addr-card__label">{address.label}</span>}
              <span className="addr-card__check" aria-hidden="true">
                <Check size={14} strokeWidth={3} />
              </span>
            </span>
            <span className="addr-card__line" dir="auto">
              {formatAddress(address)}
            </span>
            {address.contactPhone && (
              <span className="addr-card__phone" dir="ltr">
                {address.contactPhone}
              </span>
            )}
          </label>
        ))}
        <button type="button" className="addr-add" onClick={() => setModalOpen(true)}>
          <Plus size={20} strokeWidth={2} aria-hidden="true" />
          {t('address.addNew')}
        </button>
      </div>

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
