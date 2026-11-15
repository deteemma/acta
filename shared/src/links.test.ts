import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkTicketLink, linkCandidates, linksOfPage, linksOfTicket, linkSide, orientTicketLink, pagesLinkedTo, ticketsLinkedTo } from './links.js';

test('un ticket ne se lie pas à lui-même', () => {
  assert.equal(checkTicketLink([], 'A', 'A'), 'selfLink');
});

test('un seul lien par paire, quelle que soit sa nature et son sens', () => {
  const existing = [orientTicketLink('A', 'B', 'blocks')];
  assert.equal(checkTicketLink(existing, 'B', 'A'), 'alreadyLinked');
  assert.equal(checkTicketLink(existing, 'A', 'B'), 'alreadyLinked');
  assert.equal(checkTicketLink(existing, 'A', 'C'), null);
});

test('« est bloqué par » vu de A : B bloque A ; chaque côté affiche son libellé', () => {
  const link = orientTicketLink('A', 'B', 'blocked_by');
  assert.deepEqual(link, { sourceId: 'B', targetId: 'A', kind: 'blocks' });
  assert.equal(linkSide(link, 'A'), 'blocked_by');
  assert.equal(linkSide(link, 'B'), 'blocks');
});

test('« duplique » vu de A : A duplique B, B est dupliqué par A', () => {
  const link = orientTicketLink('A', 'B', 'duplicates');
  assert.deepEqual(link, { sourceId: 'A', targetId: 'B', kind: 'duplicates' });
  assert.equal(linkSide(link, 'B'), 'duplicated_by');
});

test('« est lié à » est sans sens : même libellé des deux côtés', () => {
  const link = orientTicketLink('A', 'B', 'relates_to');
  assert.equal(linkSide(link, 'A'), 'relates_to');
  assert.equal(linkSide(link, 'B'), 'relates_to');
});

const ref = (id: string, reference: string) => ({ id, reference, title: `Titre ${id}` });
const objects = {
  tickets: [ref('C', 'X-QU-001'), ref('A', 'X-AC-002'), ref('B', 'X-AC-001'), ref('D', 'X-RI-001')],
  needs: [ref('n2', 'X-BE-002'), ref('n1', 'X-BE-001')],
  requirements: [ref('r1', 'X-EX-001')],
  pages: [ref('p2', 'X-PA-002'), ref('p1', 'X-PA-001')],
};
const links = {
  ticketLinks: [orientTicketLink('A', 'C', 'blocks'), orientTicketLink('B', 'A', 'relates_to')],
  needLinks: [
    { ticketId: 'A', needId: 'n2' },
    { ticketId: 'A', needId: 'n1' },
    { ticketId: 'C', needId: 'n1' },
  ],
  requirementLinks: [{ ticketId: 'C', requirementId: 'r1' }],
  pageLinks: [
    { pageId: 'p1', object: { kind: 'ticket', id: 'C' } },
    { pageId: 'p1', object: { kind: 'ticket', id: 'A' } },
    { pageId: 'p1', object: { kind: 'need', id: 'n1' } },
    { pageId: 'p2', object: { kind: 'requirement', id: 'r1' } },
    { pageId: 'p2', object: { kind: 'ticket', id: 'A' } },
  ] as const,
};

test('fiche d’un ticket : tickets liés avec leur libellé, besoins et exigences, par référence', () => {
  const ofA = linksOfTicket(links, 'A', objects);
  assert.deepEqual(
    ofA.tickets.map((l) => [l.side, l.ticket.reference]),
    [['relates_to', 'X-AC-001'], ['blocks', 'X-QU-001']],
  );
  assert.deepEqual(ofA.needs.map((n) => n.reference), ['X-BE-001', 'X-BE-002']);
  assert.deepEqual(linksOfTicket(links, 'C', objects).tickets.map((l) => l.side), ['blocked_by']);
  assert.deepEqual(linksOfTicket(links, 'C', objects).requirements.map((r) => r.id), ['r1']);
});

test('fiches de besoin et d’exigence : leurs tickets, de tout type, par référence', () => {
  assert.deepEqual(ticketsLinkedTo(links, { kind: 'need', id: 'n1' }, objects.tickets).map((t) => t.reference), ['X-AC-002', 'X-QU-001']);
  assert.deepEqual(ticketsLinkedTo(links, { kind: 'requirement', id: 'r1' }, objects.tickets).map((t) => t.id), ['C']);
});

test('ajout depuis un ticket : ni lui-même, ni un objet déjà lié', () => {
  const offered = linkCandidates(links, { kind: 'ticket', id: 'A' }, objects);
  assert.deepEqual(offered.tickets.map((t) => t.id), ['D']);
  assert.deepEqual(offered.needs, []);
  assert.deepEqual(offered.requirements.map((r) => r.id), ['r1']);
});

test('ajout depuis un besoin : les tickets qui n’y sont pas encore liés, par référence', () => {
  const offered = linkCandidates(links, { kind: 'need', id: 'n1' }, objects);
  assert.deepEqual(offered.tickets.map((t) => t.id), ['B', 'D']);
});

test('une page : ses tickets, besoins et exigences liés, par référence', () => {
  const ofP1 = linksOfPage(links, 'p1', objects);
  assert.deepEqual(ofP1.tickets.map((t) => t.reference), ['X-AC-002', 'X-QU-001']);
  assert.deepEqual(ofP1.needs.map((n) => n.id), ['n1']);
  assert.deepEqual(ofP1.requirements, []);
  assert.deepEqual(linksOfPage(links, 'p2', objects).requirements.map((r) => r.id), ['r1']);
});

test('ticket, besoin, exigence : leurs pages liées, par référence', () => {
  assert.deepEqual(pagesLinkedTo(links, { kind: 'ticket', id: 'A' }, objects.pages).map((p) => p.reference), ['X-PA-001', 'X-PA-002']);
  assert.deepEqual(pagesLinkedTo(links, { kind: 'need', id: 'n1' }, objects.pages).map((p) => p.id), ['p1']);
  assert.deepEqual(pagesLinkedTo(links, { kind: 'requirement', id: 'r1' }, objects.pages).map((p) => p.id), ['p2']);
  assert.deepEqual(pagesLinkedTo(links, { kind: 'ticket', id: 'D' }, objects.pages), []);
});

test('ajout depuis une page : tickets, besoins, exigences pas encore liés ; jamais une page', () => {
  const offered = linkCandidates(links, { kind: 'page', id: 'p1' }, objects);
  assert.deepEqual(offered.tickets.map((t) => t.id), ['B', 'D']);
  assert.deepEqual(offered.needs.map((n) => n.id), ['n2']);
  assert.deepEqual(offered.requirements.map((r) => r.id), ['r1']);
  assert.deepEqual(offered.pages, []);
});

test('ajout depuis un ticket, un besoin ou une exigence : les pages pas encore liées', () => {
  assert.deepEqual(linkCandidates(links, { kind: 'ticket', id: 'C' }, objects).pages.map((p) => p.id), ['p2']);
  assert.deepEqual(linkCandidates(links, { kind: 'ticket', id: 'A' }, objects).pages, []);
  assert.deepEqual(linkCandidates(links, { kind: 'need', id: 'n2' }, objects).pages.map((p) => p.reference), ['X-PA-001', 'X-PA-002']);
  assert.deepEqual(linkCandidates(links, { kind: 'requirement', id: 'r1' }, objects).pages.map((p) => p.id), ['p1']);
});
