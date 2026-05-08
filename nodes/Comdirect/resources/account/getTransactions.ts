import type { INodeProperties } from 'n8n-workflow';

const show = { resource: ['account'], operation: ['getTransactions'] };

export const accountTransactionsDescription: INodeProperties[] = [
	{
		displayName: 'Return All',
		name: 'returnAll',
		type: 'boolean',
		displayOptions: { show },
		default: false,
		description: 'Whether to return all results or only up to a given limit',
		routing: {
			send: {
				paginate: '={{ $value }}',
			},
			operations: {
				pagination: {
					type: 'offset',
					properties: {
						limitParameter: 'paging-count',
						offsetParameter: 'paging-first',
						type: 'query',
						pageSize: 1000,
					},
				},
			},
		},
	},
	{
		displayName: 'Limit',
		name: 'limit',
		type: 'number',
		typeOptions: { minValue: 1, maxValue: 1000 },
		displayOptions: { show: { ...show, returnAll: [false] } },
		default: 50,
		description: 'Max number of results to return',
		routing: {
			send: {
				type: 'query',
				property: 'paging-count',
			},
			output: {
				maxResults: '={{$value}}',
			},
		},
	},
	{
		displayName: 'Filters',
		name: 'filters',
		type: 'collection',
		placeholder: 'Add Filter',
		displayOptions: { show },
		default: {},
		options: [
			{
				displayName: 'Transaction State',
				name: 'transactionState',
				type: 'options',
				default: 'BOOKED',
				options: [
					{ name: 'Booked', value: 'BOOKED' },
					{ name: 'Not Booked', value: 'NOTBOOKED' },
					{ name: 'Both', value: 'BOTH' },
				],
				routing: { request: { qs: { 'transactionState': '={{$value}}' } } },
			},
			{
				displayName: 'Transaction Direction',
				name: 'transactionDirection',
				type: 'options',
				default: 'CREDIT_AND_DEBIT',
				options: [
					{ name: 'Credit Only', value: 'CREDIT' },
					{ name: 'Debit Only', value: 'DEBIT' },
					{ name: 'Both', value: 'CREDIT_AND_DEBIT' },
				],
				routing: { request: { qs: { 'transactionDirection': '={{$value}}' } } },
			},
			{
				displayName: 'Min Booking Date',
				name: 'minBookingDate',
				type: 'dateTime',
				default: '',
				description: 'Earliest booking date (inclusive). Date is sent as YYYY-MM-DD.',
				routing: {
					request: {
						qs: {
							'min-bookingDate':
								'={{ $value ? new Date($value).toISOString().slice(0, 10) : undefined }}',
						},
					},
				},
			},
			{
				displayName: 'Max Booking Date',
				name: 'maxBookingDate',
				type: 'dateTime',
				default: '',
				description: 'Latest booking date (inclusive). Date is sent as YYYY-MM-DD.',
				routing: {
					request: {
						qs: {
							'max-bookingDate':
								'={{ $value ? new Date($value).toISOString().slice(0, 10) : undefined }}',
						},
					},
				},
			},
		],
	},
];
