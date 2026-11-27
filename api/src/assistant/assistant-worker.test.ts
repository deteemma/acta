// Traitement de fond de l'assistant (AS5 à AS8, AS37 à AS39) avec un Hermes
// simulé et une file en mémoire, qui suit les mêmes règles que la base : un
// passage de statut ne vaut que pour une demande encore non terminée.
import 'reflect-metadata';
import assert from 'node:assert/strict';
import { beforeEach, describe, test } from 'node:test';
import {
  type AssistantCancellationReason,
  type AssistantFailureReason,
  type AssistantMode,
  type AssistantRequestStatus,
  type AssistantSettings,
  ASSISTANT_SETTINGS_DEFAULTS,
  type HermesRun,
  type HermesRunRequest,
  hermesSessionId,
} from '@app/shared';
import { AssistantAvailability } from './assistant-availability.js';
import type { AuthorAccess, ReadResult } from './assistant-context.service.js';
import type { AssistantQueue, PendingRequest, RunningRequest } from './assistant-queue.service.js';
import { AssistantWorker, type AssistantReader } from './assistant-worker.service.js';
import { type HermesPort, HermesUnreachableError, releaseHermesWork } from './hermes-client.service.js';

interface StoredRequest {
  id: string;
  initiativeId: string;
  authorId: string;
  mode: AssistantMode;
  status: AssistantRequestStatus;
  readAt: Date | null;
  timeoutMinutes: number | null;
  hermesRunId: string | null;
  advice: string | null;
  failureReason: AssistantFailureReason | null;
  cancellationReason: AssistantCancellationReason | null;
}

class MemoryQueue implements AssistantQueue {
  readonly requests: StoredRequest[] = [];
  settings: AssistantSettings = { ...ASSISTANT_SETTINGS_DEFAULTS };
  access: AuthorAccess = 'ok';

  add(request: Partial<StoredRequest> & { id: string }): StoredRequest {
    const stored: StoredRequest = {
      initiativeId: 'initiative',
      authorId: 'alice',
      mode: 'quick',
      status: 'pending',
      readAt: null,
      timeoutMinutes: null,
      hermesRunId: null,
      advice: null,
      failureReason: null,
      cancellationReason: null,
      ...request,
    };
    this.requests.push(stored);
    return stored;
  }

  get(id: string): StoredRequest {
    return this.requests.find((r) => r.id === id)!;
  }

  async running(): Promise<RunningRequest[]> {
    return this.requests
      .filter((r) => r.status === 'running')
      .map((r) => ({
        id: r.id,
        initiativeId: r.initiativeId,
        authorId: r.authorId,
        readAt: r.readAt!,
        timeoutMinutes: r.timeoutMinutes!,
        hermesRunId: r.hermesRunId!,
      }));
  }

  async nextPending(slots: (settings: AssistantSettings, running: number) => number) {
    const free = slots(this.settings, this.requests.filter((r) => r.status === 'running').length);
    const pending: PendingRequest[] = this.requests
      .filter((r) => r.status === 'pending')
      .slice(0, free)
      .map((r) => ({
        id: r.id,
        initiativeId: r.initiativeId,
        authorId: r.authorId,
        usage: 'status_review',
        mode: r.mode,
        locale: 'fr',
      }));
    return { settings: { ...this.settings }, pending };
  }

  private move(id: string, from: readonly AssistantRequestStatus[], change: Partial<StoredRequest>): boolean {
    const request = this.get(id);
    if (!from.includes(request.status)) return false;
    Object.assign(request, change);
    return true;
  }

  async markRunning(id: string, run: { readAt: Date; timeoutMinutes: number; hermesRunId: string }) {
    return this.move(id, ['pending'], { status: 'running', ...run });
  }
  async answer(id: string, advice: string) {
    return this.move(id, ['running'], { status: 'answered', advice });
  }
  async fail(id: string, reason: AssistantFailureReason) {
    return this.move(id, ['pending', 'running'], { status: 'failed', failureReason: reason });
  }
  async cancel(id: string, reason: AssistantCancellationReason) {
    return this.move(id, ['pending', 'running'], { status: 'cancelled', cancellationReason: reason });
  }
  async authorAccess(): Promise<AuthorAccess> {
    return this.access;
  }
}

/** Hermes simulé : travaux, réponses et pannes réglés par chaque test. */
class FakeHermes implements HermesPort {
  reachable = true;
  readonly started: { body: HermesRunRequest; idempotencyKey: string }[] = [];
  readonly stopped: string[] = [];
  readonly deletedSessions: string[] = [];
  readonly runs = new Map<string, HermesRun>();
  /** Appelé pendant l'envoi, avant que la demande passe En cours. */
  onStart: (() => void) | undefined;

