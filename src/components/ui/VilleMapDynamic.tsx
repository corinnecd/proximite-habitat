"use client";

import dynamic from "next/dynamic";

export type { MapMarker } from "./VilleMap";

export const VilleMapDynamic = dynamic(
  () => import("./VilleMap").then((mod) => mod.VilleMap),
  {
    ssr: false,
    loading: () => <div className="h-[200px] rounded-xl bg-muted" />,
  },
);
