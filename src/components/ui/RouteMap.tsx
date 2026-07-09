"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { toast } from "sonner";
import type { MapMarker } from "./VilleMap";

export type LatLng = [number, number]; // [lat, lng]

export interface RouteData {
  waypoints: LatLng[];
  route_geometry: LatLng[];
  distance_m: number | null;
  duration_s: number | null;
  nom?: string | null;
  date_effective?: string | null;
}

interface RouteMapProps {
  markers: MapMarker[];
  route: RouteData | null;
  isEditable: boolean;
  onSave?: (data: RouteData) => Promise<void> | void;
  onDelete?: () => Promise<void> | void;
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
    attr: '&copy; <a href="https://www.esri.com/">Esri</a>',
    maxNative: 19,
  },
};

const MAX_ZOOM = 19;
const OSRM_URL = "https://router.project-osrm.org/route/v1/foot";

const FS_ICON = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/><line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/></svg>`;
const FS_EXIT = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="4 14 10 14 10 20"/><polyline points="20 10 14 10 14 4"/><line x1="14" y1="10" x2="21" y2="3"/><line x1="3" y1="21" x2="10" y2="14"/></svg>`;
const RECENTER_ICON = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="2" x2="12" y2="6"/><line x1="12" y1="18" x2="12" y2="22"/><line x1="2" y1="12" x2="6" y2="12"/><line x1="18" y1="12" x2="22" y2="12"/><circle cx="12" cy="12" r="2" fill="currentColor"/></svg>`;

const MIN_ZOOM = 10; // ~département — empêche de dézoomer trop loin

function markerIcon(color = "#F97316") {
  return L.divIcon({
    html: `<div style="background:${color};width:28px;height:28px;border-radius:50%;border:3px solid white;box-shadow:0 2px 6px rgba(0,0,0,.3)"></div>`,
    className: "",
    iconSize: [28, 28],
    iconAnchor: [14, 14],
  });
}

function waypointIcon(num: number) {
  return L.divIcon({
    html: `<div style="background:#1E3A5F;color:white;width:24px;height:24px;border-radius:50%;border:2px solid white;box-shadow:0 2px 4px rgba(0,0,0,.3);display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:bold">${num}</div>`,
    className: "",
    iconSize: [24, 24],
    iconAnchor: [12, 12],
  });
}

function formatDistance(m: number | null): string {
  if (m == null) return "—";
  return m < 1000 ? `${Math.round(m)} m` : `${(m / 1000).toFixed(1)} km`;
}

function formatDuration(s: number | null): string {
  if (s == null) return "—";
  const min = Math.round(s / 60);
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const rem = min % 60;
  return rem === 0 ? `${h}h` : `${h}h${String(rem).padStart(2, "0")}`;
}

/** Snap un point unique sur la rue la plus proche via OSRM /nearest.
 *  Retourne les coordonnées d'origine si OSRM échoue (fallback silencieux). */
async function snapToRoad(lat: number, lng: number): Promise<LatLng> {
  try {
    const res = await fetch(
      `https://router.project-osrm.org/nearest/v1/foot/${lng},${lat}?number=1`,
    );
    if (!res.ok) return [lat, lng];
    const json = await res.json();
    const loc = json?.waypoints?.[0]?.location;
    if (!Array.isArray(loc) || loc.length !== 2) return [lat, lng];
    return [loc[1], loc[0]];
  } catch {
    return [lat, lng];
  }
}

/** Appelle OSRM pour calculer le trajet à pied entre les waypoints avec retry */
async function computeRoute(waypoints: LatLng[]): Promise<{
  geometry: LatLng[];
  snapped: LatLng[];
  distance: number;
  duration: number;
} | null> {
  if (waypoints.length < 2) return null;
  const coords = waypoints.map(([lat, lng]) => `${lng},${lat}`).join(";");
  const url = `${OSRM_URL}/${coords}?overview=full&geometries=geojson`;

  // 3 tentatives avec backoff exponentiel (0ms, 800ms, 2400ms)
  // pour absorber les rate limits du serveur OSRM public.
  for (let attempt = 0; attempt < 3; attempt++) {
    if (attempt > 0) {
      await new Promise((r) => setTimeout(r, 800 * attempt * attempt));
    }
    try {
      const res = await fetch(url);
      if (res.status === 429 || res.status === 503) continue; // rate limit → retry
      if (!res.ok) return null;
      const json = await res.json();
      if (!json.routes || json.routes.length === 0) return null;
      const r = json.routes[0];
      const geometry: LatLng[] = r.geometry.coordinates.map((c: [number, number]) => [c[1], c[0]]);
      const snapped: LatLng[] = (json.waypoints ?? []).map(
        (w: { location: [number, number] }) => [w.location[1], w.location[0]] as LatLng,
      );
      return { geometry, snapped, distance: Math.round(r.distance), duration: Math.round(r.duration) };
    } catch {
      // Erreur réseau — on continue vers la tentative suivante.
    }
  }
  return null;
}

