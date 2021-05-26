import { fetchEmail } from './index.js'

const test = async () => {
	const email = await fetchEmail({
		username: process.env.JMAP_USERNAME,
		password: process.env.JMAP_PASSWORD,
		hostname: process.env.JMAP_HOSTNAME,
		find: emails => {
			return emails[0]
		},
	})
	if (email) {
		console.log('Found email:', email)
	} else {
		console.log('Could not find the email after retries.')
	}
}

test()
	.then(() => {
		console.log('Completed.')
	})
	.catch(error => {
		console.error('Unexpected error.', error)
	})
