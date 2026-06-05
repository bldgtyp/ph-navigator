// Per-user dimension display-format preference for the Aperture Builder.
//
// Phase doc P0.10 asks for two server-persisted keys
// (`aperture_builder_dim_format_si` / `_ip`) on the user-preferences
// store. V2's preference store is currently server-backed only for the
// SI/IP toggle; adding two more server keys would require backend
// schema work (session payload, repository, migrations) that's out of
// scope for this UI sub-PR. We persist to `localStorage` for now and
// surface a clean hook contract so a future swap to server-backed
// storage doesn't ripple through call sites.

import { useCallback, useEffect, useState } from "react";
import type {
  DisplayFormat,
  IpDisplayFormat,
  SiDisplayFormat,
} from "../../../lib/units/length/types";
import { useUnitPreference } from "../../../lib/units/useUnitPreference";

const SI_KEY = "phn.apertures.dim_format_si";
const IP_KEY = "phn.apertures.dim_format_ip";

const DEFAULT_SI: SiDisplayFormat = "mm";
const DEFAULT_IP: IpDisplayFormat = "ft-in";

const SI_VALUES: ReadonlySet<string> = new Set<SiDisplayFormat>(["mm", "cm", "m"]);
const IP_VALUES: ReadonlySet<string> = new Set<IpDisplayFormat>(["in", "ft", "ft-in", "in-frac"]);

function readSi(): SiDisplayFormat {
  if (typeof window === "undefined") return DEFAULT_SI;
  const stored = window.localStorage.getItem(SI_KEY);
  return stored && SI_VALUES.has(stored) ? (stored as SiDisplayFormat) : DEFAULT_SI;
}

function readIp(): IpDisplayFormat {
  if (typeof window === "undefined") return DEFAULT_IP;
  const stored = window.localStorage.getItem(IP_KEY);
  return stored && IP_VALUES.has(stored) ? (stored as IpDisplayFormat) : DEFAULT_IP;
}

export type ApertureDimFormatState = {
  system: "si" | "ip";
  format: DisplayFormat;
  setSiFormat: (format: SiDisplayFormat) => void;
  setIpFormat: (format: IpDisplayFormat) => void;
};

export function useApertureDimFormat(): ApertureDimFormatState {
  const { unitSystem } = useUnitPreference();
  const system: "si" | "ip" = unitSystem === "IP" ? "ip" : "si";

  const [siFormat, setSiFormatState] = useState<SiDisplayFormat>(readSi);
  const [ipFormat, setIpFormatState] = useState<IpDisplayFormat>(readIp);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(SI_KEY, siFormat);
  }, [siFormat]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(IP_KEY, ipFormat);
  }, [ipFormat]);

  const setSiFormat = useCallback((next: SiDisplayFormat) => setSiFormatState(next), []);
  const setIpFormat = useCallback((next: IpDisplayFormat) => setIpFormatState(next), []);

  return {
    system,
    format: system === "si" ? siFormat : ipFormat,
    setSiFormat,
    setIpFormat,
  };
}
