import mime from 'mime-types';
import Moleculer, { Errors } from 'moleculer';

export const IMAGE_TYPES = [
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/gif',
];

export const FILE_TYPES = ['application/pdf', 'application/msword'];

export const ALL_FILE_TYPES = [...IMAGE_TYPES, ...FILE_TYPES];

export function getExtention(mimetype: string) {
  return mime.extension(mimetype);
}

export function getMimetype(filename: string) {
  return mime.lookup(filename);
}

export function throwUnsupportedMimetypeError(): Errors.MoleculerError {
  throw new Moleculer.Errors.MoleculerClientError(
    'Unsupported MIME type.',
    400,
    'UNSUPPORTED_MIMETYPE'
  );
}

export function throwUnableToUploadError(): Errors.MoleculerError {
  throw new Moleculer.Errors.MoleculerClientError(
    'Unable to upload file.',
    400,
    'UNABLE_TO_UPLOAD'
  );
}

export function getPublicFileName(length: number = 30) {
  function makeid(length: number) {
    let result = '';
    const characters =
      'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    const charactersLength = characters.length;
    for (var i = 0; i < length; i++) {
      result += characters.charAt(Math.floor(Math.random() * charactersLength));
    }
    return result;
  }

  return makeid(length);
}
