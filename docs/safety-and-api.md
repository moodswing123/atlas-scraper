# Safety and Telegram API notes

## Safe-use boundary

ATLAS requests public HTTP pages only. It does not retrieve private source code, databases, files, or APIs. It does not authenticate, circumvent bot checks, submit forms, execute downloaded scripts, probe ports, or evade a 403/429. Publicly visible facts are separated from any inferred technology statement in the report (the first version currently only presents observed headers).

## Network checks

Every initial URL and redirect must use HTTP/HTTPS and a standard port. Credentials, private/local hostnames, and DNS answers outside public unicast space are rejected. DNS is rechecked immediately before the socket connection and a response is bounded by size/time limits. Redirect count and crawl scope are bounded.

## Bot API

The integration uses the official HTTPS Bot API directly and includes long polling, inline callback buttons, message text editing, document upload, getChat/getChatMember, and getMe. Telegram API reference: https://core.telegram.org/bots/api. Changelog: https://core.telegram.org/bots/api-changelog. No Telegram Web App, widget, or external dashboard is used.

The interface targets Bot API 10.5 (22 November 2026). The official `InlineKeyboardButton` type documents the optional `style` values `primary` (blue), `success` (green), and `danger` (red), plus optional `icon_custom_emoji_id` under Telegram's stated premium/eligibility conditions. ATLAS uses the documented style field for action hierarchy; the Telegram client controls the exact rendered appearance. Sources: https://core.telegram.org/bots/api#inlinekeyboardbutton and https://core.telegram.org/bots/api-changelog.
