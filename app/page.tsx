'use client';
import { useEffect, useState, type FormEvent } from 'react';
import {
  ShieldCheck,
  ArrowUpRight,
  FileCheck2,
  Plus,
  Search,
  FolderOpen,
  CircleCheck,
  Sparkles,
  ChevronRight,
  Clock3,
  Upload,
  Download,
  ListChecks,
  Activity,
  ArrowLeft,
  FileText,
  Users,
  Settings2,
  Check,
  Loader2,
  ExternalLink,
  AlertCircle,
  Pencil,
} from 'lucide-react';
import {
  Sidebar,
  SidebarProvider,
  SidebarHeader,
  SidebarContent,
  SidebarFooter,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarInset,
  SidebarTrigger,
} from '@/components/ui/sidebar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { Progress } from '@/components/ui/progress';
import {
  type Bid,
  type Requirement,
  type Run,
  type Finding,
  type Document,
  categories,
  statusLabels,
  latestRun,
  currentRuns,
} from '@/lib/types';

type Modal =
  | 'bid'
  | 'bidder'
  | 'requirement'
  | 'upload'
  | 'finding'
  | 'document'
  | 'drafts'
  | 'settings'
  | null;
type Choice = { value: string; label: string };
const date = (s: string) =>
  new Date(s.length === 10 ? s + 'T12:00:00+05:30' : s).toLocaleDateString(
    'en-IN',
    {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      timeZone: 'Asia/Kolkata',
    },
  );
const time = (s: string) =>
  new Date(s).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
