"use client";

import dynamic from "next/dynamic";

export type { RouteData, LatLng } from "./RouteMap";

export const RouteMapDynamic = dynamic(
  () => import("./RouteMap").then((mod) => mod.RouteMap),
  { ssr: false, loading: () => <div className="h-[400px] rounded-xl bg-muted animate-pulse" /> },
);
