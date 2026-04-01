export default function AdminLoading() {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-sm">
      <div className="text-center">
        <div className="mx-auto h-9 w-9 animate-spin rounded-full border-2 border-slate-500/40 border-t-slate-200" />
        <p className="mt-3 text-sm font-medium text-slate-200">Loading...</p>
      </div>
    </div>
  )
}
