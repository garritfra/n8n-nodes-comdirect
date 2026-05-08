/* eslint-disable @n8n/community-nodes/require-node-api-error */
/**
 * comdirect REST API authentication flow.
 *
 * Implements the 5-step photoTAN-Push login plus refresh-token rotation, as
 * documented in the comdirect REST API Schnittstellenspezifikation (April 2020).
 *
 * Pure module — no n8n imports — so it can be unit-tested with a mocked HTTP
 * helper. Throws a typed `ComdirectAuthError`; the credential layer maps these
 * onto the appropriate n8n error type at the call site.
 */

export const COMDIRECT_BASE_URL = 'https://api.comdirect.de';

export type ComdirectCredentialState = {
	clientId: string;
	clientSecret: string;
	zugangsnummer: string;
	pin: string;
	accessToken?: string;
	refreshToken?: string;
	sessionId?: string;
};

export type ComdirectTokens = {
	accessToken: string;
	refreshToken: string;
	sessionId: string;
};

export type HttpResponse<T = unknown> = {
	statusCode: number;
	headers: Record<string, string | string[] | undefined>;
	body: T;
};

export type HttpRequest = {
	method: 'GET' | 'POST' | 'PATCH' | 'DELETE';
	url: string;
	headers?: Record<string, string>;
	body?: string | URLSearchParams | object;
};

export type HttpHelper = (req: HttpRequest) => Promise<HttpResponse>;

export type AuthOptions = {
	pollIntervalMs?: number;
	pollTimeoutMs?: number;
	pollInitialDelayMs?: number;
};

const DEFAULT_POLL_INITIAL_DELAY_MS = 3000;
const DEFAULT_POLL_INTERVAL_MS = 3000;
const DEFAULT_POLL_TIMEOUT_MS = 110000;

export class ComdirectAuthError extends Error {
	constructor(
		message: string,
		public readonly code: ComdirectAuthErrorCode,
	) {
		super(message);
		this.name = 'ComdirectAuthError';
	}
}

export type ComdirectAuthErrorCode =
	| 'INVALID_CREDENTIALS'
	| 'PHOTO_TAN_TIMEOUT'
	| 'PHOTO_TAN_NOT_AVAILABLE'
	| 'REFRESH_FAILED'
	| 'UNEXPECTED_RESPONSE';

export type Sleep = (ms: number) => Promise<void>;

/**
 * Authenticate against the comdirect API.
 *
 * If a refresh token is present, attempts a refresh-token rotation. On refresh
 * failure, falls through to a full bootstrap (5-step photoTAN-Push login). If
 * no refresh token is present, runs the full bootstrap directly.
 */
export async function authenticate(
	http: HttpHelper,
	state: ComdirectCredentialState,
	sleep: Sleep,
	opts: AuthOptions = {},
): Promise<ComdirectTokens> {
	if (state.refreshToken) {
		try {
			return await refreshAccess(http, state);
		} catch (err) {
			if (err instanceof ComdirectAuthError && err.code === 'REFRESH_FAILED') {
				// Fall through to a full bootstrap. The user will need to approve on
				// their phone again — acceptable when re-saving the credential.
			} else {
				throw err;
			}
		}
	}
	return bootstrap(http, state, opts, sleep);
}

