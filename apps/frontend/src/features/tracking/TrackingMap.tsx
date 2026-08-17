import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { MapContainer, Marker, TileLayer } from 'react-leaflet';
import { useTranslation } from 'react-i18next';

interface TrackingMapProps {
  lastLocation: { lat: string; lng: string } | null;
}

// A plain colored dot, not an image asset — sidesteps the well-known Leaflet+bundler default
// marker-icon path issue (Leaflet's default icon references image files that Vite doesn't
// resolve the way Leaflet's CSS expects). Brand green (not AntD's default blue) via a real CSS
// var() reference — this HTML string is inserted into the app's own DOM by Leaflet, so the
// custom property still resolves normally, light or dark.
const markerIcon = L.divIcon({
  className: 'karobarai-tracking-marker',
  html: '<div style="width:16px;height:16px;border-radius:50%;background:var(--brand-primary);border:2px solid #fff;box-shadow:0 0 0 2px var(--brand-primary);"></div>',
  iconSize: [16, 16],
  iconAnchor: [8, 8],
});

// REQ-NF-Safety-004 graceful degradation: renders a real map only when a last-known location
// exists; otherwise a plain text panel — never a broken/blank map area. The timeline (rendered
// alongside this, not inside it) always carries the reliable status information regardless.
export function TrackingMap({ lastLocation }: TrackingMapProps) {
  const { t } = useTranslation(['orders']);

  if (!lastLocation) {
    return (
      <div
        style={{
          padding: 'var(--sp-6)',
          textAlign: 'center',
          background: 'var(--bg-sunken)',
          borderRadius: 'var(--radius-md)',
          color: 'var(--text-secondary)',
        }}
      >
        {t('tracking.mapUnavailable')}
      </div>
    );
  }

  const lat = Number(lastLocation.lat);
  const lng = Number(lastLocation.lng);

  return (
    <MapContainer center={[lat, lng]} zoom={12} style={{ height: 280, width: '100%', borderRadius: 'var(--radius-md)' }}>
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <Marker position={[lat, lng]} icon={markerIcon} />
    </MapContainer>
  );
}