  async startRun(body: HermesRunRequest, idempotencyKey: string): Promise<string> {
    if (!this.reachable) throw new HermesUnreachableError('injoignable');
    this.started.push({ body, idempotencyKey });
    const runId = `run-${idempotencyKey}`;
    this.runs.set(runId, { status: 'running' });
    this.onStart?.();
    return runId;
  }
  async getRun(runId: string): Promise<HermesRun | null> {
    if (!this.reachable) throw new HermesUnreachableError('injoignable');
    return this.runs.get(runId) ?? null;
  }
  async stopRun(runId: string): Promise<void> {
    this.stopped.push(runId);
  }
  async deleteSession(sessionId: string): Promise<void> {
    this.deletedSessions.push(sessionId);
  }
}

class FakeReader implements AssistantReader {
  result: ReadResult = { access: 'ok', text: 'Données de l’initiative' };
  reads = 0;
  async readStatusReview(): Promise<ReadResult> {
    this.reads += 1;
    return this.result;
  }
}

const T0 = new Date('2026-11-27T10:00:00Z');
const minutesLater = (minutes: number) => new Date(T0.getTime() + minutes * 60_000);
const session = hermesSessionId;

let queue: MemoryQueue;
let hermes: FakeHermes;
let reader: FakeReader;
let availability: AssistantAvailability;
let worker: AssistantWorker;

const newWorker = () => new AssistantWorker({ assistant: null }, queue, reader, hermes, availability);
const tick = (at: Date = T0) => worker.tick(() => at);

beforeEach(() => {
  queue = new MemoryQueue();
  hermes = new FakeHermes();
  reader = new FakeReader();
  availability = new AssistantAvailability();
  worker = newWorker();
});

describe('reprise au redémarrage de l’API (AS39)', () => {
  test('une demande En cours est suivie d’après son identifiant de travail, sans être renvoyée', async () => {
    queue.add({ id: 'r1', status: 'running', readAt: T0, timeoutMinutes: 20, hermesRunId: 'run-r1' });
    hermes.runs.set('run-r1', { status: 'completed', output: 'Avis prêt' });

    await tick(minutesLater(5));

    assert.equal(hermes.started.length, 0);
    assert.equal(queue.get('r1').status, 'answered');
    assert.equal(queue.get('r1').advice, 'Avis prêt');
    assert.deepEqual(hermes.deletedSessions, [session('r1')]);
  });
});

describe('passage En cours et envoi (AS37)', () => {
  test('la demande part avec sa clé d’idempotence et le délai de son mode', async () => {
    queue.add({ id: 'r1', mode: 'thorough' });

    await tick();

    assert.equal(hermes.started.length, 1);
    assert.equal(hermes.started[0]!.idempotencyKey, 'r1');
    const request = queue.get('r1');
    assert.equal(request.status, 'running');
    assert.equal(request.hermesRunId, 'run-r1');
    assert.equal(request.timeoutMinutes, 60);
    assert.deepEqual(request.readAt, T0);
  });
});

describe('Hermes injoignable avant l’envoi (AS38)', () => {
  test('la demande reste En attente et l’indisponibilité est signalée, puis elle part à son retour', async () => {
    queue.add({ id: 'r1' });
    hermes.reachable = false;

    await tick();

    assert.equal(queue.get('r1').status, 'pending');
    assert.equal(availability.isUnreachable, true);

    hermes.reachable = true;
    await tick(minutesLater(1));

    assert.equal(queue.get('r1').status, 'running');
    assert.equal(availability.isUnreachable, false);
    assert.equal(hermes.started.length, 1);
  });

  test('Hermes muet pendant le suivi : la demande reste En cours et l’indisponibilité est signalée', async () => {
    queue.add({ id: 'r1', status: 'running', readAt: T0, timeoutMinutes: 20, hermesRunId: 'run-r1' });
    hermes.reachable = false;

    await tick(minutesLater(5));

    assert.equal(queue.get('r1').status, 'running');
    assert.equal(availability.isUnreachable, true);
  });
});

