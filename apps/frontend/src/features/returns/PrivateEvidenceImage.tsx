import { useEffect, useState } from 'react';
import { Alert, Spin } from 'antd';
import { useTranslation } from 'react-i18next';

import { apiClient } from '../../api';
import { ProductThumbnail } from '../../components';

/** Fetch protected return evidence with the existing Bearer-token interceptor. */
export function PrivateEvidenceImage({ url, size = 120 }: { url: string; size?: number }) {
  const { t } = useTranslation('returns');
  const [objectUrl, setObjectUrl] = useState<string>();
  const [error, setError] = useState(false);
  useEffect(() => {
    if (!url.startsWith('/api/v1/')) return;
    let current = true;
    let created: string | undefined;
    setError(false);
    void apiClient.get<Blob>(url.slice('/api/v1'.length), { responseType: 'blob' })
      .then((response) => {
        created = URL.createObjectURL(response.data);
        if (current) setObjectUrl(created);
        else URL.revokeObjectURL(created);
      })
      .catch(() => { if (current) setError(true); });
    return () => { current = false; if (created) URL.revokeObjectURL(created); };
  }, [url]);
  if (!url.startsWith('/api/v1/')) return <ProductThumbnail src={url} size={size} />;
  if (error) return <Alert type="warning" message={t('sellerDetail.evidenceUnavailable')} />;
  return objectUrl ? <ProductThumbnail src={objectUrl} size={size} /> : <Spin />;
}
