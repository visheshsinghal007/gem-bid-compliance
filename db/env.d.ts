declare namespace Cloudflare {
  interface Env {
    DB: D1Database;
    DOCUMENTS: R2Bucket;
    OPENAI_API_KEY?: string;
    OPENAI_MODEL?: string;
    AUTH_MODE?: string;
  }
}
