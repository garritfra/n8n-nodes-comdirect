import type { INodeProperties } from 'n8n-workflow';

const show = { resource: ['depot'], operation: ['getPosition'] };

export const depotPositionDescription: INodeProperties[] = [
	{
		displayName: 'Position ID',
		name: 'positionId',
		type: 'string',
		required: true,
		default: '',
		displayOptions: { show },
		description: 'The depot position UUID',
	},
];
