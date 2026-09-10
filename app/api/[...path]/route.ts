import { z, ZodError } from 'zod';
import { authenticate } from '@/backend/auth';
import { aiConfigured, verifyWithAI } from '@/backend/ai';
import { assistedFindings, draftRequirements } from '@/backend/compliance';
import { extractDocument } from '@/backend/documents';
import {
  audit,
  createBid,
  getBid,
  listBids,
  publicBid,
  saveBid,
} from '@/backend/repository';
import {
  HttpError,
  newBidSchema,
  readJson,
  readBody,
  requirementSchema,
  reviewSchema,
  csvCell,
} from '@/backend/validation';
import { demoData } from '@/backend/demo';
import { bucket } from '@/db';
import type { Run } from '@/lib/types';
export const dynamic = 'force-dynamic';
const json = (data: unknown, status = 200) =>
  Response.json(data, {
    status,
    headers: {
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  });
async function route(request: Request) {
  try {
    const user = authenticate(request);
    const url = new URL(request.url);
    const path = url.pathname.split('/').filter(Boolean).slice(1);
    const method = request.method;
    if (path.length === 1 && path[0] === 'status' && method === 'GET')
      return json({ ai: aiConfigured(), user: user.name });
    if (path.length === 1 && path[0] === 'bids') {
      if (method === 'GET') {
        const bids = await listBids(user.id);
        return json(bids.map(publicBid));
      }
      if (method === 'POST')
        return json(
          publicBid(
            await createBid(
              user.id,
              user.name,
              newBidSchema.parse(await readJson(request)),
            ),
          ),
          201,
        );
    }
    if (path.length === 1 && path[0] === 'demo' && method === 'POST') {
      const existing = (await listBids(user.id)).find((b) => b.data.demo);
      return json(
        publicBid(
          existing ||
            (await createBid(
              user.id,
              user.name,
              {
                title: 'Desktop workstations for regional offices',
                reference: 'SAMPLE / IT / 001',
                buyer: 'Demonstration procurement office',
                deadline: new Date(Date.now() + 14 * 86400000)
                  .toISOString()
                  .slice(0, 10),
              },
              demoData(),
            )),
        ),
        existing ? 200 : 201,
      );
    }
    if (path[0] !== 'bids' || !path[1])
      throw new HttpError(404, 'Endpoint not found');
    const bid = await getBid(path[1], user.id);
    const action = path[2];
    if (path.length === 2 && method === 'GET') return json(publicBid(bid));
    if (action === 'report' && path.length === 3 && method === 'GET') {
      const rows = [
        [
          'Bid reference',
          'Bid title',
          'Bidder',
          'Run time',
          'Mode',
          'Content version',
          'Stale',
          'Clause',
          'Category',
          'Source',
          'Suggestion',
          'Reason',
          'Document',
          'Exact quote',
          'Reviewer decision',
          'Reviewer note',
          'Reviewer',
          'Reviewed at',
        ],
      ];
      for (const run of bid.data.runs) {
        for (const finding of run.findings) {
          const req = (run.requirements || bid.data.requirements).find(
            (r) => r.id === finding.requirementId,
          );
          const rev = run.reviews[finding.requirementId];
          rows.push([
            bid.reference,
            bid.title,
            bid.data.bidders.find((b) => b.id === run.bidderId)?.name || '',
            run.at,
            run.mode,
            String(run.contentVersion),
            String(run.contentVersion !== bid.data.contentVersion),
            req?.clause || '',
            req?.category || '',
            req?.source || '',
            finding.status,
            finding.reason,
            bid.data.documents.find((d) => d.id === finding.documentId)?.name ||
              '',
            finding.quote,
            rev?.status || 'unreviewed',
            rev?.note || '',
            rev?.reviewer || '',
            rev?.at || '',
          ]);
        }
      }
      return new Response(
        '\uFEFF' + rows.map((r) => r.map(csvCell).join(',')).join('\r\n'),
        {
          headers: {
            'Content-Type': 'text/csv; charset=utf-8',
            'Content-Disposition':
              'attachment; filename="bid-compliance-report.csv"',
            'Cache-Control': 'no-store',
            'X-Content-Type-Options': 'nosniff',
          },
        },
      );
    }
    if (action === 'documents' && path.length === 4 && method === 'GET') {
      const doc = bid.data.documents.find((d) => d.id === path[3]);
      if (!doc) throw new HttpError(404, 'Document not found');
      const object = doc.key ? await bucket().get(doc.key) : null;
      if (doc.key && !object)
        throw new HttpError(404, 'Stored file is unavailable');
      return new Response(object?.body || doc.text, {
        headers: {
          'Content-Type': 'application/octet-stream',
          'Content-Disposition':
            "attachment; filename*=UTF-8''" + encodeURIComponent(doc.name),
          'Cache-Control': 'no-store',
          'X-Content-Type-Options': 'nosniff',
        },
      });
    }
    if (method !== 'POST' || path.length !== 3)
      throw new HttpError(404, 'Endpoint not found');
    if (action === 'documents') {
      if (bid.data.documents.length >= 30)
        throw new HttpError(422, 'Maximum 30 documents per bid.');
      const bytes = await readBody(request, 10 * 1024 * 1024 + 100_000);
      const form = await new Request(request.url, {
        method: 'POST',
        headers: { 'Content-Type': request.headers.get('content-type') || '' },
        body: bytes,
      }).formData();
      const file = form.get('file');
      if (!(file instanceof File) || file.size === 0)
        throw new HttpError(400, 'Choose a document');
      if (file.size > 10 * 1024 * 1024)
        throw new HttpError(413, 'Maximum file size is 10 MB.');
      const kind = z.enum(['tender', 'evidence']).parse(form.get('kind'));
      const bidderId =
        kind === 'evidence' ? String(form.get('bidderId') || '') : null;
      if (
        kind === 'evidence' &&
        !bid.data.bidders.some((b) => b.id === bidderId)
      )
        throw new HttpError(400, 'Choose a bidder first.');
      const name = file.name.replace(/[\/\\\u0000-\u001F]/g, '_').slice(-160);
      const raw = new Uint8Array(await file.arrayBuffer());
      const sha256 = Array.from(
        new Uint8Array(await crypto.subtle.digest('SHA-256', raw)),
      )
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');
      if (
        bid.data.documents.some(
          (d) =>
            d.sha256 === sha256 && d.kind === kind && d.bidderId === bidderId,
        )
      )
        throw new HttpError(
          409,
          'This document is already uploaded for this bidder or tender.',
        );
      const extracted = await extractDocument(raw.slice(), name);
      if (
        bid.data.documents.reduce((n, d) => n + d.text.length, 0) +
          extracted.text.length >
        600_000
      )
        throw new HttpError(
          422,
          'Maximum extracted text per bid is 600,000 characters.',
        );
      const id = crypto.randomUUID();
      const key = user.id + '/' + bid.id + '/' + id;
      await bucket().put(key, raw);
      bid.data.documents.push({
        id,
        key,
        name,
        kind,
        bidderId,
        size: file.size,
        sha256,
        uploadedAt: new Date().toISOString(),
        ...extracted,
      });
      bid.data.contentVersion++;
      audit(bid, user.name, 'Document uploaded', name);
      try {
        return json(publicBid(await saveBid(bid, user.id)), 201);
      } catch (error) {
        await bucket().delete(key);
        throw error;
      }
    }
    const body = await readJson(request);
    if (action === 'bidders') {
      const { name } = z
        .object({ name: z.string().trim().min(2).max(160) })
        .parse(body);
      if (bid.data.bidders.length >= 10)
        throw new HttpError(422, 'Maximum 10 bidders per bid.');
      if (
        bid.data.bidders.some(
          (b) => b.name.toLowerCase() === name.toLowerCase(),
        )
      )
        throw new HttpError(409, 'Bidder already exists');
      bid.data.bidders.push({ id: crypto.randomUUID(), name });
      audit(bid, user.name, 'Bidder added', name);
    } else if (action === 'requirements') {
      const req = requirementSchema.parse(body);
      if (bid.data.requirements.length >= 100)
        throw new HttpError(422, 'Maximum 100 requirements per bid.');
      bid.data.requirements.push({ id: crypto.randomUUID(), ...req });
      bid.data.contentVersion++;
      audit(bid, user.name, 'Requirement added', req.clause);
    } else if (action === 'edit-requirement') {
      const { id, ...fields } = requirementSchema
        .extend({ id: z.string().uuid() })
        .parse(body);
      const index = bid.data.requirements.findIndex((r) => r.id === id);
      if (index < 0) throw new HttpError(404, 'Requirement not found');
      const previous = bid.data.requirements[index];
      bid.data.requirements[index] = { id, ...fields };
      bid.data.contentVersion++;
      audit(
        bid,
        user.name,
        'Requirement edited',
        JSON.stringify({ previous, current: bid.data.requirements[index] }),
      );
    } else if (action === 'import-requirements') {
      const { requirements } = z
        .object({ requirements: z.array(requirementSchema).min(1).max(60) })
        .parse(body);
      if (bid.data.requirements.length + requirements.length > 100)
        throw new HttpError(422, 'Maximum 100 requirements per bid.');
      bid.data.requirements.push(
        ...requirements.map((r) => ({ id: crypto.randomUUID(), ...r })),
      );
      bid.data.contentVersion++;
      audit(
        bid,
        user.name,
        'Draft clauses confirmed',
        requirements.length + ' clauses added',
      );
    } else if (action === 'extract') {
      const { documentId } = z
        .object({ documentId: z.string().uuid() })
        .parse(body);
      const doc = bid.data.documents.find(
        (d) => d.id === documentId && d.kind === 'tender',
      );
      if (!doc) throw new HttpError(404, 'Tender document not found');
      return json({ drafts: draftRequirements(doc.text, doc.name) });
    } else if (action === 'run') {
      const { bidderId, mode } = z
        .object({
          bidderId: z.string().uuid(),
          mode: z.enum(['ai', 'assisted']),
        })
        .parse(body);
      if (!bid.data.bidders.some((b) => b.id === bidderId))
        throw new HttpError(404, 'Bidder not found');
      if (!bid.data.requirements.length)
        throw new HttpError(422, 'Add at least one requirement.');
      if (bid.data.runs.length >= 50)
        throw new HttpError(422, 'Maximum 50 review runs per bid.');
      const documents = bid.data.documents.filter(
        (d) => d.kind === 'evidence' && d.bidderId === bidderId,
      );
      if (!documents.length)
        throw new HttpError(422, 'Upload bidder evidence first.');
      const previous = [...bid.data.runs]
        .reverse()
        .find((r) => r.bidderId === bidderId);
      if (previous && Date.now() - Date.parse(previous.at) < 10_000)
        throw new HttpError(
          429,
          'Wait a few seconds before starting another review.',
        );
      const result =
        mode === 'ai'
          ? await verifyWithAI(bid.data.requirements, documents)
          : {
              model: null,
              findings: assistedFindings(bid.data.requirements, documents),
            };
      const run: Run = {
        id: crypto.randomUUID(),
        bidderId,
        at: new Date().toISOString(),
        mode,
        ...result,
        contentVersion: bid.data.contentVersion,
        requirements: structuredClone(bid.data.requirements),
        reviews: {},
      };
      bid.data.runs.push(run);
      audit(
        bid,
        user.name,
        'Verification completed',
        mode + ' review: ' + result.findings.length + ' clauses; run ' + run.id,
      );
    } else if (action === 'review') {
      const review = reviewSchema.parse(body);
      const run = bid.data.runs.find((r) => r.id === review.runId);
      if (
        !run ||
        !run.findings.some((f) => f.requirementId === review.requirementId)
      )
        throw new HttpError(404, 'Finding not found');
      if (run.contentVersion !== bid.data.contentVersion)
        throw new HttpError(
          409,
          'Evidence or requirements changed. Run verification again before reviewing.',
        );
      const previous = run.reviews[review.requirementId];
      run.reviews[review.requirementId] = {
        status: review.status,
        note: review.note,
        reviewer: user.name,
        at: new Date().toISOString(),
      };
      audit(
        bid,
        user.name,
        'Reviewer decision',
        JSON.stringify({
          runId: run.id,
          requirementId: review.requirementId,
          previous: previous || null,
          decision: run.reviews[review.requirementId],
        }),
      );
    } else throw new HttpError(404, 'Endpoint not found');
    return json(publicBid(await saveBid(bid, user.id)));
  } catch (error) {
    if (error instanceof HttpError)
      return json({ error: error.message }, error.status);
    if (error instanceof ZodError)
      return json(
        {
          error: error.issues
            .map((i) => i.path.join('.') + ': ' + i.message)
            .join('; '),
        },
        400,
      );
    console.error(
      'API failure',
      error instanceof Error ? error.name : 'UnknownError',
    );
    return json(
      {
        error:
          'The action could not be completed. Please retry; if it continues, check server configuration.',
      },
      500,
    );
  }
}
export const GET = route;
export const POST = route;
