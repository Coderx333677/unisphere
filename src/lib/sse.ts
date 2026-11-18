// module-level singleton; use globalThis so dev HMR keeps one instance
const g = globalThis as unknown as {
  subs?: Map<string, Set<(d: string) => void>>
}
g.subs ??= new Map<string, Set<(d: string) => void>>()

export const subscribe = (key: string, send: (d: string) => void) => {
  const set = g.subs!.get(key) ?? new Set<(d: string) => void>()
  if (!g.subs!.has(key)) g.subs!.set(key, set)
  set.add(send)
  return () => set.delete(send)
}

export const publish = (key: string, data: object) => {
  const payload = JSON.stringify(data)
  g.subs!.get(key)?.forEach((s) => s(payload))
}