export function RouteMap({
  markers,
  route,
  isEditable,
  onSave,
  onDelete,
  height = 400,
  className = "",
}: RouteMapProps) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<L.Map | null>(null);
  const villeMarkersLayer = useRef<L.LayerGroup | null>(null);
  const routeMarkersLayer = useRef<L.LayerGroup | null>(null);
  const routeLineLayer = useRef<L.Polyline | null>(null);
  // Bornes des villes planifiées — servent au bouton "Recentrer" et à la
  // limitation du pan (maxBounds).
  const villeBoundsRef = useRef<L.LatLngBounds | null>(null);

  const [editMode, setEditMode] = useState(false);
  const [waypoints, setWaypoints] = useState<LatLng[]>(route?.waypoints ?? []);
  const [routeGeometry, setRouteGeometry] = useState<LatLng[]>(route?.route_geometry ?? []);
  const [distance, setDistance] = useState<number | null>(route?.distance_m ?? null);
  const [duration, setDuration] = useState<number | null>(route?.duration_s ?? null);
  const [computing, setComputing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [nomInput, setNomInput] = useState("");
  const [dateInput, setDateInput] = useState("");

  // Sync avec les props si elles changent (semaine différente)
  useEffect(() => {
    setWaypoints(route?.waypoints ?? []);
    setRouteGeometry(route?.route_geometry ?? []);
    setDistance(route?.distance_m ?? null);
    setDuration(route?.duration_s ?? null);
    setNomInput(route?.nom ?? "");
    setDateInput(route?.date_effective ?? "");
  }, [route]);

  const markersKey = markers.map((m) => `${m.lat},${m.lng}`).join("|");
  // Sert à re-cadrer la carte quand un parcours est chargé (changement de semaine).
  const routeInitialKey = (route?.waypoints ?? []).map((w) => `${w[0]},${w[1]}`).join("|");

  // Init map
  useEffect(() => {
    if (!mapRef.current || mapInstance.current) return;

    const map = L.map(mapRef.current, {
      center: [48.86, 2.35],
      zoom: 13,
      minZoom: MIN_ZOOM,   // ~département — blocage dézoom trop large
      maxZoom: MAX_ZOOM,
      scrollWheelZoom: true,
      zoomAnimation: false,
      fadeAnimation: false,
    });

    const plan = L.tileLayer(TILES.plan.url, { attribution: TILES.plan.attr, maxNativeZoom: TILES.plan.maxNative, maxZoom: MAX_ZOOM });
    plan.addTo(map);

    const sat = L.tileLayer(TILES.satellite.url, { attribution: TILES.satellite.attr, maxNativeZoom: TILES.satellite.maxNative, maxZoom: MAX_ZOOM });

    L.control.layers(
      { Plan: plan, Satellite: sat },
      {},
      { position: "topright", collapsed: false },
    ).addTo(map);

    villeMarkersLayer.current = L.layerGroup().addTo(map);
    routeMarkersLayer.current = L.layerGroup().addTo(map);

    // Bouton "Recentrer" — cadrage instantané sur les villes planifiées.
    const RecenterCtrl = L.Control.extend({
      options: { position: "bottomright" as L.ControlPosition },
      onAdd() {
        const btn = L.DomUtil.create("button", "leaflet-bar leaflet-control");
        btn.style.cssText = "width:40px;height:40px;background:#fff;border:none;border-radius:8px;cursor:pointer;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 6px rgba(0,0,0,.2);margin-bottom:6px;color:#1E3A5F";
        btn.innerHTML = RECENTER_ICON;
        btn.title = "Recentrer sur les villes planifiées";
        L.DomEvent.disableClickPropagation(btn);
        btn.addEventListener("click", () => {
          const b = villeBoundsRef.current;
          if (!b || !mapInstance.current) return;
          // maxZoom élevé : si un parcours est chargé, on zoome fort dessus
          // pour voir les rues et le tracé orange.
          mapInstance.current.fitBounds(b, { padding: [40, 40], maxZoom: 17, animate: true });
        });
        return btn;
      },
    });
    new RecenterCtrl().addTo(map);

    // Bouton plein écran
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
      villeMarkersLayer.current = null;
      routeMarkersLayer.current = null;
      routeLineLayer.current = null;
    };
  }, []);

  // Gestion des évts fullscreen
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

  // Update ville markers
  useEffect(() => {
    const map = mapInstance.current;
    const layer = villeMarkersLayer.current;
    if (!map || !layer) return;
    layer.clearLayers();
    if (markers.length === 0) return;
    const bounds = L.latLngBounds([]);
    const icon = markerIcon("#F97316");
    markers.forEach((m) => {
      const popup = m.sublabel
        ? `<strong>${m.label}</strong><br/><span style="font-size:11px;color:#666">${m.sublabel}</span>`
        : `<strong>${m.label}</strong>`;
      L.marker([m.lat, m.lng], { icon }).addTo(layer).bindPopup(popup);
      bounds.extend([m.lat, m.lng]);
    });
    // Priorité au parcours : si un tracé est déjà chargé, on cadre dessus
    // (avec zoom fort ~17) pour que l'utilisateur voit directement les
    // rues et le tracé orange dès l'ouverture de la page.
    const routeWps = route?.waypoints ?? [];
    const hasRoute = routeWps.length >= 2;
    if (hasRoute) {
      const routeBounds = L.latLngBounds(routeWps.map((w) => L.latLng(w[0], w[1])));
      villeBoundsRef.current = routeBounds;
      map.fitBounds(routeBounds, { padding: [40, 40], maxZoom: 17, animate: false });
    } else if (markers.length === 1) {
      const single = L.latLng(markers[0].lat, markers[0].lng);
      villeBoundsRef.current = single.toBounds(10_000);
      map.setView([markers[0].lat, markers[0].lng], 14, { animate: false });
    } else {
      villeBoundsRef.current = bounds;
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 15, animate: false });
    }
    // Limitation du pan : ~30 km autour du barycentre pour éviter la dérive.
    const padded = villeBoundsRef.current.pad(2.5);
    map.setMaxBounds(padded);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [markersKey, routeInitialKey]);

  // Update waypoint markers
  useEffect(() => {
    const layer = routeMarkersLayer.current;
    if (!layer) return;
    layer.clearLayers();
    waypoints.forEach((wp, i) => {
      const marker = L.marker(wp, { icon: waypointIcon(i + 1), draggable: editMode });
      marker.addTo(layer);
      if (editMode) {
        marker.on("dragend", async (e) => {
          const ll = e.target.getLatLng();
          // Snap immédiat sur la rue la plus proche pour que le numéro
          // reste toujours sur la route empruntée par le tracé orange.
          const snapped = await snapToRoad(ll.lat, ll.lng);
          setWaypoints((prev) => {
            const next = [...prev];
            next[i] = snapped;
            return next;
          });
        });
        marker.on("click", () => {
          if (confirm(`Supprimer le point ${i + 1} du parcours ?`)) {
            setWaypoints((prev) => prev.filter((_, j) => j !== i));
          }
        });
        marker.bindTooltip(`Point ${i + 1} · cliquer pour supprimer`, { direction: "top" });
      } else {
        marker.bindTooltip(`Point ${i + 1}`, { direction: "top" });
      }
    });
  }, [waypoints, editMode]);

  // Draw route line
  useEffect(() => {
    const map = mapInstance.current;
    if (!map) return;
    if (routeLineLayer.current) {
      routeLineLayer.current.remove();
      routeLineLayer.current = null;
    }
    if (routeGeometry.length < 2) return;
    routeLineLayer.current = L.polyline(routeGeometry, {
      color: "#F97316",
      weight: 5,
      opacity: 0.85,
      lineCap: "round",
      lineJoin: "round",
    }).addTo(map);
  }, [routeGeometry]);

  // Add waypoint on map click in edit mode
  useEffect(() => {
    const map = mapInstance.current;
    if (!map) return;
    const handler = async (e: L.LeafletMouseEvent) => {
      if (!editMode) return;
      // Snap immédiat sur la rue la plus proche : le numéro apparaît
      // directement sur une rue empruntable, jamais dans un bâtiment
      // ou un jardin.
      const snapped = await snapToRoad(e.latlng.lat, e.latlng.lng);
      setWaypoints((prev) => [...prev, snapped]);
    };
    map.on("click", handler);
    return () => { map.off("click", handler); };
  }, [editMode]);

  // Recompute route when waypoints change (debounced)
  useEffect(() => {
    if (waypoints.length < 2) {
      setRouteGeometry([]);
      setDistance(null);
      setDuration(null);
      return;
    }
    let cancelled = false;
    const t = setTimeout(async () => {
      setComputing(true);
      const r = await computeRoute(waypoints);
      if (cancelled) return;
      if (r) {
        setRouteGeometry(r.geometry);
        setDistance(r.distance);
        setDuration(r.duration);
        // Repositionne les waypoints sur les positions "snappées" par OSRM
        // pour que les numéros collent au tracé orange. Tolérance ~1m pour
        // éviter les boucles infinies dues à l'imprécision flottante.
        if (r.snapped.length === waypoints.length) {
          const TOL = 0.00001; // ~1 mètre
          const needsSnap = r.snapped.some((wp, i) =>
            Math.abs(wp[0] - waypoints[i][0]) > TOL ||
            Math.abs(wp[1] - waypoints[i][1]) > TOL,
          );
          if (needsSnap) setWaypoints(r.snapped);
        }
      } else {
        toast.error("Impossible de calculer le trajet — vérifiez la connexion.");
      }
      setComputing(false);
    }, 400);
    return () => { cancelled = true; clearTimeout(t); };
  }, [waypoints]);

  function openSaveDialog() {
    // Valeurs par défaut si non défini
    if (!nomInput && !route?.nom) setNomInput("");
    if (!dateInput && !route?.date_effective) {
      const today = new Date();
      const pad = (n: number) => String(n).padStart(2, "0");
      setDateInput(`${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`);
    }
    setSaveDialogOpen(true);
  }

  const handleConfirmSave = useCallback(async () => {
    if (!onSave) return;
    if (!nomInput.trim()) {
      toast.error("Veuillez donner un nom au parcours");
      return;
    }
    setSaving(true);
    try {
      await onSave({
        waypoints,
        route_geometry: routeGeometry,
        distance_m: distance,
        duration_s: duration,
        nom: nomInput.trim(),
        date_effective: dateInput || null,
      });
      toast.success("Parcours sauvegardé");
      setEditMode(false);
      setSaveDialogOpen(false);
    } catch (err) {
      const e = err as { message?: string; code?: string; details?: string };
      console.error("[Parcours] save error", err);
      const msg = e?.message || e?.details || "Erreur inconnue";
      if (msg.toLowerCase().includes("does not exist") || e?.code === "42P01") {
        toast.error("Table parcours_hebdo introuvable. Exécutez la migration SQL sur Supabase.");
      } else {
        toast.error(`Erreur de sauvegarde : ${msg}`);
      }
    }
    setSaving(false);
  }, [onSave, waypoints, routeGeometry, distance, duration, nomInput, dateInput]);

  const handleClear = useCallback(() => {
    setWaypoints([]);
    setRouteGeometry([]);
    setDistance(null);
    setDuration(null);
  }, []);

  const handleDelete = useCallback(async () => {
    if (!onDelete) return;
    if (!confirm("Supprimer le parcours enregistré ?")) return;
    setSaving(true);
    try {
      await onDelete();
      handleClear();
      setEditMode(false);
      toast.success("Parcours supprimé");
    } catch {
      toast.error("Erreur lors de la suppression");
    }
    setSaving(false);
  }, [onDelete, handleClear]);

  const hasSavedRoute = (route?.waypoints?.length ?? 0) > 0;

  return (
    <div className={`space-y-3 ${className}`}>
      {/* Nom du parcours (si défini) */}
      {route?.nom && !editMode && (
        <div className="flex items-center gap-2">
          <span className="text-xs uppercase tracking-wide text-muted-foreground font-semibold">Parcours</span>
          <span className="text-sm font-bold text-foreground">{route.nom}</span>
          {route.date_effective && (
            <span className="text-xs text-muted-foreground">
              · {new Date(route.date_effective).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}
            </span>
          )}
        </div>
      )}

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2 justify-between">
        <div className="flex items-center gap-3 text-sm">
          {routeGeometry.length > 0 && (
            <>
              <span className="text-muted-foreground">
                <span className="font-semibold text-foreground">{formatDistance(distance)}</span> · {formatDuration(duration)} à pied
              </span>
              {computing && <span className="text-xs text-muted-foreground">(recalcul…)</span>}
            </>
          )}
          {waypoints.length === 0 && !editMode && (
            <span className="text-muted-foreground text-xs">
              {isEditable
                ? "Aucun parcours défini. Cliquez sur \"Tracer un parcours\" pour commencer."
                : "Aucun parcours défini pour cette semaine."}
            </span>
          )}
        </div>
        {isEditable && (
          <div className="flex flex-wrap gap-2">
            {!editMode ? (
              <>
                <button
                  type="button"
                  onClick={() => setEditMode(true)}
                  className="px-3 py-1.5 rounded-xl bg-[#F97316] hover:bg-[#EA580C] text-white text-sm font-medium transition-colors"
                >
                  {hasSavedRoute ? "Modifier le parcours" : "Tracer un parcours"}
                </button>
                {hasSavedRoute && onDelete && (
                  <button
                    type="button"
                    onClick={handleDelete}
                    disabled={saving}
                    className="px-3 py-1.5 rounded-xl border border-border bg-card hover:bg-secondary text-sm font-medium transition-colors"
                  >
                    Supprimer
                  </button>
                )}
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={handleClear}
                  className="px-3 py-1.5 rounded-xl border border-border bg-card hover:bg-secondary text-sm font-medium transition-colors"
                >
                  Effacer
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setWaypoints(route?.waypoints ?? []);
                    setRouteGeometry(route?.route_geometry ?? []);
                    setDistance(route?.distance_m ?? null);
                    setDuration(route?.duration_s ?? null);
                    setEditMode(false);
                  }}
                  className="px-3 py-1.5 rounded-xl border border-border bg-card hover:bg-secondary text-sm font-medium transition-colors"
                >
                  Annuler
                </button>
                <button
                  type="button"
                  onClick={openSaveDialog}
                  disabled={saving || computing || waypoints.length < 2}
                  className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-sm font-medium transition-colors"
                >
                  {saving ? "Sauvegarde…" : "Enregistrer"}
                </button>
              </>
            )}
          </div>
        )}
      </div>

      {editMode && (
        <div className="rounded-xl border border-orange-200 bg-orange-50 dark:bg-orange-950/30 dark:border-orange-800 p-3 text-xs text-orange-800 dark:text-orange-200">
          <strong>Mode édition</strong> — Cliquez sur la carte pour ajouter des étapes. Glissez un point pour le déplacer. Cliquez sur un point pour le supprimer. Le trajet suit automatiquement les rues.
        </div>
      )}

      <div
        ref={wrapperRef}
        className={fullscreen ? "" : "rounded-xl overflow-hidden border border-border"}
        style={fullscreen ? { width: "100%", height: "100%", background: "#000" } : { position: "relative", zIndex: 0 }}
      >
        <div ref={mapRef} style={fullscreen ? { width: "100%", height: "100%", cursor: editMode ? "crosshair" : "" } : { height, width: "100%", cursor: editMode ? "crosshair" : "" }} />
      </div>

      {/* Modale de sauvegarde du parcours (nom + date) */}
      {saveDialogOpen && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 p-4" onClick={(e) => { if (e.target === e.currentTarget) setSaveDialogOpen(false); }}>
          <div className="bg-card rounded-2xl shadow-xl max-w-md w-full p-6 space-y-4">
            <div>
              <h3 className="text-lg font-bold flex items-center gap-2">
                <span className="w-8 h-8 rounded-xl bg-[#F97316]/10 flex items-center justify-center">
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#F97316" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 17a2 2 0 1 1-4 0M20 17V5a2 2 0 0 0-2-2h-4"/><path d="M8 17a2 2 0 1 1-4 0M8 17V7a2 2 0 0 1 2-2h4"/></svg>
                </span>
                Enregistrer le parcours
              </h3>
              <p className="text-xs text-muted-foreground mt-1">
                Donnez un nom à ce parcours pour le retrouver facilement dans l&apos;historique.
              </p>
            </div>

            <div className="space-y-2">
              <label htmlFor="parcours-nom" className="text-sm font-medium">Nom du parcours *</label>
              <input
                id="parcours-nom"
                type="text"
                autoFocus
                value={nomInput}
                onChange={(e) => setNomInput(e.target.value)}
                placeholder="Ex : Tournée Arnouville centre"
                className="w-full h-10 rounded-xl border border-border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#F97316] focus:border-transparent"
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="parcours-date" className="text-sm font-medium">Date effective</label>
              <input
                id="parcours-date"
                type="date"
                value={dateInput}
                onChange={(e) => { setDateInput(e.target.value); (e.target as HTMLInputElement).blur(); }}
                onKeyDown={(e) => e.preventDefault()}
                className="w-full h-10 rounded-xl border border-border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#F97316] focus:border-transparent"
              />
              <p className="text-xs text-muted-foreground">
                Jour où le parcours doit être effectué (facultatif).
              </p>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setSaveDialogOpen(false)}
                className="px-4 py-2 rounded-xl border border-border bg-card hover:bg-secondary text-sm font-medium transition-colors"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={handleConfirmSave}
                disabled={saving || !nomInput.trim()}
                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-sm font-medium transition-colors"
              >
                {saving ? "Sauvegarde…" : "Confirmer et enregistrer"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
