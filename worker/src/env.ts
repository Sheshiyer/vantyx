export interface Env {
  /** Per-tenant config documents, keyed `config:<slug>`. */
  CONFIG: KVNamespace;
  /** Private bucket of panorama + branding assets, prefixed by tenant slug. */
  MEDIA: R2Bucket;
  /** Product apex domain used to resolve the tenant from the Host header. */
  PRODUCT_APEX: string;
}
