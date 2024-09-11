import moleculer, { Context } from 'moleculer';
import { ActionSchema, ActionParamSchema } from 'moleculer';
import { IncomingMessage } from 'http';
import { DbAdapter, DbContextParameters, DbServiceSettings } from 'moleculer-db';
import { UserType } from './constants';
import { App } from '../services/apps.service';
import { User } from '../services/users.service';

export interface AppAuthMeta {
  app: App;
}

export interface UserAuthMeta {
  user: User;
  authToken: string;
  authUser: any;
  app: any;
}

export type FieldHookCallback = {
  ctx: Context<null, UserAuthMeta & AppAuthMeta>;
  value: any;
  params: any;
  field: any;
  operation: any;
  entity: any;
};

export type Table<
  Fields = {},
  Populates = {},
  P extends keyof Populates = never,
  F extends keyof (Fields & Populates) = keyof Fields,
> = Pick<Omit<Fields, P> & Pick<Populates, P>, Extract<P | Exclude<keyof Fields, P>, F>>;

export interface CommonFields {
  id: number;
  createdBy: User['id'];
  createdAt: Date;
  updatedBy: User['id'];
  updatedAt: Date;
  deletedBy: User['id'];
  deletedAt: Date;
}

export interface CommonPopulates {
  createdBy: User;
  updatedBy: User;
  deletedBy: User;
}

export interface EntityChangedParams<T> {
  type: 'create' | 'update' | 'replace' | 'remove' | 'clear';
  data: T;
  oldData?: T;
}

export type MultipartMeta = {
  $multipart: Record<string, string>;
  $params: Record<string, string>;
  fieldname: string;
  filename: string;
  encoding: string;
  mimetype: string;
};

export type ContextMeta<T> = { ctx: { meta: T } };