async function bootstrap(
	http: HttpHelper,
	state: ComdirectCredentialState,
	opts: AuthOptions,
	sleep: Sleep,
): Promise<ComdirectTokens> {
	const sessionId = generateSessionId();

	const initial = await postOAuthToken(http, {
		client_id: state.clientId,
		client_secret: state.clientSecret,
		grant_type: 'password',
		username: state.zugangsnummer,
		password: state.pin,
	});
	if (initial.statusCode !== 200 || !isTokenResponse(initial.body)) {
		throw new ComdirectAuthError(
			'Initial OAuth token request failed. Check your Zugangsnummer, PIN, client_id and client_secret.',
			'INVALID_CREDENTIALS',
		);
	}
	const prelimAccessToken = initial.body.access_token;

	const sessionResp = await http({
		method: 'GET',
		url: `${COMDIRECT_BASE_URL}/api/session/clients/user/v1/sessions`,
		headers: jsonHeaders(prelimAccessToken, sessionId),
	});
	const sessions = sessionResp.body;
	if (sessionResp.statusCode !== 200 || !Array.isArray(sessions) || sessions.length === 0) {
		throw new ComdirectAuthError(
			'Could not fetch session object from comdirect.',
			'UNEXPECTED_RESPONSE',
		);
	}
	const sessionIdentifier = (sessions[0] as { identifier?: string }).identifier;
	if (!sessionIdentifier) {
		throw new ComdirectAuthError(
			'Session object did not include an identifier.',
			'UNEXPECTED_RESPONSE',
		);
	}

	const validateResp = await http({
		method: 'POST',
		url: `${COMDIRECT_BASE_URL}/api/session/clients/user/v1/sessions/${sessionIdentifier}/validate`,
		headers: {
			...jsonHeaders(prelimAccessToken, sessionId),
			'x-once-authentication-info': JSON.stringify({ typ: 'P_TAN_PUSH' }),
		},
		body: {
			identifier: sessionIdentifier,
			sessionTanActive: true,
			activated2FA: true,
		},
	});
	if (validateResp.statusCode !== 201) {
		throw new ComdirectAuthError(
			'Session validation request was rejected. Make sure photoTAN-Push is activated on your account.',
			'PHOTO_TAN_NOT_AVAILABLE',
		);
	}
	const challenge = parseChallenge(validateResp.headers['x-once-authentication-info']);
	if (!challenge || challenge.typ !== 'P_TAN_PUSH') {
		throw new ComdirectAuthError(
			'comdirect did not issue a photoTAN-Push challenge. Activate photoTAN-Push on your account.',
			'PHOTO_TAN_NOT_AVAILABLE',
		);
	}
	if (!challenge.statusHref) {
		throw new ComdirectAuthError(
			'comdirect did not return a status-check URL for the photoTAN-Push challenge.',
			'UNEXPECTED_RESPONSE',
		);
	}

	await waitForApproval(
		http,
		challenge.statusHref,
		prelimAccessToken,
		sessionId,
		opts.pollInitialDelayMs ?? DEFAULT_POLL_INITIAL_DELAY_MS,
		opts.pollIntervalMs ?? DEFAULT_POLL_INTERVAL_MS,
		opts.pollTimeoutMs ?? DEFAULT_POLL_TIMEOUT_MS,
		sleep,
	);

	const activateResp = await http({
		method: 'PATCH',
		url: `${COMDIRECT_BASE_URL}/api/session/clients/user/v1/sessions/${sessionIdentifier}`,
		headers: {
			...jsonHeaders(prelimAccessToken, sessionId),
			'x-once-authentication-info': JSON.stringify({ id: challenge.id }),
		},
		body: {
			identifier: sessionIdentifier,
			sessionTanActive: true,
			activated2FA: true,
		},
	});
	if (activateResp.statusCode !== 200) {
		throw new ComdirectAuthError(
			`Session activation failed after approval (status ${activateResp.statusCode}, body ${formatBody(activateResp.body)}).`,
			'UNEXPECTED_RESPONSE',
		);
	}

	const finalResp = await postOAuthToken(http, {
		client_id: state.clientId,
		client_secret: state.clientSecret,
		grant_type: 'cd_secondary',
		token: prelimAccessToken,
	});
	if (finalResp.statusCode !== 200 || !isTokenResponse(finalResp.body)) {
		throw new ComdirectAuthError(
			'Final cd_secondary token exchange failed.',
			'UNEXPECTED_RESPONSE',
		);
	}

	return {
		accessToken: finalResp.body.access_token,
		refreshToken: finalResp.body.refresh_token,
		sessionId,
	};
}

async function waitForApproval(
	http: HttpHelper,
	statusHref: string,
	prelimAccessToken: string,
	sessionId: string,
	initialDelayMs: number,
	intervalMs: number,
	timeoutMs: number,
	sleep: Sleep,
): Promise<void> {
	// Status-check URL is returned as a relative path (e.g.
	// /api/session/v1/authentications/{id}). Resolve against the base.
	const statusUrl = statusHref.startsWith('http')
		? statusHref
		: `${COMDIRECT_BASE_URL}${statusHref}`;

	// Brief initial delay to let comdirect's backend register the challenge
	// with the photoTAN app before we start polling.
	await sleep(initialDelayMs);

	const deadline = Date.now() + timeoutMs;
	let lastStatus: string | undefined;
	let lastHttpStatus = 0;
	let lastBody: unknown;
	while (Date.now() < deadline) {
		const resp = await http({
			method: 'GET',
			url: statusUrl,
			headers: jsonHeaders(prelimAccessToken, sessionId),
		});
		lastHttpStatus = resp.statusCode;
		lastBody = resp.body;
		if (resp.statusCode === 200 && isStatusResponse(resp.body)) {
			lastStatus = resp.body.status;
			if (lastStatus === 'AUTHENTICATED') return;
			// Any non-PENDING terminal status (e.g. CANCELED, EXPIRED) is a
			// hard failure — no point continuing to poll.
			if (lastStatus !== 'PENDING') {
				throw new ComdirectAuthError(
					`photoTAN-Push approval ended in unexpected status "${lastStatus}".`,
					'UNEXPECTED_RESPONSE',
				);
			}
		}
		await sleep(intervalMs);
	}
	throw new ComdirectAuthError(
		`Timed out waiting for photoTAN-Push approval (last status ${lastStatus ?? `HTTP ${lastHttpStatus}`}, body ${formatBody(lastBody)}). ` +
			'Open the comdirect photoTAN app on your phone, approve within the timeout, and re-save the credential.',
		'PHOTO_TAN_TIMEOUT',
	);
}

