#!/bin/bash
# Retired (owner 2026-11-16): the server no longer rebuilds its own token DB. The one source is
# data/hexod_db/hexod_db.json in git, cleaned and validated by the agents; update.sh deploys it.
echo "wiki_refresh.sh is retired: the database comes from git (data/hexod_db/hexod_db.json). Run deploy/update.sh."
exit 0
