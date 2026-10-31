#!/bin/sh
# Install alongside deploy-server.sh, mode 700.
# Used as this dedicated key's authorized_keys forced command.
set -eu
script_dir=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
exec "$script_dir/deploy-server.sh" "${SSH_ORIGINAL_COMMAND:-}"
