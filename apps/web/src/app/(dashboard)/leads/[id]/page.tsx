'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Building2, Mail, MapPin, UserRound } from 'lucide-react';
import type { Company, Contact, Lead } from '@scrapo/types';
import { apiFetch } from '@/lib/api';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ErrorState, LoadingState } from '@/components/data-states';

type LeadDetail = Lead & {
  company: Company | null;
  contact: Contact | null;
  signals: Array<{ id: string; source: string; signalType: string; content: string; sourceUrl: string | null }>;
  scores: Array<{ id: string; buyingIntent: number; mobileRelevance: number; agencyFit: number; decisionMakerQuality: number; contactability: number; recency: number; companyQuality: number; countryPriority: number; overall: number; explanation: string | null }>;
  activities: Array<{ id: string; type: string; description: string; createdAt: string }>;
};

export default function LeadDetailPage() {
  const { id } = useParams<{ id: string }>();
  const query = useQuery({ queryKey: ['lead', id], queryFn: () => apiFetch<LeadDetail>(`/leads/${id}`) });
  if (query.isLoading) return <LoadingState label="Loading lead…" />;
  if (query.error || !query.data) return <ErrorState error={query.error} retry={() => void query.refetch()} />;
  const lead = query.data; const score = lead.scores[0];
  return <><Button asChild variant="ghost" size="sm" className="mb-4"><Link href="/leads"><ArrowLeft className="h-4 w-4" />Back to leads</Link></Button><div className="mb-6 flex flex-col justify-between gap-4 sm:flex-row"><div><div className="flex flex-wrap items-center gap-2"><h1 className="text-2xl font-semibold">{lead.company?.name ?? lead.title}</h1><Badge>{lead.overallScore} {lead.temperature}</Badge></div><p className="mt-2 text-sm text-slate-500">{lead.leadType.replaceAll('_', ' ')} · {lead.primarySource}</p></div><Badge className="self-start">{lead.status}</Badge></div>
    <div className="grid gap-6 xl:grid-cols-[2fr_1fr]"><div className="space-y-6"><Card><CardHeader><CardTitle>Opportunity</CardTitle></CardHeader><CardContent><p className="text-sm leading-6 text-slate-700">{lead.opportunitySummary ?? 'No opportunity summary yet.'}</p>{lead.recommendedPitch && <div className="mt-4 rounded-lg bg-blue-50 p-4"><p className="text-xs font-semibold uppercase tracking-wide text-blue-700">Recommended approach</p><p className="mt-2 text-sm text-blue-950">{lead.recommendedPitch}</p></div>}</CardContent></Card><Card><CardHeader><CardTitle>Score</CardTitle></CardHeader><CardContent>{score ? <div className="grid gap-3 sm:grid-cols-2">{[['Buying intent', score.buyingIntent, 25], ['Mobile relevance', score.mobileRelevance, 20], ['Agency fit', score.agencyFit, 15], ['Decision maker', score.decisionMakerQuality, 10], ['Contactability', score.contactability, 10], ['Recency', score.recency, 10], ['Company', score.companyQuality, 5], ['Country', score.countryPriority, 5]].map(([label, value, max]) => <div key={label as string} className="flex justify-between border-b border-slate-100 py-2 text-sm"><span className="text-slate-600">{label}</span><span className="font-medium">{value}/{max}</span></div>)}<p className="sm:col-span-2 text-xs text-slate-500">{score.explanation}</p></div> : <p className="text-sm text-slate-500">No score breakdown is available. AI scoring begins in Phase 2.</p>}</CardContent></Card></div>
      <div className="space-y-6"><Card><CardHeader><CardTitle>Company</CardTitle></CardHeader><CardContent className="space-y-3 text-sm"><Row icon={Building2} text={lead.company?.name ?? 'Not assigned'} /><Row icon={MapPin} text={[lead.company?.city, lead.company?.country].filter(Boolean).join(', ') || 'Location unknown'} /></CardContent></Card><Card><CardHeader><CardTitle>Contact</CardTitle></CardHeader><CardContent className="space-y-3 text-sm"><Row icon={UserRound} text={lead.contact ? `${lead.contact.fullName} · ${lead.contact.role ?? 'Role unknown'}` : 'Not assigned'} /><Row icon={Mail} text={lead.contact?.email ?? 'Email unavailable'} /></CardContent></Card></div></div>
  </>;
}

function Row({ icon: Icon, text }: { icon: typeof Building2; text: string }) { return <div className="flex items-center gap-2 text-slate-600"><Icon className="h-4 w-4 text-slate-400" />{text}</div>; }
