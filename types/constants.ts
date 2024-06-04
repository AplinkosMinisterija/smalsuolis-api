import _ from 'lodash';
import { FieldHookCallback } from './';

export enum EndpointType {
  PUBLIC = 'PUBLIC',
  ADMIN = 'ADMIN',
  USER = 'USER',
  SELF = 'SELF',
}

export enum UserType {
  ADMIN = 'ADMIN',
  USER = 'USER',
}

export function queryBoolean(field: string, value: boolean = false) {
  let fieldValue = `${_.snakeCase(field)} IS`;
  if (!value) {
    fieldValue += ' NOT';
  }
  return { $raw: `${fieldValue} TRUE` };
}

export const COMMON_FIELDS = {
  createdBy: {
    type: 'string',
    readonly: true,
    onCreate: ({ ctx }: FieldHookCallback) => ctx.meta.user?.id,
  },

  createdAt: {
    type: 'date',
    columnType: 'datetime',
    immutable: true,
    onCreate: ({ value }: FieldHookCallback) => value || new Date(),
  },

  updatedBy: {
    type: 'string',
    readonly: true,
    onUpdate: ({ ctx }: FieldHookCallback) => ctx.meta.user?.id,
  },

  updatedAt: {
    type: 'date',
    columnType: 'datetime',
    readonly: true,
    onUpdate: () => new Date(),
  },

  deletedBy: {
    type: 'string',
    readonly: true,
    hidden: 'byDefault',
    onRemove: ({ ctx }: FieldHookCallback) => ctx.meta.user?.id,
  },

  deletedAt: {
    type: 'date',
    columnType: 'datetime',
    readonly: true,
    onRemove: () => new Date(),
  },
};

export const COMMON_HIDDEN_FIELDS = _.merge(COMMON_FIELDS, {
  deletedBy: {
    hidden: 'byDefault',
  },
  deletedAt: {
    hidden: 'byDefault',
  },
  updatedAt: {
    hidden: 'byDefault',
  },
  updatedBy: {
    hidden: 'byDefault',
  },
});

export const COMMON_SCOPES = {
  notDeleted: {
    deletedAt: { $exists: false },
  },
  deleted: {
    deletedAt: { $exists: true },
  },
};

export const COMMON_DEFAULT_SCOPES = ['notDeleted'];
export const COMMON_DELETED_SCOPES = ['-notDeleted', 'deleted'];

export enum Frequency {
  DAY = 'DAY',
  WEEK = 'WEEK',
  MONTH = 'MONTH',
}

export const FrequencyLabel = {
  [Frequency.DAY]: 'Vakar',
  [Frequency.WEEK]: 'Prėjusią savaitę',
  [Frequency.MONTH]: 'Praėjusį mėnesį',
};
