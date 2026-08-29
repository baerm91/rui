import test from 'node:test';
import assert from 'node:assert/strict';
import { readOAuthCallbackError, retryFutureJwtError } from '../src/platform/supabaseClient.js';

test('OAuth callback errors are read from query parameters', () => {
  assert.equal(
    readOAuthCallbackError({ search: '?error=access_denied', hash: '' }),
    'Die Google-Anmeldung wurde abgebrochen. Bitte versuchen Sie es erneut.'
  );
});

test('OAuth signup database errors get an actionable message', () => {
  assert.equal(
    readOAuthCallbackError({
      search: '',
      hash: '#error=server_error&error_description=Database+error+saving+new+user'
    }),
    'Das Konto konnte nicht freigeschaltet werden. Bitte wenden Sie sich an die RIU-Administration.'
  );
});

test('JWT clock skew callback errors get an actionable message', () => {
  assert.equal(
    readOAuthCallbackError({
      search: '?error=server_error&error_description=JWT+issued+at+future',
      hash: ''
    }),
    'Die Anmeldung wurde durch eine vorübergehende Zeitabweichung bei Supabase verhindert. Bitte versuchen Sie es erneut.'
  );
});

test('future JWT errors are retried without retrying unrelated errors', async () => {
  let attempts = 0;
  const result = await retryFutureJwtError(async () => {
    attempts += 1;
    if (attempts < 3) throw Object.assign(new Error('JWT issued at future'), { code: 'PGRST303' });
    return 'ok';
  }, [0, 0]);
  assert.equal(result, 'ok');
  assert.equal(attempts, 3);

  await assert.rejects(
    retryFutureJwtError(async () => { throw new Error('permission denied'); }, [0]),
    /permission denied/
  );
});

test('successful OAuth callbacks do not report an error', () => {
  assert.equal(readOAuthCallbackError({ search: '?code=abc', hash: '' }), '');
});
