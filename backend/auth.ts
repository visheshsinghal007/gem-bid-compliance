import { env } from 'cloudflare:workers';
import { HttpError } from './validation';
export function authenticate(request: Request) {
  const url = new URL(request.url);
  const local =
    import.meta.env.DEV &&
    ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    const origin = request.headers.get('origin');
    if (origin && origin !== url.origin)
      throw new HttpError(403, 'Cross-origin requests are blocked');
    if (request.headers.get('sec-fetch-site') === 'cross-site')
      throw new HttpError(403, 'Cross-site requests are blocked');
  }
  if (local) return { id: 'local-developer', name: 'Local reviewer' };
  if (env.AUTH_MODE !== 'sites')
    throw new HttpError(
      503,
      'Authentication is not configured. Set AUTH_MODE=sites only behind the Sites authenticated gateway.',
    );
  const id = request.headers.get('oai-authenticated-user-id');
  if (!id) throw new HttpError(401, 'Sign in to open this workspace');
  return {
    id,
    name: request.headers.get('oai-authenticated-user-email') || id,
  };
}
