import test from 'node:test';
import assert from 'node:assert/strict';
import { readOAuthCallbackError } from '../src/platform/supabaseClient.js';

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

test('successful OAuth callbacks do not report an error', () => {
  assert.equal(readOAuthCallbackError({ search: '?code=abc', hash: '' }), '');
});
