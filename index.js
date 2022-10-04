import { setTimeout as delay } from 'node:timers/promises'
import { get, post } from 'httpie'
import delve from 'dlv'

const using = [
	'urn:ietf:params:jmap:core',
	'urn:ietf:params:jmap:mail',
]

export const fetchEmail = async ({
	username,
	password,
	token,
	hostname,
	subject,
	body,
	find,
	mailboxName = 'inbox',
	emailQueryLimit = 5,
	emailGetProperties = [
		'id',
		'subject',
		'receivedAt',
		'htmlBody',
		'sender',
		'bodyValues',
	],
	emailGetFetchHtmlBodyValues = true,
	maximumRetryCount = 10,
	retryDelayMillis = 3000,
}) => {
	if (!username || !hostname || (!password && !token)) {
		throw new Error('Username, hostname, and either a password or token must be provided.')
	}
	if (!subject && !body && !find) {
		throw new Error('You must provide at least one of "subject", "body", and "find".')
	}

	const headers = { 'Content-Type': 'application/json' }
	if (password) headers.Authorization = `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`
	if (token) headers.Authorization = `Bearer ${token}`

	const response = await get(`https://${hostname}/.well-known/jmap`, { headers })
	const { apiUrl } = response.data
	const accountId = response.data.primaryAccounts['urn:ietf:params:jmap:mail']

	const mailboxIdResponse = await post(apiUrl, {
		headers,
		body: {
			using,
			methodCalls: [
				[
					'Mailbox/query',
					{
						accountId,
						filter: { role: mailboxName, hasAnyRole: true },
					},
					'a',
				],
			],
		},
	})
	const mailboxId = delve(mailboxIdResponse, 'data.methodResponses.0.1.ids.0')
	if (!mailboxId) {
		throw new Error(`Could not locate mailbox with name "${mailboxName}".`)
	}

	const queryForEmail = async () => post(apiUrl, {
		headers,
		body: {
			using,
			methodCalls: [
				[
					'Email/query',
					{
						accountId,
						filter: { inMailbox: mailboxId },
						sort: [ { property: 'receivedAt', isAscending: false } ],
						limit: emailQueryLimit,
					},
					'a',
				],
				[
					'Email/get',
					{
						accountId,
						properties: emailGetProperties,
						fetchHTMLBodyValues: emailGetFetchHtmlBodyValues,
						'#ids': {
							resultOf: 'a',
							name: 'Email/query',
							path: '/ids/*',
						},
					},
					'b',
				],
			],
		},
	})

	let retryCount = 0
	let email
	while (retryCount < maximumRetryCount && !email) {
		const response = await queryForEmail()
		const emails = delve(response, 'data.methodResponses.1.1.list')
		if (!Array.isArray(emails)) {
			throw new Error(`Unexpected email query response! ${JSON.stringify(response.data)}`)
		}

		if (body || find) {
			emails.forEach(email => {
				if (emailGetFetchHtmlBodyValues) {
					email._html = (email.htmlBody || []).map(({ partId }) => delve(email, `bodyValues.${partId}.value`)).join('\n')
				}
			})
		}

		const filteredEmails = emails.filter(email => {
			const subjectMatches = subject && (
				(typeof subject === 'string' && email.subject === subject)
				|| (subject.constructor.name === 'RegExp' && subject.test(email.subject))
			)
			const bodyMatches = body && (
				(typeof body === 'string' && email._html.includes(email.body))
				|| (body.constructor.name === 'RegExp' && body.test(email._html))
			)
			return (!subject || subjectMatches) && (!body || bodyMatches)
		})

		email = find
			? find(filteredEmails)
			: filteredEmails[0]

		if (!email) {
			console.log(`Found ${emails.length} emails${emails.length ? ', but none matching' : ''}. Waiting to retry...`)
			retryCount++
			await delay(retryDelayMillis)
		}
	}

	return email
}
