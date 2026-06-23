"use client";

import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

export interface MapMarker {
  lat: number;
  lng: number;
  label: string;
  sublabel?: string;
}

interface VilleMapProps {
  lat?: number;
  lng?: number;
  villeNom?: string;
  markers?: MapMarker[];
  height?: number;
  className?: string;
}

const TILES = {
  plan: {
    url: "https://{s}.tile.openstreetmap.fr/osmfr/{z}/{x}/{y}.png",
    attr: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> France',
    maxNative: 20,
  },
  satellite: {
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    attr: '&copy; <a href="https://www.esri.com/">Esri</a> — Esri, Maxar, Earthstar',
    maxNative: 19,
  },
  cadastre: {
    url: "https://data.geopf.fr/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=CADASTRALPARCELS.PARCELLAIRE_EXPRESS&STYLE=normal&TILEMATRIXSET=PM&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}&FORMAT=image/png",
    attr: '&copy; <a href="https://www.ign.fr/">IGN</a> Cadastre',
    maxNative: 20,
  },
  labels: {
    url: "https://{s}.basemaps.cartocdn.com/light_only_labels/{z}/{x}/{y}{r}.png",
    attr: '&copy; <a href="https://carto.com/">CARTO</a>',
    maxNative: 20,
  },
};

const MAX_ZOOM = 19;

const FS_ICON = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/><line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/></svg>`;
const FS_EXIT = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="4 14 10 14 10 20"/><polyline points="20 10 14 10 14 4"/><line x1="14" y1="10" x2="21" y2="3"/><line x1="3" y1="21" x2="10" y2="14"/></svg>`;

function markerIcon() {
  return L.divIcon({
    html: `<div style="background:#F97316;width:28px;height:28px;border-radius:50%;border:3px solid white;box-shadow:0 2px 6px rgba(0,0,0,.3)"></div>`,
    className: "",
    iconSize: [28, 28],
    iconAnchor: [14, 14],
  });
}

export function VilleMap({ lat, lng, villeNom, markers, height = 200, className = "" }: VilleMapProps) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<L.Map | null>(null);
  const [fullscreen, setFullscreen] = useState(false);

  const points: MapMarker[] = markers?.length
    ? markers
    : lat && lng ? [{ lat, lng, label: villeNom || "" }] : [];

  const pointsKey = points.map((p) => `${p.lat},${p.lng}`).join("|");

  // Init map once
  useEffect(() => {
    if (!mapRef.current || mapInstance.current) return;

    const map = L.map(mapRef.current, {
      center: [48.86, 2.35],
      zoom: 13,
      maxZoom: MAX_ZOOM,
      scrollWheelZoom: true,
      zoomControl: true,
      zoomAnimation: false,
      fadeAnimation: false,
    });

    const plan = L.tileLayer(TILES.plan.url, { attribution: TILES.plan.attr, maxNativeZoom: TILES.plan.maxNative, maxZoom: MAX_ZOOM });
    plan.addTo(map);

    const sat = L.tileLayer(TILES.satellite.url, { attribution: TILES.satellite.attr, maxNativeZoom: TILES.satellite.maxNative, maxZoom: MAX_ZOOM });
    const cadastre = L.tileLayer(TILES.cadastre.url, { attribution: TILES.cadastre.attr, maxNativeZoom: TILES.cadastre.maxNative, maxZoom: MAX_ZOOM, opacity: 0.5 });
    const labels = L.tileLayer(TILES.labels.url, { attribution: TILES.labels.attr, maxNativeZoom: TILES.labels.maxNative, maxZoom: MAX_ZOOM, pane: "overlayPane" });

    L.control.layers(
      { Plan: plan, Satellite: sat },
      { "Cadastre (parcelles)": cadastre, "Noms de rues": labels },
      { position: "topright", collapsed: false },
    ).addTo(map);

    // Fullscreen button
    const Ctrl = L.Control.extend({
      options: { position: "bottomright" as L.ControlPosition },
      onAdd() {
        const btn = L.DomUtil.create("button", "leaflet-bar leaflet-control");
        btn.style.cssText = "width:40px;height:40px;background:#fff;border:none;border-radius:8px;cursor:pointer;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 6px rgba(0,0,0,.2)";
        btn.innerHTML = FS_ICON;
        btn.title = "Plein écran";
        btn.setAttribute("data-fs-btn", "1");
        L.DomEvent.disableClickPropagation(btn);
        btn.addEventListener("click", () => {
          if (!wrapperRef.current) return;
          if (!document.fullscreenElement) wrapperRef.current.requestFullscreen().catch(() => {});
          else document.exitFullscreen().catch(() => {});
        });
        return btn;
      },
    });
    new Ctrl().addTo(map);

    mapInstance.current = map;

    return () => {
      map.remove();
      mapInstance.current = null;
    };
  }, []);

  // Update markers when points change
  useEffect(() => {
    const map = mapInstance.current;
    if (!map || points.length === 0) return;

    map.eachLayer((layer) => {
      if (layer instanceof L.Marker) map.removeLayer(layer);
    });

    const icon = markerIcon();
    const bounds = L.latLngBounds([]);

    points.forEach((p) => {
      const popup = p.sublabel
        ? `<strong>${p.label}</strong><br/><span style="font-size:11px;color:#666">${p.sublabel}</span>`
        : `<strong>${p.label}</strong>`;
      L.marker([p.lat, p.lng], { icon }).addTo(map).bindPopup(popup);
      bounds.extend([p.lat, p.lng]);
    });

    if (points.length === 1) {
      map.setView([points[0].lat, points[0].lng], 15, { animate: false });
    } else {
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 14, animate: false });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pointsKey]);

  // Fullscreen events
  useEffect(() => {
    function onFs() {
      const fs = !!document.fullscreenElement;
      setFullscreen(fs);
      setTimeout(() => mapInstance.current?.invalidateSize(), 50);
      const btn = mapInstance.current?.getContainer().querySelector("[data-fs-btn]");
      if (btn) {
        btn.innerHTML = fs ? FS_EXIT : FS_ICON;
        (btn as HTMLElement).title = fs ? "Quitter le plein écran" : "Plein écran";
      }
    }
    document.addEventListener("fullscreenchange", onFs);
    return () => document.removeEventListener("fullscreenchange", onFs);
  }, []);

  if (points.length === 0) return null;

  return (
    <div
      ref={wrapperRef}
      className={fullscreen ? "" : `rounded-xl overflow-hidden border border-border ${className}`}
      style={fullscreen ? { width: "100%", height: "100%", background: "#000" } : { position: "relative", zIndex: 0 }}
    >
      <div
        ref={mapRef}
        style={fullscreen ? { width: "100%", height: "100%" } : { height, width: "100%" }}
      />
    </div>
  );
}
