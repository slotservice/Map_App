'use client';

import { useEffect, useMemo, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { MarkerColor, Store } from '@map-app/shared';

const COLOR_HEX: Record<MarkerColor, string> = {
  blue: '#2563eb',
  orange: '#f97316',
  yellow: '#eab308',
  red: '#dc2626',
};

const COLOR_LABEL: Record<MarkerColor, string> = {
  blue: 'Needs scheduled',
  orange: 'Mixed (some pre-completed)',
  yellow: 'In progress',
  red: 'Completed',
};

export function MapMarkerView({
  stores,
  mapId,
  height = 600,
}: {
  stores: Store[];
  mapId: string;
  height?: number;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);

  const validStores = useMemo(
    () =>
      stores.filter(
        (s) =>
          typeof s.latitude === 'number' &&
          typeof s.longitude === 'number' &&
          !Number.isNaN(s.latitude) &&
          !Number.isNaN(s.longitude),
      ),
    [stores],
  );

  // One-time: create the Leaflet map.
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = L.map(containerRef.current, {
      center: [39, -98],
      zoom: 4,
      scrollWheelZoom: true,
    });
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(map);
    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Render markers whenever the store list changes.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const layer = L.layerGroup().addTo(map);

    validStores.forEach((store) => {
      const color = COLOR_HEX[store.markerColor];
      const label = escapeHtml(store.storeNumber);
      // Approximate width: ~7px per char + 14px horizontal padding, min 28px.
      // Avoids Leaflet's default 0×0 fallback which would offset the marker
      // from its coordinate and break Playwright's visibility heuristic.
      const labelWidth = Math.max(28, store.storeNumber.length * 7 + 14);
      const icon = L.divIcon({
        className: 'fcfm-store-marker',
        html: `<div style="background:${color};color:#fff;font-weight:700;font-size:11px;border-radius:6px;border:1px solid rgba(0,0,0,0.25);box-shadow:0 1px 3px rgba(0,0,0,0.3);white-space:nowrap;display:flex;align-items:center;justify-content:center;width:100%;height:100%;box-sizing:border-box;">${label}</div>`,
        iconSize: [labelWidth, 22],
        iconAnchor: [labelWidth / 2, 11],
      });
      const marker = L.marker([store.latitude, store.longitude], { icon }).addTo(layer);

      const completionLink =
        store.markerColor === 'red'
          ? `<a href="/maps/${mapId}/stores/${store.id}/completion" style="color:#ed7332;text-decoration:underline">View completion</a>`
          : '';

      const popupHtml = `
        <div style="font-size:13px;min-width:180px;">
          <div style="font-weight:600;margin-bottom:2px;">#${escapeHtml(store.storeNumber)} ${escapeHtml(store.storeName)}</div>
          ${store.address ? `<div style="color:#6b7280;margin-bottom:4px;">${escapeHtml(store.address)}${store.state ? ', ' + escapeHtml(store.state) : ''}</div>` : ''}
          <div style="display:inline-block;background:${color};color:#fff;font-size:11px;padding:1px 6px;border-radius:4px;margin-bottom:4px;">${COLOR_LABEL[store.markerColor]}</div>
          ${completionLink ? `<div>${completionLink}</div>` : ''}
        </div>
      `;
      marker.bindPopup(popupHtml);
    });

    if (validStores.length > 0) {
      const bounds = L.latLngBounds(validStores.map((s) => [s.latitude, s.longitude] as [number, number]));
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 14 });
    }

    return () => {
      layer.remove();
    };
  }, [validStores, mapId]);

  return (
    <div className="space-y-3">
      <Legend total={stores.length} mapped={validStores.length} />
      <div
        ref={containerRef}
        style={{ height: `${height}px`, width: '100%' }}
        className="rounded-lg border"
        role="application"
        aria-label="Map of stores"
      />
    </div>
  );
}

function Legend({ total, mapped }: { total: number; mapped: number }) {
  const colors: MarkerColor[] = ['blue', 'orange', 'yellow', 'red'];
  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-muted-foreground">
      {colors.map((c) => (
        <span key={c} className="flex items-center gap-1.5">
          <span
            className="inline-block h-3 w-3 rounded-sm"
            style={{ backgroundColor: COLOR_HEX[c] }}
          />
          {COLOR_LABEL[c]}
        </span>
      ))}
      <span className="ml-auto">
        {mapped} of {total} stores plotted
        {mapped < total && (
          <span className="ml-1 text-amber-600">
            ({total - mapped} missing lat/lon)
          </span>
        )}
      </span>
    </div>
  );
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
