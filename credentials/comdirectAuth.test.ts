import {
	authenticate,
	ComdirectAuthError,
	ComdirectCredentialState,
	HttpHelper,
	HttpRequest,
	HttpResponse,
} from './comdirectAuth';

const baseCredential: ComdirectCredentialState = {
	clientId: 'test-client',
	clientSecret: 'test-secret',
	zugangsnummer: '12345678',
	pin: '123456',
};

function makeHttp(
	handlers: Array<(req: HttpRequest) => HttpResponse>,
	fallback?: (req: HttpRequest) => HttpResponse,
): { http: HttpHelper; calls: HttpRequest[] } {
	const calls: HttpRequest[] = [];
	let i = 0;
	const http: HttpHelper = async (req) => {
		calls.push(req);
		const handler = handlers[i++];
		if (handler) return handler(req);
		if (fallback) return fallback(req);
		throw new Error(`Unexpected request #${i}: ${req.method} ${req.url}`);
	};
	return { http, calls };
}

const noSleep = async () => {};

describe('comdirect authenticate — bootstrap', () => {
	test('happy path runs all bootstrap steps and returns final tokens', async () => {
		const { http, calls } = makeHttp([
			// 1. /oauth/token (password grant)
			() => ({
				statusCode: 200,
				headers: {},
				body: { access_token: 'prelim', refresh_token: 'prelim-r', expires_in: 599 },
			}),
			// 2. GET sessions
			() => ({
				statusCode: 200,
				headers: {},
				body: [{ identifier: 'sess-1', sessionTanActive: false, activated2FA: false }],
			}),
			// 3. POST validate → P_TAN_PUSH challenge with status-check link
			() => ({
				statusCode: 201,
				headers: {
					'x-once-authentication-info': JSON.stringify({
						id: 'chal-1',
						typ: 'P_TAN_PUSH',
						link: { href: '/api/session/v1/authentications/chal-1' },
					}),
				},
				body: {},
			}),
			// 4. GET status — first poll returns PENDING
			() => ({
				statusCode: 200,
				headers: {},
				body: { authenticationId: 'chal-1', status: 'PENDING' },
			}),
			// 5. GET status — user has now approved on phone
			() => ({
				statusCode: 200,
				headers: {},
				body: { authenticationId: 'chal-1', status: 'AUTHENTICATED' },
			}),
			// 6. PATCH activate session
			() => ({ statusCode: 200, headers: {}, body: {} }),
			// 7. /oauth/token (cd_secondary)
			() => ({
				statusCode: 200,
				headers: {},
				body: {
					access_token: 'final-a',
					refresh_token: 'final-r',
					expires_in: 599,
					scope: 'BANKING_RO BROKERAGE_RW SESSION_RW',
				},
			}),
		]);

		const result = await authenticate(http, baseCredential, noSleep);

		expect(result.accessToken).toBe('final-a');
		expect(result.refreshToken).toBe('final-r');
		expect(result.sessionId).toMatch(/^[0-9a-f]{32}$/);
		expect(calls).toHaveLength(7);
		expect(calls[0].url).toContain('/oauth/token');
		expect(calls[2].headers?.['x-once-authentication-info']).toContain('P_TAN_PUSH');
		expect(calls[3].method).toBe('GET');
		expect(calls[3].url).toContain('/api/session/v1/authentications/chal-1');
		expect(calls[5].method).toBe('PATCH');
	});

	test('wrong PIN surfaces INVALID_CREDENTIALS', async () => {
		const { http } = makeHttp([
			() => ({
				statusCode: 401,
				headers: {},
				body: { error: 'invalid_grant', error_description: 'Bad credentials' },
			}),
		]);

		await expect(authenticate(http, baseCredential, noSleep)).rejects.toMatchObject({
			code: 'INVALID_CREDENTIALS',
		});
	});

	test('photoTAN-Push timeout produces PHOTO_TAN_TIMEOUT', async () => {
		const { http } = makeHttp(
			[
				() => ({
					statusCode: 200,
					headers: {},
					body: { access_token: 'prelim', refresh_token: 'prelim-r' },
				}),
				() => ({ statusCode: 200, headers: {}, body: [{ identifier: 'sess-1' }] }),
				() => ({
					statusCode: 201,
					headers: {
						'x-once-authentication-info': JSON.stringify({
							id: 'chal-1',
							typ: 'P_TAN_PUSH',
							link: { href: '/api/session/v1/authentications/chal-1' },
						}),
					},
					body: {},
				}),
			],
			// Fallback: every status poll returns PENDING until the timeout.
			() => ({
				statusCode: 200,
				headers: {},
				body: { authenticationId: 'chal-1', status: 'PENDING' },
			}),
		);

		await expect(
			authenticate(http, baseCredential, noSleep, {
				pollInitialDelayMs: 0,
				pollIntervalMs: 1,
				pollTimeoutMs: 5,
			}),
		).rejects.toMatchObject({ code: 'PHOTO_TAN_TIMEOUT' });
	});

	test('non-PUSH challenge type fails fast with PHOTO_TAN_NOT_AVAILABLE', async () => {
		const { http } = makeHttp([
			() => ({
				statusCode: 200,
				headers: {},
				body: { access_token: 'prelim', refresh_token: 'prelim-r' },
			}),
			() => ({ statusCode: 200, headers: {}, body: [{ identifier: 'sess-1' }] }),
			() => ({
				statusCode: 201,
				headers: {
					'x-once-authentication-info': JSON.stringify({ id: 'chal-1', typ: 'M_TAN' }),
				},
				body: {},
			}),
		]);

		await expect(authenticate(http, baseCredential, noSleep)).rejects.toMatchObject({
			code: 'PHOTO_TAN_NOT_AVAILABLE',
		});
	});
});

