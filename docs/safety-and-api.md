# Safety and Telegram API notes

## Safe-use boundary

ATLAS requests public HTTP pages only. It does not retrieve private source code, databases, files, or APIs. It does not authenticate, circumvent bot checks, submit forms, execute downloaded scripts, probe ports, or evade a 403/429. Publicly visible facts are separated from any inferred technology statement in the report (the first version currently only presents observed headers).

## Network checks

Every initial URL and redirect must use HTTP/HTTPS and a standard port. Credentials, private/local hostnames, and DNS answers outside public unicast space are rejected. DNS is rechecked immediately before the socket connection and a response is bounded by size/time limits. Redirect count and crawl scope are bounded.

## Bot API

The integration uses the official HTTPS Bot API directly and includes long polling, inline callback buttons, message text editing, document upload, getChat/getChatMember, and getMe. Telegram API reference: https://core.telegram.org/bots/api. Changelog: https://core.telegram.org/bots/api-changelog. No Telegram Web App, widget, or external dashboard is used.
