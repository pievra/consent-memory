# Pievra

A browser extension that applies, remembers and verifies your website privacy preferences. Optional purposes are refused by default.

Status: early development. Not released. See `docs/qa/implementation-status.md` and `docs/qa/quality-score.md`.

## Develop

```bash
corepack enable
pnpm install --frozen-lockfile
pnpm typecheck && pnpm lint && pnpm test
pnpm build && pnpm check:bundle
pnpm test:e2e
```

Browser tests need a Chromium or Chrome for Testing build. Set `CHROMIUM_PATH` to use one already installed.

## Licence

This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0. If a copy of the MPL was not distributed with this file, You can obtain one at https://mozilla.org/MPL/2.0/.

The notice above applies to every file in this repository unless a file states otherwise. Third party components are listed in `THIRD_PARTY_NOTICES.md`.

Published by MRNIE SAS, 16 rue du Dragon, 75006 Paris, France (RCS Paris 109 701 664). Contact: contact@pievra.com.
