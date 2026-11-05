/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as access from "../access.js";
import type * as admin from "../admin.js";
import type * as adminCatalog from "../adminCatalog.js";
import type * as auth from "../auth.js";
import type * as catalog from "../catalog.js";
import type * as http from "../http.js";
import type * as lib_audit from "../lib/audit.js";
import type * as lib_images from "../lib/images.js";
import type * as lib_validate from "../lib/validate.js";
import type * as seed from "../seed.js";
import type * as settings from "../settings.js";
import type * as users from "../users.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  access: typeof access;
  admin: typeof admin;
  adminCatalog: typeof adminCatalog;
  auth: typeof auth;
  catalog: typeof catalog;
  http: typeof http;
  "lib/audit": typeof lib_audit;
  "lib/images": typeof lib_images;
  "lib/validate": typeof lib_validate;
  seed: typeof seed;
  settings: typeof settings;
  users: typeof users;
}>;

export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
