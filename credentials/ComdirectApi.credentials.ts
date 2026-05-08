import { sleep } from 'n8n-workflow';
import type {
	IAuthenticateGeneric,
	ICredentialDataDecryptedObject,
	ICredentialTestRequest,
	ICredentialType,
	IDataObject,
	IHttpRequestHelper,
	IHttpRequestOptions,
	Icon,
	INodeProperties,
} from 'n8n-workflow';
import {
	authenticate as runAuthFlow,
	COMDIRECT_BASE_URL,
	HttpHelper,
	HttpRequest,
} from './comdirectAuth';

export class ComdirectApi implements ICredentialType {
	name = 'comdirectApi';

	displayName = 'Comdirect API';

	icon: Icon = 'file:../icons/comdirect.svg';

	documentationUrl = 'https://www.comdirect.de/cms/kontakt-zugaenge-api.html';

	properties: INodeProperties[] = [
		{
			displayName: 'Client ID',
			name: 'clientId',
			type: 'string',
			typeOptions: { password: true },
			default: '',
			required: true,
			description: 'OAuth2 client_id issued by comdirect',
		},
		{
			displayName: 'Client Secret',
			name: 'clientSecret',
			type: 'string',
			typeOptions: { password: true },
			default: '',
			required: true,
			description: 'OAuth2 client_secret issued by comdirect',
		},
		{
			displayName: 'Zugangsnummer',
			name: 'zugangsnummer',
			type: 'string',
			default: '',
			required: true,
			placeholder: '12345678',
			description: 'Your 8-digit comdirect customer access number',
		},
		{
			displayName: 'PIN',
			name: 'pin',
			type: 'string',
			typeOptions: { password: true },
			default: '',
			required: true,
			description: 'Your 6-digit online-banking PIN',
		},
		{
			displayName:
				'When you click <b>Save</b>, comdirect sends a photoTAN-Push notification to your phone. Open the comdirect photoTAN app and approve the request — Save will complete automatically once approved.',
			name: 'saveBehaviorNotice',
			type: 'notice',
			default: '',
		},
		{
			displayName: 'Access Token',
			name: 'accessToken',
			type: 'hidden',
			typeOptions: { expirable: true, password: true },
			default: '',
		},
		{
			displayName: 'Refresh Token',
			name: 'refreshToken',
			type: 'hidden',
			typeOptions: { password: true },
			default: '',
		},
		{
			displayName: 'Session ID',
			name: 'sessionId',
			type: 'hidden',
			default: '',
		},
	];

	async preAuthentication(this: IHttpRequestHelper, credentials: ICredentialDataDecryptedObject) {
		const http: HttpHelper = async (req: HttpRequest) => {
			const opts: IHttpRequestOptions = {
				method: req.method,
				url: req.url,
				headers: req.headers as IDataObject | undefined,
				returnFullResponse: true,
				ignoreHttpStatusErrors: true,
			};

			if (req.body instanceof URLSearchParams) {
				opts.body = req.body.toString();
				opts.json = false;
			} else if (typeof req.body === 'string') {
				opts.body = req.body;
				opts.json = false;
			} else if (req.body !== undefined) {
				// Plain object — let n8n serialize as JSON.
				opts.body = req.body as IDataObject;
				opts.json = true;
			}

			const response = (await this.helpers.httpRequest(opts)) as {
				statusCode: number;
				headers: Record<string, string | string[] | undefined>;
				body: unknown;
			};

			let parsedBody: unknown = response.body;
			if (typeof parsedBody === 'string' && parsedBody.length > 0) {
				try {
					parsedBody = JSON.parse(parsedBody);
				} catch {
					// non-JSON body — pass through as-is.
				}
			}

			return {
				statusCode: response.statusCode,
				headers: response.headers ?? {},
				body: parsedBody,
			};
		};

		const tokens = await runAuthFlow(
			http,
			{
				clientId: credentials.clientId as string,
				clientSecret: credentials.clientSecret as string,
				zugangsnummer: credentials.zugangsnummer as string,
				pin: credentials.pin as string,
				accessToken: (credentials.accessToken as string) || undefined,
				refreshToken: (credentials.refreshToken as string) || undefined,
				sessionId: (credentials.sessionId as string) || undefined,
			},
			sleep,
		);

		return {
			accessToken: tokens.accessToken,
			refreshToken: tokens.refreshToken,
			sessionId: tokens.sessionId,
		};
	}

	authenticate: IAuthenticateGeneric = {
		type: 'generic',
		properties: {
			headers: {
				Authorization: '=Bearer {{$credentials.accessToken}}',
				'x-http-request-info':
					'={{ JSON.stringify({ clientRequestId: { sessionId: $credentials.sessionId, requestId: Date.now().toString().slice(-9) } }) }}',
				Accept: 'application/json',
			},
		},
	};

	test: ICredentialTestRequest = {
		request: {
			baseURL: COMDIRECT_BASE_URL,
			url: '/api/session/clients/user/v1/sessions',
			method: 'GET',
		},
	};
}
