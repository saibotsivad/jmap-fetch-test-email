# JMAP: Fetch Test Email

Wait for and fetch a sent email over [JMAP](https://jmap.io/), e.g. for integration tests of email-sending tools.

## Install

The usual way:

```bash
npm install jmap-fetch-test-email
```

## Example

If you have an integration test where a user-login event sends an email, and you want to assert that the email arrived
and contained some property:

```js
import { fetchEmail } from 'jmap-fetch-test-email'
import delve from 'dlv'

async function waitAndFetch() {
	const email = await fetchEmail({
		username: 'you@site.com',
		password: 'battery-horse-staple',
		hostname: 'betajmap.fastmail.com',
		subject: 'New login alert!'
	})
	if (!email) {
		// could not find email after waiting a while
	} else {
		// assert things about the email
	}
}
```

## Searching

You'll probably need a bit more control on searching for the correct email, so there are a few options: `subject`, `body`, or `find`.

Note that at least one of the three search options must be specified.

### `subject`

You can specify a string for exact comparison:

```js
fetchEmail({
	username: '...',
	password: '...',
	hostname: '...',
	subject: 'New login alert!'
})
```

Or a regex for more complex searches:

```js
fetchEmail({
	username: '...',
	password: '...',
	hostname: '...',
	subject: /^New login alert!$/
})
```

**Note:** if you modify the `emailGetProperties` you must make sure it includes `subject` or an error will be thrown.

### `body`

Similarly, you can search for a string in the HTML and plaintext body.

You can specify a string, which will use the `String.includes` method:

```js
fetchEmail({
	username: '...',
	password: '...',
	hostname: '...',
	body: 'Login attempt from 192.168.1.1'
})
```

Or specify a regex for more complex searches:

```js
fetchEmail({
	username: '...',
	password: '...',
	hostname: '...',
	subject: /^Login attempt from \d{1-3}/
})
```

**Note:** if you modify the `emailGetProperties` you must make sure it includes `htmlBody` and `bodyValues` and ensure that you do not set `emailGetFetchHtmlBodyValues` to false (the default is `true`), or an error will be thrown.

### `find`

If you need something more complex, you can specify a function which will be called on all retry attempts, and will contain the full list of emails.

Simply return the email, if you find it, and the function will complete.

For example, using [cheerio](https://github.com/cheeriojs/cheerio) to traverse the HTML:

```js
import cheerio from 'cheerio'

fetchEmail({
	username: '...',
	password: '...',
	hostname: '...',
	find: emails => emails.find(email => {
		const $ = cheerio.load(email._html)
		const ipAddress = $('.ip-address', '#login').text()
		return ipAddress === '192.168.1.1'
	})
})
```

**Note:** the property `_html` is not JMAP spec standard, it is a convenience property added on so that you don't have to pull out the `bodyValues` manually yourself.

### Options

The full list of options you can pass in.

#### `username: String` *required*

The JMAP username, typically the email address.

#### `password: String` *required*

The JMAP password.

#### `hostname: String` *required*

The hostname of the JMAP server.

#### `subject: (String|RegExp)`

A string or regular expression used to find an email by matching to the email subject text.

#### `body: (String|RegExp)`

A string or regular expression used to find an email by matching to the email plaintext or HTML text--both are checked where available.

#### `find: Function(Array<Object>)`

A function used to find an email, it is passed the full list of emails after every retry fetch.

#### `mailboxName: String` (default: `inbox`)

The mailbox name to look in for emails.

#### `emailQueryLimit: Integer` (default: `5`)

The limit to specify when fetching emails from the JMAP server.

#### `emailGetProperties: Array<String>` (default: *see below*)

The default properties that will be fetched are:

- `id`
- `subject`
- `receivedAt`
- `htmlBody`
- `sender`
- `bodyValues`

#### `emailGetFetchHtmlBodyValues: String` (default: `true`)

If you don't want to return the HTML body in the JMAP fetch request, presumably for efficiency optimizations, you can set this to `false` to disable it.

#### `maximumRetryCount: Integer` (default: `10`)

The maximum number of retries before giving up.

#### `retryDelayMillis: Integer` (default: `3000`)

The number of milliseconds to wait between retries.

## License

Published and released with love under the [Very Open License](http://veryopenlicense.com)
