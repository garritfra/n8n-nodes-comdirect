import type {
	IExecuteSingleFunctions,
	IN8nHttpFullResponse,
	INodeExecutionData,
	INodeProperties,
} from 'n8n-workflow';
import { documentGetManyDescription } from './getMany';
import { documentGetDescription } from './get';

const showOnlyForDocument = { resource: ['document'] };

async function attachBinary(
	this: IExecuteSingleFunctions,
	items: INodeExecutionData[],
	response: IN8nHttpFullResponse,
): Promise<INodeExecutionData[]> {
	const headers = response.headers ?? {};
	const contentType = String(headers['content-type'] ?? 'application/octet-stream');
	const contentDisposition = String(headers['content-disposition'] ?? '');
	const filenameMatch = contentDisposition.match(/filename="?([^";]+)"?/i);
	const fileName = filenameMatch?.[1] ?? 'document.pdf';

	const buffer = Buffer.isBuffer(response.body)
		? (response.body as Buffer)
		: Buffer.from(response.body as ArrayBuffer);
	const binaryData = await this.helpers.prepareBinaryData(buffer, fileName, contentType);

	return [
		{
			json: { fileName, contentType, size: buffer.length },
			binary: { data: binaryData },
		},
	];
}

export const documentDescription: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: { show: showOnlyForDocument },
		options: [
			{
				name: 'Get Many',
				value: 'getMany',
				action: 'Get many documents',
				description: 'List documents in your PostBox',
				routing: {
					request: {
						method: 'GET',
						url: '/api/messages/clients/user/v2/documents',
					},
					output: {
						postReceive: [
							{ type: 'rootProperty', properties: { property: 'values' } },
						],
					},
				},
			},
			{
				name: 'Get',
				value: 'get',
				action: 'Get a document as binary',
				description: 'Download a single document as binary data',
				routing: {
					request: {
						method: 'GET',
						url: '=/api/messages/v2/documents/{{$parameter.documentId}}',
						headers: { Accept: 'application/pdf' },
						encoding: 'arraybuffer',
						returnFullResponse: true,
					},
					output: { postReceive: [attachBinary] },
				},
			},
		],
		default: 'getMany',
	},
	...documentGetManyDescription,
	...documentGetDescription,
];
