import { DateTime } from 'luxon'

export const ZONE = 'Asia/Karachi'

// <input type="datetime-local"> gives "2026-12-01T14:30" with no zone -> treat as PKT
export const parsePKT = (s: string) =>
  DateTime.fromISO(s, { zone: ZONE }).toUTC().toJSDate()

export const fmtPKT = (d: Date) =>
  DateTime.fromJSDate(d).setZone(ZONE).toFormat('dd LLL yyyy, hh:mm a') + ' PKT'

export const toInputPKT = (d: Date) =>
  DateTime.fromJSDate(d).setZone(ZONE).toFormat("yyyy-LL-dd'T'HH:mm")

export const fmtDateOnlyPKT = (d: Date) =>
  DateTime.fromJSDate(d).setZone(ZONE).toFormat('dd LLL yyyy')