type StatusResponse = { authenticationId: string; status: string };

function isStatusResponse(body: unknown): body is StatusResponse {
	if (!body || typeof body !== 'object') return false;
	const b = body as Record<string, unknown>;
	return typeof b.status === 'string';
}

function formatBody(body: unknown): string {
	if (body == null) return '<empty>';
	if (typeof body === 'string') return body.slice(0, 200);
	try {
		return JSON.stringify(body).slice(0, 200);
	} catch {
		return String(body).slice(0, 200);
	}
}

async function refreshAccess(
	http: HttpHelper,
	state: ComdirectCredentialState,
): Promise<ComdirectTokens> {
	if (!state.refreshToken || !state.sessionId) {
		throw new ComdirectAuthError('Missing refresh token or session id.', 'REFRESH_FAILED');
	}
	const resp = await postOAuthToken(http, {
		client_id: state.clientId,
		client_secret: state.clientSecret,
		grant_type: 'refresh_token',
		refresh_token: state.refreshToken,
	});
	if (resp.statusCode !== 200 || !isTokenResponse(resp.body)) {
		throw new ComdirectAuthError(
			'Refresh-token rotation failed. The 20-minute idle window probably lapsed; re-save the credential to re-authenticate.',
			'REFRESH_FAILED',
		);
	}
	return {
		accessToken: resp.body.access_token,
		refreshToken: resp.body.refresh_token,
		sessionId: state.sessionId,
	};
}

async function postOAuthToken(
	http: HttpHelper,
	form: Record<string, string>,
): Promise<HttpResponse> {
	const body = new URLSearchParams(form);
	return http({
		method: 'POST',
		url: `${COMDIRECT_BASE_URL}/oauth/token`,
		headers: {
			Accept: 'application/json',
			'Content-Type': 'application/x-www-form-urlencoded',
		},
		body,
	});
}

function jsonHeaders(accessToken: string, sessionId: string): Record<string, string> {
	return {
		Accept: 'application/json',
		'Content-Type': 'application/json',
		Authorization: `Bearer ${accessToken}`,
		'x-http-request-info': JSON.stringify({
			clientRequestId: { sessionId, requestId: requestIdNow() },
		}),
	};
}

function parseChallenge(
	header: string | string[] | undefined,
): { id: string; typ: string; statusHref?: string } | undefined {
	const raw = Array.isArray(header) ? header[0] : header;
	if (!raw) return undefined;
	try {
		const parsed = JSON.parse(raw) as {
			id?: string;
			typ?: string;
			link?: { href?: string };
		};
		if (typeof parsed.id !== 'string' || typeof parsed.typ !== 'string') return undefined;
		return {
			id: parsed.id,
			typ: parsed.typ,
			statusHref: parsed.link?.href,
		};
	} catch {
		return undefined;
	}
}

type TokenResponse = {
	access_token: string;
	refresh_token: string;
	expires_in?: number;
	scope?: string;
};

function isTokenResponse(body: unknown): body is TokenResponse {
	if (!body || typeof body !== 'object') return false;
	const b = body as Record<string, unknown>;
	return typeof b.access_token === 'string' && typeof b.refresh_token === 'string';
}

export function generateSessionId(): string {
	const chars = '0123456789abcdef';
	let out = '';
	for (let i = 0; i < 32; i++) out += chars[Math.floor(Math.random() * 16)];
	return out;
}

export function requestIdNow(): string {
	// 9-digit number derived from epoch ms; matches the format suggested in the
	// comdirect spec (HHmmssSSS).
	return Date.now().toString().slice(-9);
}