describe('comdirect authenticate — refresh', () => {
	const stateWithRefresh: ComdirectCredentialState = {
		...baseCredential,
		accessToken: 'old-a',
		refreshToken: 'old-r',
		sessionId: 'sess-1',
	};

	test('happy path returns new tokens and preserves sessionId', async () => {
		const { http, calls } = makeHttp([
			() => ({
				statusCode: 200,
				headers: {},
				body: { access_token: 'new-a', refresh_token: 'new-r', expires_in: 599 },
			}),
		]);

		const result = await authenticate(http, stateWithRefresh, noSleep);

		expect(result.accessToken).toBe('new-a');
		expect(result.refreshToken).toBe('new-r');
		expect(result.sessionId).toBe('sess-1');
		expect(calls).toHaveLength(1);
		const body = calls[0].body;
		expect(body).toBeInstanceOf(URLSearchParams);
		expect((body as URLSearchParams).get('grant_type')).toBe('refresh_token');
		expect((body as URLSearchParams).get('refresh_token')).toBe('old-r');
	});

	test('expired refresh token falls through to bootstrap', async () => {
		const { http, calls } = makeHttp([
			// Refresh fails
			() => ({ statusCode: 400, headers: {}, body: { error: 'invalid_grant' } }),
			// Bootstrap retries from step 1
			() => ({
				statusCode: 200,
				headers: {},
				body: { access_token: 'prelim', refresh_token: 'prelim-r' },
			}),
			() => ({ statusCode: 200, headers: {}, body: [{ identifier: 'sess-2' }] }),
			() => ({
				statusCode: 201,
				headers: {
					'x-once-authentication-info': JSON.stringify({
						id: 'chal-1',
						typ: 'P_TAN_PUSH',
						link: { href: '/api/session/v1/authentications/chal-1' },
					}),
				},
				body: {},
			}),
			// Status poll: AUTHENTICATED on first try
			() => ({
				statusCode: 200,
				headers: {},
				body: { authenticationId: 'chal-1', status: 'AUTHENTICATED' },
			}),
			// PATCH activate
			() => ({ statusCode: 200, headers: {}, body: {} }),
			// cd_secondary
			() => ({
				statusCode: 200,
				headers: {},
				body: { access_token: 'final-a', refresh_token: 'final-r' },
			}),
		]);

		const result = await authenticate(http, stateWithRefresh, noSleep);

		expect(result.accessToken).toBe('final-a');
		expect(result.sessionId).not.toBe('sess-1'); // new session id generated
		expect(calls).toHaveLength(7);
	});
});

describe('ComdirectAuthError', () => {
	test('carries a code and a message', () => {
		const err = new ComdirectAuthError('boom', 'INVALID_CREDENTIALS');
		expect(err.code).toBe('INVALID_CREDENTIALS');
		expect(err.message).toBe('boom');
		expect(err.name).toBe('ComdirectAuthError');
	});
});
