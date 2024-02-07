import Moleculer, { Errors } from 'moleculer';

export function throwUnauthorizedError(message?: string): Errors.MoleculerError {
  throw new Moleculer.Errors.MoleculerClientError(message || `Unauthorized.`, 401, 'UNAUTHORIZED');
}

export function throwNotFoundError(message?: string): Errors.MoleculerError {
  throw new Moleculer.Errors.MoleculerClientError(message || `Not found.`, 404, 'NOT_FOUND');
}

export function throwNoRightsError(message?: string): Errors.MoleculerError {
  throw new Moleculer.Errors.MoleculerClientError(message || `No rights.`, 401, 'NO_RIGHTS');
}
