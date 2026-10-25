import { BadRequestException, type PipeTransform } from '@nestjs/common';
import type { z } from 'zod';

/** Valide un corps de requête avec un schéma de @app/shared. */
export class ZodValidationPipe<S extends z.ZodType> implements PipeTransform<unknown, z.infer<S>> {
  constructor(private readonly schema: S) {}

  transform(value: unknown): z.infer<S> {
    const result = this.schema.safeParse(value);
    if (!result.success) {
      throw new BadRequestException({ message: 'Données invalides', issues: result.error.issues });
    }
    return result.data;
  }
}