export interface DBPagination<T> {
  rows: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export class MoleculerDBService<R> extends moleculer.Service<DbServiceSettings> {
  public metadata!: {
    $category: string;
    $official: boolean;
    $name: string;
    $version: string;
    $repo?: string;
  };
  public adapter!: DbAdapter;

  public connect!: () => Promise<void>;

  /**
   * Disconnect from database.
   */
  public disconnect!: () => Promise<void>;

  /**
   * Sanitize context parameters at `find` action.
   *
   * @param {Context} ctx
   * @param {any} origParams
   * @returns {Promise}
   */
  public sanitizeParams!: (ctx: Context, params?: DbContextParameters) => Promise<any>;

  /**
   * Get entity(ies) by ID(s).
   *
   * @methods
   * @param {String|Number|Array} id - ID or IDs.
   * @param {Boolean} decoding - Need to decode IDs.
   * @returns {Object|Array<Object>} Found entity(ies).
   */
  public getById!: (id: string | number | string[], decoding?: boolean) => Promise<R>;

  /**
   * Clear the cache & call entity lifecycle events
   *
   * @param {String} type
   * @param {Object|Array|Number} json
   * @param {Context} ctx
   * @returns {Promise}
   */
  public entityChanged!: (type: string, json: number | any[] | any, ctx: Context) => Promise<R>;

  /**
   * Clear cached entities
   *
   * @methods
   * @returns {Promise}
   */
  public clearCache!: () => Promise<void>;

  /**
   * Transform the fetched documents
   *
   * @param {Array|Object}  docs
   * @param {Object}      Params
   * @returns {Array|Object}
   */
  public transformDocuments!: (ctx: Context, params: any, docs: any) => Promise<R | R[]>;

  /**
   * Filter fields in the entity object
   *
   * @param {Object}  doc
   * @param {Array}  fields  Filter properties of model.
   * @returns  {Object}
   */
  public filterFields!: (doc: any, fields: Partial<R>[]) => Partial<R>[];

  /**
   * Authorize the required field list. Remove fields which is not exist in the `this.settings.fields`
   *
   * @param {Array} fields
   * @returns {Array}
   */
  public authorizeFields!: (fields: Partial<R>[]) => Partial<R>[];

  /**
   * Populate documents.
   *
   * @param {Context}    ctx
   * @param {Array|Object}  docs
   * @param {Array}      populateFields
   * @returns  {Promise}
   */
  public populateDocs!: <R>(ctx: Context, docs: any, populateFields: any[]) => Promise<R>;

  /**
   * Validate an entity by validator.
   *
   * @param {T} entity
   * @returns {Promise}
   */
  public validateEntity!: <T, R>(entity: T) => Promise<R>;

  /**
   * Encode ID of entity.
   *
   * @methods
   * @param {any} id
   * @returns {R}
   */
  public encodeID!: <R>(id: any) => R;

  /**
   * Decode ID of entity.
   *
   * @methods
   * @param {R} id
   * @returns {R}
   */
  public decodeID!: <R>(id: any) => R;

  /**
   * Service started lifecycle event handler
   */
  // Started!: () => Promise<void>;

  /**
   * Service stopped lifecycle event handler
   */
  // Stopped!: () => Promise<void>;

  /**
   * Service created lifecycle event handler
   */
  // Created!: () => Promise<void>;

  /**
   * Find entities by query.
   *
   * @methods
   *
   * @param {Context} ctx - Context instance.
   * @param {Object?} params - Parameters.
   *
   * @returns {Array<Object>} List of found entities.
   */
  public _find!: (ctx: Context, params: any) => Promise<R[]>;

  /**
   * Get count of entities by query.
   *
   * @methods
   *
   * @param {Context} ctx - Context instance.
   * @param {Object?} params - Parameters.
   *
   * @returns {Number} Count of found entities.
   */
  public _count!: (ctx: Context, params: any) => Promise<number>;

  /**
   * List entities by filters and pagination results.
   *
   * @methods
   *
   * @param {Context} ctx - Context instance.
   * @param {Object?} params - Parameters.
   *
   * @returns {Object} List of found entities and count.
   */
  public _list!: (ctx: Context, params: any) => Promise<DBPagination<R>>;

  /**
   * Create a new entity.
   *
   * @methods
   *
   * @param {Context} ctx - Context instance.
   * @param {Object?} params - Parameters.
   *
   * @returns {Object} Saved entity.
   */
  public _create!: (ctx: Context, params: any) => Promise<R>;

  /**
   * Create many new entities.
   *
   * @methods
   *
   * @param {Context} ctx - Context instance.
   * @param {Object?} params - Parameters.
   *
   * @returns {Object|Array.<Object>} Saved entity(ies).
   */
  public _insert!: (ctx: Context, params: any) => Promise<R | R[]>;

  /**
   * Get entity by ID.
   *
   * @methods
   *
   * @param {Context} ctx - Context instance.
   * @param {Object?} params - Parameters.
   *
   * @returns {Object|Array<Object>} Found entity(ies).
   *
   * @throws {EntityNotFoundError} - 404 Entity not found
   */
  public _get!: (ctx: Context, params: any) => Promise<R | R[]>;

  /**
   * Update an entity by ID.
   * > After update, clear the cache & call lifecycle events.
   *
   * @methods
   *
   * @param {Context} ctx - Context instance.
   * @param {Object?} params - Parameters.
   * @returns {Object} Updated entity.
   *
   * @throws {EntityNotFoundError} - 404 Entity not found
   */
  public _update!: (ctx: Context, params: any) => Promise<R>;

  /**
   * Remove an entity by ID.
   *
   * @methods
   *
   * @param {Context} ctx - Context instance.
   * @param {Object?} params - Parameters.
   *
   * @throws {EntityNotFoundError} - 404 Entity not found
   */
  public _remove!: (ctx: Context, params: any) => Promise<void>;
}

export interface RouteSchemaOpts {
  path: string;
  whitelist?: string[];
  authorization?: boolean;
  authentication?: boolean;
  types?: UserType[];
  aliases?: any;
}

export interface RouteSchema {
  path: string;
  mappingPolicy?: 'restricted' | 'all';
  opts: RouteSchemaOpts;
  middlewares: ((req: any, res: any, next: any) => void)[];
  authorization?: boolean;
  authentication?: boolean;
  logging?: boolean;
  etag?: boolean;
  cors?: any;
  rateLimit?: any;
  whitelist?: string[];
  hasWhitelist: boolean;
  callOptions?: any;
}

export interface RequestMessage extends IncomingMessage {
  $action: ActionSchema;
  $params: ActionParamSchema;
  $route: RouteSchema;
}

export type QueryObject = { [key: string]: any };
