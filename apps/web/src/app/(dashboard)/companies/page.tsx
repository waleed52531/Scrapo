'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Building2, Pencil, Plus, Search, Trash2 } from 'lucide-react';
import { z } from 'zod';
import type { Company } from '@scrapo/types';
import { apiFetch, apiList } from '@/lib/api';
import { PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Modal } from '@/components/ui/modal';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ErrorState, LoadingState } from '@/components/data-states';

const schema = z.object({
  name: z.string().min(2, 'Company name is required.'),
  website: z.union([z.literal(''), z.url('Enter a valid URL.')]),
  country: z.string(), city: z.string(), employeeRange: z.string(), companyType: z.string(),
});
type FormValues = z.infer<typeof schema>;

export default function CompaniesPage() {
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<Company | null | undefined>(undefined);
  const query = useQuery({ queryKey: ['companies', search], queryFn: () => apiList<Company>(`/companies?limit=100&search=${encodeURIComponent(search)}`) });
  return <>
    <PageHeader title="Companies" description="Workspace-scoped organizations and agency partners." action={<Button onClick={() => setEditing(null)}><Plus className="h-4 w-4" />Add company</Button>} />
    <Card><CardContent className="p-0"><div className="border-b border-slate-100 p-4"><div className="relative max-w-sm"><Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" /><Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search companies…" className="pl-9" /></div></div>
      {query.isLoading ? <LoadingState /> : query.error || !query.data ? <div className="p-4"><ErrorState error={query.error} retry={() => void query.refetch()} /></div> : query.data.data.length === 0 ? <Empty /> : <Table><TableHeader><TableRow><TableHead>Company</TableHead><TableHead>Location</TableHead><TableHead>Size</TableHead><TableHead>Partnership fit</TableHead><TableHead className="w-24" /></TableRow></TableHeader><TableBody>{query.data.data.map((company) => <TableRow key={company.id}><TableCell><div className="font-medium text-slate-900">{company.name}</div><div className="text-xs text-slate-500">{company.domain ?? 'No domain'}</div></TableCell><TableCell>{[company.city, company.country].filter(Boolean).join(', ') || '—'}</TableCell><TableCell>{company.employeeRange ?? '—'}</TableCell><TableCell><span className="font-semibold">{company.partnershipFitScore}</span>/100</TableCell><TableCell><div className="flex justify-end gap-1"><Button variant="ghost" size="icon" onClick={() => setEditing(company)} aria-label={`Edit ${company.name}`}><Pencil className="h-4 w-4" /></Button><DeleteCompany company={company} /></div></TableCell></TableRow>)}</TableBody></Table>}
    </CardContent></Card>
    <CompanyModal value={editing} onClose={() => setEditing(undefined)} />
  </>;
}

function CompanyModal({ value, onClose }: { value: Company | null | undefined; onClose: () => void }) {
  const client = useQueryClient();
  const form = useForm<FormValues>({ resolver: zodResolver(schema), values: { name: value?.name ?? '', website: value?.website ?? '', country: value?.country ?? '', city: value?.city ?? '', employeeRange: value?.employeeRange ?? '', companyType: value?.companyType ?? 'AGENCY' } });
  const mutation = useMutation({ mutationFn: (data: FormValues) => apiFetch<Company>(value ? `/companies/${value.id}` : '/companies', { method: value ? 'PATCH' : 'POST', body: JSON.stringify(data) }), onSuccess: async () => { await client.invalidateQueries({ queryKey: ['companies'] }); onClose(); } });
  return <Modal open={value !== undefined} onClose={onClose} title={value ? 'Edit company' : 'Add company'} description="Core company data is stored by the independent API."><form className="grid gap-4 sm:grid-cols-2" onSubmit={form.handleSubmit((data) => mutation.mutate(data))}><Field label="Company name" error={form.formState.errors.name?.message}><Input {...form.register('name')} /></Field><Field label="Website" error={form.formState.errors.website?.message}><Input placeholder="https://example.com" {...form.register('website')} /></Field><Field label="Country"><Input {...form.register('country')} /></Field><Field label="City"><Input {...form.register('city')} /></Field><Field label="Employee range"><Input placeholder="11-50" {...form.register('employeeRange')} /></Field><Field label="Company type"><Input placeholder="AGENCY" {...form.register('companyType')} /></Field>{mutation.error && <p className="sm:col-span-2 text-sm text-red-600">{mutation.error.message}</p>}<div className="flex justify-end gap-2 sm:col-span-2"><Button type="button" variant="outline" onClick={onClose}>Cancel</Button><Button disabled={mutation.isPending}>{mutation.isPending ? 'Saving…' : 'Save company'}</Button></div></form></Modal>;
}

function DeleteCompany({ company }: { company: Company }) { const client = useQueryClient(); const mutation = useMutation({ mutationFn: () => apiFetch(`/companies/${company.id}`, { method: 'DELETE' }), onSuccess: () => client.invalidateQueries({ queryKey: ['companies'] }) }); return <Button variant="ghost" size="icon" disabled={mutation.isPending} onClick={() => { if (window.confirm(`Delete ${company.name}? Contacts and leads will be unassigned.`)) mutation.mutate(); }} aria-label={`Delete ${company.name}`}><Trash2 className="h-4 w-4 text-red-600" /></Button>; }
function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) { return <div className="space-y-2"><Label>{label}</Label>{children}{error && <p className="text-xs text-red-600">{error}</p>}</div>; }
function Empty() { return <div className="grid min-h-56 place-items-center text-center"><div><Building2 className="mx-auto h-8 w-8 text-slate-300" /><p className="mt-3 text-sm font-medium">No companies found</p><p className="mt-1 text-xs text-slate-500">Add your first company to begin.</p></div></div>; }
