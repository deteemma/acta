import { Injectable } from '@nestjs/common';

/**
 * Hermes joignable ou non, d'après le dernier appel du traitement de fond (AS38).
 * Tant qu'il est injoignable, une demande En attente l'indique à son auteur :
 * « Assistant momentanément indisponible : votre demande partira dès son retour. »
 * Gardé en mémoire : l'API est seule à appeler Hermes, et un redémarrage repart de « joignable ».
 */
@Injectable()
export class AssistantAvailability {
  private unreachable = false;

  get isUnreachable(): boolean {
    return this.unreachable;
  }

  markReachable(): void {
    this.unreachable = false;
  }

  markUnreachable(): void {
    this.unreachable = true;
  }
}
