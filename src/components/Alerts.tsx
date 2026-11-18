export default function Alerts({
  searchParams,
}: {
  searchParams: { error?: string; ok?: string }
}) {
  if (searchParams.error)
    return <div className="alert alert-error">{searchParams.error}</div>
  if (searchParams.ok)
    return <div className="alert alert-ok">{searchParams.ok}</div>
  return null
}
