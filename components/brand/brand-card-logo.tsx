"use client"

import { BrandLogo } from "@/components/brand/brand-logo"

/**
 * Het merklogo op een staande merkkaart (/products), linksboven op de foto:
 * een rond label van 80px, voor elk merk hetzelfde. Groot genoeg om ook een
 * fijn logo te lezen, klein genoeg om de foto niet af te dekken (een disc
 * tile van 100px zou ~40% van de kaartbreedte innemen). Een logo met een
 * eigen achtergrond (Dedon, Flos) vult de cirkel; een logo op wit of
 * doorzichtig (Tribù, Compass Pools) staat met marge op de lichte schijf.
 */
export function BrandCardLogo({ logoUrl, name }: { logoUrl: string; name: string }) {
  return <BrandLogo logoUrl={logoUrl} name={name} size={80} />
}
