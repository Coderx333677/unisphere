export class HttpError extends Error {
  status: number
  constructor(status: number, message = '') {
    super(message)
    this.status = status
  }
}

export const errQS = (msg: string, extra: Record<string, string> = {}) => {
  const p = new URLSearchParams({ error: msg, ...extra })
  return p.toString()
}