describe('échecs après l’envoi (AS7, AS37, AS38)', () => {
  const running = () => queue.add({ id: 'r1', status: 'running', readAt: T0, timeoutMinutes: 20, hermesRunId: 'run-r1' });

  for (const [label, run, reason] of [
    ['travail interrompu', { status: 'interrupted' }, 'unavailable'],
    ['travail inconnu', { status: 'unknown' }, 'unavailable'],
    ['travail introuvable', null, 'unavailable'],
    ['réponse vide', { status: 'completed', output: '  ' }, 'noAnswer'],
    ['réponse en erreur', { status: 'failed', error: 'model error' }, 'noAnswer'],
  ] as const) {
    test(`${label} : Échouée « ${reason} », session supprimée`, async () => {
      running();
      if (run) hermes.runs.set('run-r1', run);

      await tick(minutesLater(5));

      assert.equal(queue.get('r1').status, 'failed');
      assert.equal(queue.get('r1').failureReason, reason);
      assert.equal(queue.get('r1').advice, null);
      assert.deepEqual(hermes.deletedSessions, [session('r1')]);
    });
  }

  test('pas de nouvelle tentative automatique après un échec', async () => {
    running();
    hermes.runs.set('run-r1', { status: 'interrupted' });

    await tick(minutesLater(5));
    await tick(minutesLater(6));

    assert.equal(queue.get('r1').status, 'failed');
    assert.equal(hermes.started.length, 0);
  });
});

describe('délai maximal (AS5)', () => {
  test('le délai noté au passage En cours s’applique, même modifié ensuite', async () => {
    queue.add({ id: 'r1' });
    await tick();
    queue.settings = { ...queue.settings, quickTimeoutMinutes: 5 };

    await tick(minutesLater(10));
    assert.equal(queue.get('r1').status, 'running');

    await tick(minutesLater(21));
    assert.equal(queue.get('r1').status, 'failed');
    assert.equal(queue.get('r1').failureReason, 'timeout');
    assert.deepEqual(hermes.stopped, ['run-r1']);
    assert.deepEqual(hermes.deletedSessions, [session('r1')]);
  });

  test('le nouveau délai vaut pour la demande qui passe En cours ensuite', async () => {
    queue.settings = { ...queue.settings, quickTimeoutMinutes: 5 };
    queue.add({ id: 'r1' });

    await tick();

    assert.equal(queue.get('r1').timeoutMinutes, 5);
  });
});

describe('droits revérifiés (AS8)', () => {
  for (const access of ['accessLost', 'accountDeactivated'] as const) {
    test(`au passage En cours (${access}) : Annulée, rien n’est envoyé`, async () => {
      queue.add({ id: 'r1' });
      reader.result = { access };

      await tick();

      assert.equal(queue.get('r1').status, 'cancelled');
      assert.equal(queue.get('r1').cancellationReason, access);
      assert.equal(hermes.started.length, 0);
    });

    test(`avant d’enregistrer l’avis (${access}) : Annulée, avis jeté, session supprimée`, async () => {
      queue.add({ id: 'r1', status: 'running', readAt: T0, timeoutMinutes: 20, hermesRunId: 'run-r1' });
      hermes.runs.set('run-r1', { status: 'completed', output: 'Avis prêt' });
      queue.access = access;

      await tick(minutesLater(5));

      assert.equal(queue.get('r1').status, 'cancelled');
      assert.equal(queue.get('r1').cancellationReason, access);
      assert.equal(queue.get('r1').advice, null);
      assert.deepEqual(hermes.deletedSessions, [session('r1')]);
    });
  }
});

describe('annulation par l’auteur (AS6)', () => {
  test('annulée pendant l’envoi : le travail parti s’arrête et la session est supprimée', async () => {
    queue.add({ id: 'r1' });
    hermes.onStart = () => void queue.cancel('r1', 'byAuthor');

    await tick();

    assert.equal(queue.get('r1').status, 'cancelled');
    assert.deepEqual(hermes.stopped, ['run-r1']);
    assert.deepEqual(hermes.deletedSessions, [session('r1')]);
  });

  test('annulée pendant le travail : aucun avis gardé quand Hermes répond ensuite', async () => {
    queue.add({ id: 'r1' });
    await tick();
    await queue.cancel('r1', 'byAuthor');
    hermes.runs.set('run-r1', { status: 'completed', output: 'Avis partiel' });

    await tick(minutesLater(5));

    assert.equal(queue.get('r1').status, 'cancelled');
    assert.equal(queue.get('r1').advice, null);
  });

  test('l’annulation arrête le travail chez Hermes et supprime la session', async () => {
    await releaseHermesWork(hermes, 'r1', 'run-r1');

    assert.deepEqual(hermes.stopped, ['run-r1']);
    assert.deepEqual(hermes.deletedSessions, [session('r1')]);
  });
});