function Picker({
  value,
  onChange,
  choices,
  label,
}: {
  value: string;
  onChange: (v: string) => void;
  choices: Choice[];
  label: string;
}) {
  return (
    <Select
      value={value}
      onValueChange={(v) => v !== null && onChange(String(v))}
    >
      <SelectTrigger aria-label={label} className="picker">
        <SelectValue>
          {choices.find((c) => c.value === value)?.label || label}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {choices.map((c) => (
          <SelectItem key={c.value} value={c.value}>
            {c.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
async function api<T>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(
    '/api/' + path,
    body === undefined
      ? { cache: 'no-store' }
      : {
          method: 'POST',
          headers:
            body instanceof FormData
              ? {}
              : { 'Content-Type': 'application/json' },
          body: body instanceof FormData ? body : JSON.stringify(body),
        },
  );
  const data = (await res.json()) as T & { error?: string };
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}
function Empty({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="welcome">
      <div className="welcome-icon">
        <FileCheck2 size={30} />
      </div>
      <h2>{title}</h2>
      <p>{description}</p>
      {children}
    </div>
  );
}
export default function Home() {
  const [bids, setBids] = useState<Bid[]>([]),
    [bid, setBid] = useState<Bid | null>(null),
    [tab, setTab] = useState('review'),
    [search, setSearch] = useState(''),
    [loading, setLoading] = useState(true),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [notice, setNotice] = useState(''),
    [ai, setAi] = useState(false),
    [user, setUser] = useState('Reviewer');
  const [modal, setModal] = useState<Modal>(null),
    [bidderId, setBidderId] = useState(''),
    [filter, setFilter] = useState('all'),
    [mode, setMode] = useState('assisted'),
    [category, setCategory] = useState('Eligibility'),
    [kind, setKind] = useState('tender'),
    [mandatory, setMandatory] = useState(true);
  const [focused, setFocused] = useState<Finding | null>(null),
    [document, setDocument] = useState<Document | null>(null),
    [editReq, setEditReq] = useState<Requirement | null>(null),
    [reviewStatus, setReviewStatus] = useState('clarification'),
    [drafts, setDrafts] = useState<Requirement[]>([]),
    [chosen, setChosen] = useState<string[]>([]);
  useEffect(() => {
    Promise.all([
      api<Bid[]>('bids'),
      api<{ ai: boolean; user: string }>('status'),
    ])
      .then(([b, s]) => {
        setBids(b);
        setAi(s.ai);
        setUser(s.user);
        if (s.ai) setMode('ai');
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);
  const run = bid ? latestRun(bid, bidderId) : undefined;
  const stale =
    !!bid && !!run && run.contentVersion !== bid.data.contentVersion;
  const allRuns = bids.flatMap(currentRuns),
    reviewed = allRuns.reduce((n, r) => n + Object.keys(r.reviews).length, 0),
    total = allRuns.reduce((n, r) => n + r.findings.length, 0);
  const attention = allRuns.reduce(
    (n, r) =>
      n +
      r.findings.filter(
        (f) =>
          !r.reviews[f.requirementId] ||
          r.reviews[f.requirementId].status !== 'compliant',
      ).length,
    0,
  );
  function update(next: Bid) {
    setBid(next);
    setBids((old) => [next, ...old.filter((b) => b.id !== next.id)]);
    if (!next.data.bidders.some((b) => b.id === bidderId))
      setBidderId(next.data.bidders[0]?.id || '');
  }
  async function act(fn: () => Promise<void>) {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong');
    } finally {
      setBusy(false);
    }
  }
  function open(next: Modal) {
    setError('');
    setModal(next);
  }
  async function selectBid(id: string) {
    await act(async () => {
      const next = await api<Bid>('bids/' + id);
      update(next);
      setBidderId(next.data.bidders[0]?.id || '');
      setTab('review');
      setFilter('all');
    });
  }
  async function mutate(action: string, body: unknown, success: string) {
    if (!bid) return;
    update(await api<Bid>('bids/' + bid.id + '/' + action, body));
    setModal(null);
    setNotice(success);
  }
  async function formSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    await act(async () => {
      if (modal === 'bid') {
        const next = await api<Bid>('bids', Object.fromEntries(form));
        update(next);
        setTab('requirements');
        setModal(null);
        setNotice('Bid created. Add its tender and requirements.');
      } else if (modal === 'bidder')
        await mutate('bidders', { name: form.get('name') }, 'Bidder added.');
      else if (modal === 'requirement')
        await mutate(
          editReq ? 'edit-requirement' : 'requirements',
          {
            ...Object.fromEntries(form),
            category,
            mandatory,
            ...(editReq ? { id: editReq.id } : {}),
          },
          'Requirement saved. Previous verification runs are now stale.',
        );
      else if (modal === 'upload') {
        form.set('kind', kind);
        form.set('bidderId', bidderId);
        await mutate(
          'documents',
          form,
          'Document uploaded and text extracted.',
        );
      } else if (modal === 'finding' && run && focused)
        await mutate(
          'review',
          {
            runId: run.id,
            requirementId: focused.requirementId,
            status: reviewStatus,
            note: form.get('note'),
          },
          'Reviewer decision recorded in the audit trail.',
        );
    });
  }
  function startReq(req?: Requirement) {
    setEditReq(req || null);
    setCategory(req?.category || 'Eligibility');
    setMandatory(req?.mandatory ?? true);
    open('requirement');
  }
  const visible = bids.filter((b) =>
    (b.title + ' ' + b.reference + ' ' + b.buyer)
      .toLowerCase()
      .includes(search.toLowerCase()),
  );
  const stats = bid
    ? ([
        ['Requirements', String(bid.data.requirements.length), ListChecks],
        [
          'Bidder documents',
          String(
            bid.data.documents.filter((d) => d.kind === 'evidence').length,
          ),
          FileText,
        ],
        ['Bidders', String(bid.data.bidders.length), Users],
        [
          'Reviewed',
          run && !stale
            ? Object.keys(run.reviews).length + '/' + run.findings.length
            : '—',
          CircleCheck,
        ],
      ] as const)
    : ([
        ['Active bids', String(bids.length), FolderOpen],
        ['Requirements reviewed', String(reviewed), FileCheck2],
        ['Needs attention', String(attention), Clock3],
        [
          'Review coverage',
          total ? Math.round((reviewed / total) * 100) + '%' : '—',
          CircleCheck,
        ],
      ] as const);
  return (
    <SidebarProvider>
      <Sidebar>
        <SidebarHeader>
          <div className="brand">
            <ShieldCheck />
            <strong>
              BidScope<span>GeM COMPLIANCE</span>
            </strong>
          </div>
        </SidebarHeader>
        <SidebarContent>
          <div className="nav-label">WORKSPACE</div>
          <SidebarMenu>
            {[
              {
                name: 'Bid workspace',
                icon: FolderOpen,
                active: !bid,
                onClick: () => setBid(null),
              },
              {
                name: 'Compliance review',
                icon: ListChecks,
                active: !!bid && tab === 'review',
                onClick: () => {
                  if (bid) setTab('review');
                  else if (bids[0]) void selectBid(bids[0].id);
                  else open('bid');
                },
              },
              {
                name: 'Audit trail',
                icon: Activity,
                active: !!bid && tab === 'audit',
                onClick: () => {
                  if (bid) setTab('audit');
                  else setNotice('Open a bid to view its audit trail.');
                },
              },
            ].map((item) => (
              <SidebarMenuItem key={item.name}>
                <SidebarMenuButton
                  isActive={item.active}
                  onClick={item.onClick}
                  disabled={busy}
                >
                  <item.icon />
                  <span>{item.name}</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
          <div className="nav-divider" />
          <div className="nav-label">CONFIGURATION</div>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton onClick={() => open('settings')}>
                <Settings2 />
                <span>AI & workspace</span>
                <span className={'nav-dot ' + (ai ? 'ready' : '')} />
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarContent>
        <SidebarFooter>
          <div className="workspace-note">
            <ShieldCheck /> Evidence-led decisions
            <p>Check the source. Record the reasoning. Keep the history.</p>
          </div>
          <div className="user-profile">
            <span className="avatar">{user.slice(0, 1).toUpperCase()}</span>
            <div>
              <strong>My workspace</strong>
              <small title={user}>{user}</small>
            </div>
          </div>
        </SidebarFooter>
      </Sidebar>
      <SidebarInset>
        <header className="topbar">
          <div className="flex items-center gap-3">
            <SidebarTrigger />
            <span>Procurement workspace</span>
            <ChevronRight size={15} />
            <span>{bid ? 'Bid review' : 'Overview'}</span>
          </div>
          <span className="small-badge">PRIVATE WORKSPACE</span>
        </header>
        <main className="main">
          {bid && (
            <button className="back-link" onClick={() => setBid(null)}>
              <ArrowLeft size={15} /> All bids
            </button>
          )}
          <div className="eyebrow">
            {bid ? bid.reference : 'BID INTELLIGENCE / OVERVIEW'}
          </div>
          <div className="page-heading">
            <div>
              <h1>{bid ? bid.title : 'Every bid. A clearer decision.'}</h1>
              <p>
                {bid ? (
                  <>
                    {bid.buyer} <span className="dot-separator">·</span>{' '}
                    Deadline {date(bid.deadline)}{' '}
                    {bid.data.demo && (
                      <span className="tag amber">Sample data</span>
                    )}
                  </>
                ) : (
                  'Bring tender requirements and bidder evidence into one review.'
                )}
              </p>
            </div>
            {bid ? (
              <a
                className="outline-button"
                href={'/api/bids/' + bid.id + '/report'}
              >
                <Download size={16} /> Export report
              </a>
            ) : (
              <Button
                className="primary"
                onClick={() => open('bid')}
                disabled={busy}
              >
                <Plus /> New bid
              </Button>
            )}
          </div>
          {error && (
            <div className="error" role="alert">
              <AlertCircle size={18} />
              {error}
            </div>
          )}
          {notice && (
            <div className="notice" role="status">
              <Check size={18} />
              {notice}
              <button
                aria-label="Dismiss notification"
                onClick={() => setNotice('')}
              >
                ×
              </button>
            </div>
          )}
          <div className="stats">
            {stats.map(([label, value, Icon]) => (
              <div className="stat" key={label}>
                <span>
                  {label}
                  <Icon size={19} />
                </span>
                <strong>{value}</strong>
              </div>
            ))}
          </div>
          {loading ? (
            <div className="panel loading">
              <Loader2 className="spin" /> Loading your workspace…
            </div>
          ) : !bid ? (
            <>
              <section className="panel">
                <div className="panel-heading">
                  <h2>
                    Your bids <span className="count">{bids.length}</span>
                  </h2>
                  <div className="search-field">
                    <Search size={16} />
                    <Input
                      aria-label="Search bids"
                      placeholder="Search bids…"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                    />
                  </div>
                </div>
                {visible.length ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Bid / reference</TableHead>
                        <TableHead>Buyer</TableHead>
                        <TableHead>Deadline</TableHead>
                        <TableHead>Review progress</TableHead>
                        <TableHead>
                          <span className="sr-only">Open</span>
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {visible.map((b) => {
                        const rr = currentRuns(b),
                          n = rr.reduce(
                            (a, r) => a + Object.keys(r.reviews).length,
                            0,
                          ),
                          t = rr.reduce((a, r) => a + r.findings.length, 0);
                        return (
                          <TableRow key={b.id}>
                            <TableCell>
                              <button
                                className="bid-title"
                                onClick={() => void selectBid(b.id)}
                                disabled={busy}
                              >
                                {b.title}
                                <span>
                                  {b.reference} {b.data.demo ? '· Sample' : ''}
                                </span>
                              </button>
                            </TableCell>
                            <TableCell>{b.buyer}</TableCell>
                            <TableCell>{date(b.deadline)}</TableCell>
                            <TableCell>
                              <div className="progress-cell">
                                <Progress value={t ? (n / t) * 100 : 0} />
                                <span>
                                  {t
                                    ? n + '/' + t + ' reviewed'
                                    : 'Not reviewed'}
                                </span>
                              </div>
                            </TableCell>
                            <TableCell>
                              <Button
                                variant="ghost"
                                aria-label={'Open ' + b.title}
                                onClick={() => void selectBid(b.id)}
                                disabled={busy}
                              >
                                <ArrowUpRight size={18} />
                              </Button>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                ) : search ? (
                  <Empty
                    title="No matching bids"
                    description="Try a different title, reference, or buyer."
                  />
                ) : (
                  <Empty
                    title="Start with the bid documents"
                    description="Create a bid, add its requirements, and compare each clause against bidder evidence."
                  >
                    <div className="flex flex-wrap justify-center gap-3">
                      <Button className="primary" onClick={() => open('bid')}>
                        <Plus size={16} />
                        Create your first bid
                      </Button>
                      <Button
                        variant="outline"
                        disabled={busy}
                        onClick={() =>
                          void act(async () => {
                            update(await api<Bid>('demo', {}));
                            setTab('review');
                          })
                        }
                      >
                        Explore a sample bid <ArrowUpRight size={16} />
                      </Button>
                    </div>
                    <div className="steps">
                      <span>
                        <b>01</b> Add tender
                      </span>
                      <ChevronRight />
                      <span>
                        <b>02</b> Map evidence
                      </span>
                      <ChevronRight />
                      <span>
                        <b>03</b> Verify & review
                      </span>
                    </div>
                  </Empty>
                )}
              </section>
              <div className="info-strip">
                <Sparkles />
                <div>
                  <strong>AI assistance, with evidence you can inspect.</strong>
                  <p>
                    Review suggestions against the bid-specific terms and latest
                    corrigenda before making a decision.
                  </p>
                </div>
                <ArrowUpRight />
              </div>
            </>
          ) : (
            <Tabs value={tab} onValueChange={(v) => setTab(String(v))}>
              <TabsList variant="line" className="workspace-tabs">
                {[
                  ['review', 'Compliance matrix'],
                  ['documents', 'Documents'],
                  ['requirements', 'Requirements'],
                  ['audit', 'Audit trail'],
                ].map(([v, l]) => (
                  <TabsTrigger key={v} value={v}>
                    {l}
                  </TabsTrigger>
                ))}
              </TabsList>
              <TabsContent value="review">
                <section className="panel">
                  <div className="panel-heading review-toolbar">
                    <div>
                      <h2>Compliance matrix</h2>
                      <p className="muted">
                        One requirement. Its evidence. Your decision.
                      </p>
                    </div>
                    <div className="toolbar-controls">
                      <Picker
                        label="Select bidder"
                        value={bidderId}
                        onChange={setBidderId}
                        choices={bid.data.bidders.map((b) => ({
                          value: b.id,
                          label: b.name,
                        }))}
                      />
                      <Button
                        variant="outline"
                        onClick={() => open('bidder')}
                        disabled={busy}
                      >
                        <Plus size={16} /> Bidder
                      </Button>
                    </div>
                  </div>
                  {bid.data.bidders.length ? (
                    <>
                      <div className="review-actions">
                        <Picker
                          label="Filter findings"
                          value={filter}
                          onChange={setFilter}
                          choices={[
                            { value: 'all', label: 'All requirements' },
                            { value: 'unreviewed', label: 'Awaiting review' },
                            { value: 'gap', label: 'Evidence gaps' },
                            { value: 'supported', label: 'Evidence supports' },
                          ]}
                        />
                        <div className="flex flex-wrap gap-2 items-center">
                          <Picker
                            label="Verification mode"
                            value={mode}
                            onChange={setMode}
                            choices={[
                              {
                                value: 'assisted',
                                label: 'Assisted text matching',
                              },
                              ...(ai
                                ? [{ value: 'ai', label: 'AI verification' }]
                                : []),
                            ]}
                          />
                          <Button
                            className="primary"
                            disabled={busy || !bid.data.requirements.length}
                            onClick={() =>
                              void act(async () => {
                                await mutate(
                                  'run',
                                  { bidderId, mode },
                                  'Verification complete. Review each finding before making a decision.',
                                );
                              })
                            }
                          >
                            {busy ? <Loader2 className="spin" /> : <Sparkles />}
                            Run verification
                          </Button>
                        </div>
                      </div>
                      {stale && (
                        <div className="inline-warning">
                          <AlertCircle size={17} /> Evidence or requirements
                          changed. Run verification again to review current
                          results.
                        </div>
                      )}
                      {run ? (
                        <>
                          <div className="run-meta">
                            {run.mode === 'ai'
                              ? 'AI verification'
                              : 'Assisted text matching · no AI used'}{' '}
                            · {time(run.at)} · {run.findings.length} clauses{' '}
                            <span>Decision support only</span>
                          </div>
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>Requirement</TableHead>
                                <TableHead>Finding</TableHead>
                                <TableHead>Reviewer decision</TableHead>
                                <TableHead>
                                  <span className="sr-only">Review</span>
                                </TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {run.findings
                                .filter(
                                  (f) =>
                                    filter === 'all' ||
                                    (filter === 'unreviewed'
                                      ? !run.reviews[f.requirementId]
                                      : f.status === filter),
                                )
                                .map((f, i) => {
                                  const req = (
                                      run.requirements || bid.data.requirements
                                    ).find((r) => r.id === f.requirementId),
                                    review = run.reviews[f.requirementId];
                                  return (
                                    <TableRow key={f.requirementId}>
                                      <TableCell className="requirement-cell">
                                        <div className="requirement-number">
                                          {String(i + 1).padStart(2, '0')}
                                        </div>
                                        <div>
                                          <strong>{req?.clause}</strong>
                                          <small>
                                            {req?.category} · {req?.source}
                                          </small>
                                        </div>
                                      </TableCell>
                                      <TableCell>
                                        <span
                                          className={
                                            'tag ' +
                                            (f.status === 'supported'
                                              ? 'green'
                                              : f.status === 'gap'
                                                ? 'red'
                                                : 'amber')
                                          }
                                        >
                                          {statusLabels[f.status]}
                                        </span>
                                        <small className="source-hint">
                                          {f.documentId
                                            ? 'Source linked'
                                            : 'No verified source'}
                                        </small>
                                      </TableCell>
                                      <TableCell>
                                        <span
                                          className={
                                            'review-label ' +
                                            (review?.status === 'compliant'
                                              ? 'text-green'
                                              : '')
                                          }
                                        >
                                          {review
                                            ? review.status.replaceAll('_', ' ')
                                            : 'Awaiting review'}
                                        </span>
                                      </TableCell>
                                      <TableCell>
                                        <Button
                                          variant="ghost"
                                          onClick={() => {
                                            setFocused(f);
                                            setReviewStatus(
                                              review?.status || 'clarification',
                                            );
                                            open('finding');
                                          }}
                                        >
                                          Review <ChevronRight size={15} />
                                        </Button>
                                      </TableCell>
                                    </TableRow>
                                  );
                                })}
                            </TableBody>
                          </Table>
                          {run.findings.filter(
                            (f) =>
                              filter === 'all' ||
                              (filter === 'unreviewed'
                                ? !run.reviews[f.requirementId]
                                : f.status === filter),
                          ).length === 0 && (
                            <p className="loading">
                              No findings match this filter.
                            </p>
                          )}
                        </>
                      ) : (
                        <Empty
                          title="Ready when your evidence is"
                          description="Add requirements and upload documents for this bidder, then run verification."
                        />
                      )}
                    </>
                  ) : (
                    <Empty
                      title="Add the first bidder"
                      description="Keep each bidder’s documents and findings in a separate review."
                    >
                      <Button
                        className="primary"
                        onClick={() => open('bidder')}
                      >
                        <Plus /> Add bidder
                      </Button>
                    </Empty>
                  )}
                </section>
                <div className="review-footnote">
                  <ShieldCheck size={16} /> Suggestions do not establish
                  document authenticity or eligibility. Final decisions remain
                  with the authorized reviewer.
                </div>
              </TabsContent>
              <TabsContent value="documents">
                <section className="panel">
                  <div className="panel-heading">
                    <div>
                      <h2>Document library</h2>
                      <p className="muted">
                        Tender, corrigenda, and bidder evidence · PDF or TXT
                      </p>
                    </div>
                    <Button
                      className="primary"
                      onClick={() => open('upload')}
                      disabled={busy}
                    >
                      <Upload /> Upload document
                    </Button>
                  </div>
                  {bid.data.documents.length ? (
                    <div className="document-grid">
                      {bid.data.documents.map((d) => (
                        <article className="document-card" key={d.id}>
                          <div className="doc-top">
                            <span className="file-icon">
                              <FileText />
                            </span>
                            <span
                              className={
                                'tag ' +
                                (d.kind === 'tender' ? 'blue' : 'green')
                              }
                            >
                              {d.kind === 'tender'
                                ? 'Tender / corrigendum'
                                : 'Bidder evidence'}
                            </span>
                          </div>
                          <h3>{d.name}</h3>
                          <p>
                            {d.kind === 'tender'
                              ? 'Bid requirements source'
                              : bid.data.bidders.find(
                                  (b) => b.id === d.bidderId,
                                )?.name}
                          </p>
                          <small>
                            {d.pages} page{d.pages !== 1 ? 's' : ''} ·{' '}
                            {Math.max(1, Math.round(d.size / 1024))} KB ·{' '}
                            {date(d.uploadedAt)}
                          </small>
                          <div className="doc-actions">
                            <Button
                              variant="outline"
                              onClick={() => {
                                setDocument(d);
                                open('document');
                              }}
                            >
                              Read text
                            </Button>
                            {d.kind === 'tender' && (
                              <Button
                                variant="ghost"
                                disabled={busy}
                                onClick={() =>
                                  void act(async () => {
                                    const result = await api<{
                                      drafts: Requirement[];
                                    }>('bids/' + bid.id + '/extract', {
                                      documentId: d.id,
                                    });
                                    setDrafts(result.drafts);
                                    setChosen([]);
                                    open('drafts');
                                  })
                                }
                              >
                                Draft clauses <ArrowUpRight size={15} />
                              </Button>
                            )}
                          </div>
                        </article>
                      ))}
                    </div>
                  ) : (
                    <Empty
                      title="Add the source documents"
                      description="Upload the tender and latest corrigenda first, then add evidence for each bidder. Scanned PDFs need OCR before upload."
                    />
                  )}
                </section>
              </TabsContent>
              <TabsContent value="requirements">
                <section className="panel">
                  <div className="panel-heading">
                    <div>
                      <h2>Bid-specific requirements</h2>
                      <p className="muted">
                        Confirm applicability and source references before
                        verification.
                      </p>
                    </div>
                    <Button className="primary" onClick={() => startReq()}>
                      <Plus /> Add requirement
                    </Button>
                  </div>
                  {bid.data.requirements.length ? (
                    <div>
                      {bid.data.requirements.map((req, i) => (
                        <div className="clause-row" key={req.id}>
                          <span className="requirement-number">
                            {String(i + 1).padStart(2, '0')}
                          </span>
                          <div>
                            <strong>{req.clause}</strong>
                            <p>
                              {req.category} · {req.source} ·{' '}
                              {req.mandatory ? 'Mandatory' : 'Conditional'}
                            </p>
                          </div>
                          <Button
                            variant="ghost"
                            aria-label={'Edit requirement ' + (i + 1)}
                            onClick={() => startReq(req)}
                          >
                            <Pencil size={16} />
                          </Button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <Empty
                      title="Define what this bid requires"
                      description="Add requirements manually, or draft clauses from an uploaded tender in the Documents tab. Confirm any extraction against the original."
                    />
                  )}
                </section>
              </TabsContent>
              <TabsContent value="audit">
                <section className="panel">
                  <div className="panel-heading">
                    <h2>Decision history</h2>
                    <span className="muted">
                      {bid.data.audit.length} events · times in IST
                    </span>
                  </div>
                  <div className="audit-list">
                    {[...bid.data.audit].reverse().map((event) => (
                      <article key={event.id} className="audit-item">
                        <span className="audit-dot" />
                        <div>
                          <h3>{event.action}</h3>
                          <p className="audit-detail">{event.detail}</p>
                          <small>
                            {event.actor} · {time(event.at)}
                          </small>
                        </div>
                      </article>
                    ))}
                  </div>
                </section>
              </TabsContent>
            </Tabs>
          )}
          <footer className="page-footer">
            <span>BidScope / Procurement intelligence</span>
            <a
              href="https://bidplus-global.gem.gov.in/"
              target="_blank"
              rel="noreferrer"
            >
              GeM bids <ExternalLink size={12} />
            </a>
            <span>Independent tool · not affiliated with GeM</span>
          </footer>
        </main>
      </SidebarInset>
      <Dialog
        open={modal !== null}
        onOpenChange={(v) => {
          if (!v && !busy) setModal(null);
        }}
      >
        <DialogContent
          className={
            'app-dialog ' +
            (['finding', 'document', 'drafts'].includes(modal || '')
              ? 'wide-dialog'
              : '')
          }
        >
          <DialogHeader>
            <DialogTitle>
              {
                (
                  {
                    bid: 'Create a bid workspace',
                    bidder: 'Add a bidder',
                    requirement: editReq
                      ? 'Edit requirement'
                      : 'Add a requirement',
                    upload: 'Upload a document',
                    finding: 'Review the evidence',
                    document: document?.name || 'Document text',
                    drafts: 'Confirm extracted clauses',
                    settings: 'AI & workspace',
                  } as Record<string, string>
                )[modal || '']
              }
            </DialogTitle>
            <DialogDescription>
              {modal === 'finding'
                ? 'Check the original source, then record a reasoned decision.'
                : modal === 'upload'
                  ? 'PDF or UTF-8 TXT · up to 10 MB and 150 pages.'
                  : modal === 'drafts'
                    ? 'Rule-based draft extraction. Select and edit the relevant clauses before adding them.'
                    : modal === 'settings'
                      ? 'Configuration and review boundaries for this workspace.'
                      : 'All changes are saved to this workspace.'}
            </DialogDescription>
          </DialogHeader>
          {error && (
            <div className="error" role="alert">
              {error}
            </div>
          )}
          {modal === 'settings' ? (
            <div className="settings-content">
              <div className="setting-row">
                <div>
                  <strong>AI verification</strong>
                  <p>
                    {ai
                      ? 'Connected. Uploaded evidence is sent to OpenAI when you select AI verification.'
                      : 'Not configured. Assisted text matching works without an AI key.'}
                  </p>
                </div>
                <span className={'tag ' + (ai ? 'green' : 'amber')}>
                  {ai ? 'Connected' : 'Setup needed'}
                </span>
              </div>
              <p>
                AI verification requires an administrator to set{' '}
                <code>OPENAI_API_KEY</code> on the server. Never paste a secret
                into bid documents or commit it to GitHub.
              </p>
              <p>
                Files remain in your workspace storage. AI calls request no
                response storage. Provider data handling policies still apply.
              </p>
              <div className="inline-warning">
                This platform supports review of supplied bid documents. It does
                not connect to GeM, validate certificates with issuers, submit
                bids, or replace procurement approval.
              </div>
            </div>
          ) : modal === 'document' && document ? (
            <>
              <div className="document-meta">
                {document.pages} pages ·{' '}
                {document.sha256 === 'sample'
                  ? 'Demonstration file'
                  : 'SHA-256: ' + document.sha256}
              </div>
              <pre className="document-text">{document.text}</pre>
              <a
                className="outline-button"
                href={'/api/bids/' + bid?.id + '/documents/' + document.id}
              >
                <Download size={16} />
                Download original
              </a>
            </>
          ) : modal === 'drafts' ? (
            <>
              <div className="draft-list">
                {drafts.length ? (
                  drafts.map((d) => (
                    <div className="draft-item" key={d.id}>
                      <Checkbox
                        aria-label={'Select ' + d.clause.slice(0, 60)}
                        checked={chosen.includes(d.id)}
                        onCheckedChange={(v) =>
                          setChosen((c) =>
                            v ? [...c, d.id] : c.filter((id) => id !== d.id),
                          )
                        }
                      />
                      <Textarea
                        aria-label="Draft clause"
                        value={d.clause}
                        onChange={(e) =>
                          setDrafts((ds) =>
                            ds.map((r) =>
                              r.id === d.id
                                ? { ...r, clause: e.target.value }
                                : r,
                            ),
                          )
                        }
                      />
                    </div>
                  ))
                ) : (
                  <p>
                    No clauses were detected. Add requirements manually after
                    reading the source.
                  </p>
                )}
              </div>
              <Button
                className="primary"
                disabled={busy || !chosen.length}
                onClick={() =>
                  void act(async () => {
                    await mutate(
                      'import-requirements',
                      {
                        requirements: drafts
                          .filter((d) => chosen.includes(d.id))
                          .map(({ id, ...r }) => r),
                      },
                      'Selected clauses added. Verify sources and applicability in Requirements.',
                    );
                  })
                }
              >
                Add {chosen.length} selected clauses
              </Button>
            </>
          ) : (
            <form onSubmit={formSubmit} className="app-form">
              {modal === 'bid' && (
                <>
                  <label>
                    Bid title
                    <Input
                      name="title"
                      required
                      minLength={3}
                      maxLength={180}
                      placeholder="e.g. Desktop workstations for regional offices"
                    />
                  </label>
                  <label>
                    GeM bid reference
                    <Input
                      name="reference"
                      required
                      minLength={3}
                      maxLength={100}
                      placeholder="GEM / YYYY / B / …"
                    />
                  </label>
                  <label>
                    Buyer organization
                    <Input
                      name="buyer"
                      required
                      minLength={2}
                      maxLength={180}
                      placeholder="Department or organization"
                    />
                  </label>
                  <label>
                    Submission deadline (IST)
                    <Input type="date" name="deadline" required />
                  </label>
                </>
              )}
              {modal === 'bidder' && (
                <label>
                  Legal / trading name
                  <Input
                    name="name"
                    required
                    minLength={2}
                    maxLength={160}
                    placeholder="Bidder organization"
                  />
                </label>
              )}
              {modal === 'requirement' && (
                <>
                  <label>
                    Requirement clause
                    <Textarea
                      name="clause"
                      required
                      minLength={8}
                      maxLength={3000}
                      defaultValue={editReq?.clause}
                      rows={4}
                      placeholder="Paste the exact requirement from the bid."
                    />
                  </label>
                  <label>
                    Category
                    <Picker
                      label="Requirement category"
                      value={category}
                      onChange={setCategory}
                      choices={categories.map((c) => ({ value: c, label: c }))}
                    />
                  </label>
                  <label>
                    Source reference
                    <Input
                      name="source"
                      required
                      maxLength={300}
                      defaultValue={editReq?.source}
                      placeholder="Tender filename, page and clause number"
                    />
                  </label>
                  <label className="checkbox-label">
                    <Checkbox
                      checked={mandatory}
                      onCheckedChange={(v) => setMandatory(Boolean(v))}
                    />{' '}
                    Mandatory requirement
                  </label>
                </>
              )}
              {modal === 'upload' && (
                <>
                  <label>
                    Document purpose
                    <Picker
                      label="Document purpose"
                      value={kind}
                      onChange={setKind}
                      choices={[
                        {
                          value: 'tender',
                          label: 'Tender / latest corrigendum',
                        },
                        { value: 'evidence', label: 'Bidder evidence' },
                      ]}
                    />
                  </label>
                  {kind === 'evidence' && (
                    <label>
                      Bidder
                      <Picker
                        label="Bidder for document"
                        value={bidderId}
                        onChange={setBidderId}
                        choices={
                          bid?.data.bidders.map((b) => ({
                            value: b.id,
                            label: b.name,
                          })) || []
                        }
                      />
                      {!bid?.data.bidders.length && (
                        <span className="muted">
                          Add a bidder from the compliance matrix first.
                        </span>
                      )}
                    </label>
                  )}
                  <label className="file-upload">
                    <Upload size={27} />
                    <strong>Choose a document</strong>
                    <span>Text-based PDF or TXT · 10 MB maximum</span>
                    <Input
                      type="file"
                      name="file"
                      accept=".pdf,.txt"
                      required
                    />
                  </label>
                  <p className="muted">
                    For scanned or image-only documents, run OCR first. Uploaded
                    text is retained with the source file.
                  </p>
                </>
              )}
              {modal === 'finding' && focused && run && (
                <>
                  <div className="finding-clause">
                    <span className="eyebrow">BID REQUIREMENT</span>
                    <h3>
                      {
                        (run.requirements || bid?.data.requirements)?.find(
                          (r) => r.id === focused.requirementId,
                        )?.clause
                      }
                    </h3>
                    <p>
                      {
                        (run.requirements || bid?.data.requirements)?.find(
                          (r) => r.id === focused.requirementId,
                        )?.source
                      }
                    </p>
                  </div>
                  <div className="finding-summary">
                    <span
                      className={
                        'tag ' +
                        (focused.status === 'gap'
                          ? 'red'
                          : focused.status === 'supported'
                            ? 'green'
                            : 'amber')
                      }
                    >
                      {statusLabels[focused.status]}
                    </span>
                    <p>{focused.reason}</p>
                  </div>
                  {focused.quote ? (
                    <blockquote>
                      <FileText size={17} />
                      <div>
                        <strong>
                          {
                            bid?.data.documents.find(
                              (d) => d.id === focused.documentId,
                            )?.name
                          }
                        </strong>
                        <p>“{focused.quote}”</p>
                        <a
                          href={
                            '/api/bids/' +
                            bid?.id +
                            '/documents/' +
                            focused.documentId
                          }
                        >
                          Download source <ArrowUpRight size={14} />
                        </a>
                      </div>
                    </blockquote>
                  ) : (
                    <div className="inline-warning">
                      No verified source quote is available for this finding.
                    </div>
                  )}
                  <label>
                    Reviewer decision
                    <Picker
                      value={reviewStatus}
                      onChange={setReviewStatus}
                      label="Reviewer decision"
                      choices={[
                        {
                          value: 'clarification',
                          label: 'Clarification required',
                        },
                        {
                          value: 'compliant',
                          label: 'Compliant — verified by reviewer',
                        },
                        {
                          value: 'non_compliant',
                          label: 'Non-compliant — verified by reviewer',
                        },
                      ]}
                    />
                  </label>
                  <label>
                    Reason and supporting reference
                    <Textarea
                      name="note"
                      required
                      minLength={8}
                      maxLength={3000}
                      rows={3}
                      defaultValue={
                        run.reviews[focused.requirementId]?.note || ''
                      }
                      placeholder="Explain your decision, including the source or clarification needed."
                    />
                  </label>
                  {stale && (
                    <div className="inline-warning">
                      This run is stale. Re-run verification before recording a
                      decision.
                    </div>
                  )}
                </>
              )}
              <div className="form-actions">
                <Button
                  variant="outline"
                  type="button"
                  disabled={busy}
                  onClick={() => setModal(null)}
                >
                  Cancel
                </Button>
                <Button
                  className="primary"
                  type="submit"
                  disabled={
                    busy ||
                    (modal === 'finding' && stale) ||
                    (modal === 'upload' && kind === 'evidence' && !bidderId)
                  }
                >
                  {busy ? (
                    <>
                      <Loader2 className="spin" />
                      Saving…
                    </>
                  ) : modal === 'finding' ? (
                    'Record decision'
                  ) : modal === 'upload' ? (
                    'Upload & extract'
                  ) : (
                    'Save'
                  )}
                </Button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </SidebarProvider>
  );
}
