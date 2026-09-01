import { AlertCircle, LoaderCircle } from 'lucide-react';
import { Button } from './ui/button';

export function LoadingState({ label = 'Loading…' }: { label?: string }) {
  return <div className="flex min-h-48 items-center justify-center gap-2 text-sm text-slate-500"><LoaderCircle className="h-4 w-4 animate-spin" />{label}</div>;
}

export function ErrorState({ error, retry }: { error: unknown; retry?: () => void }) {
  return <div className="flex min-h-48 flex-col items-center justify-center gap-3 rounded-xl border border-red-200 bg-red-50 p-6 text-center"><AlertCircle className="h-6 w-6 text-red-600" /><div><p className="font-medium text-red-900">Could not load this data</p><p className="mt-1 text-sm text-red-700">{error instanceof Error ? error.message : 'Unexpected request error.'}</p></div>{retry && <Button variant="outline" size="sm" onClick={retry}>Try again</Button>}</div>;
}
