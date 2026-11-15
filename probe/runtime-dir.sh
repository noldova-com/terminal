#!/usr/bin/env bash
set -u
uid="$(id -u)"
dir="/run/user/$uid"
log() { echo "PROBE $(date +%T.%3N) $*"; }
log "user $(id -un) uid $uid XDG_RUNTIME_DIR=${XDG_RUNTIME_DIR-unset} TMPDIR=${TMPDIR-unset} DOTNET_SHARED=${DOTNET_SHARED_MEMORY_DIRECTORY-unset}"
log "dir: $(ls -ld "$dir" 2>&1)"
log "dotnet: $(ls -la "$dir/.dotnet" "$dir/.dotnet/shm" 2>&1 | tr '\n' ' ')"
log "sessions: $(loginctl list-sessions --no-legend 2>&1 | tr '\n' ';')"
log "user: $(loginctl show-user "$uid" -p State -p Linger -p Sessions 2>&1 | tr '\n' ' ')"
log "units: runtime-dir $(systemctl is-active "user-runtime-dir@$uid.service" 2>&1), user $(systemctl is-active "user@$uid.service" 2>&1)"
log "logind: $(grep -hE '^(RemoveIPC|KillUserProcesses)' /etc/systemd/logind.conf /etc/systemd/logind.conf.d/*.conf 2>/dev/null | tr '\n' ' ')"
log "runner: $(ps -o pid,ppid,sid,user,cmd -p $$ -p $PPID 2>&1 | tr '\n' ';')"
since="$(date '+%Y-%m-%d %H:%M:%S')"
(
  last=""
  while true; do
    if [ -d "$dir" ]; then state=present; else state=missing; fi
    if [ "$state" != "$last" ]; then log "dir $state"; last="$state"; fi
    sleep 0.2
  done
) &
watcher=$!
node node_modules/vitest/vitest.mjs run src/noldova.terminal/tests/services/shell-integration.e2e.test.ts -t pwsh "$@"
code=$?
kill "$watcher"
log "dir after: $(ls -ld "$dir" 2>&1)"
log "sessions after: $(loginctl list-sessions --no-legend 2>&1 | tr '\n' ';')"
sudo journalctl --since "$since" --no-pager 2>&1 | grep -iE "logind|session|user-runtime|run/user|user@$uid" | tail -60 | sed 's/^/PROBE journal /'
exit "$code"
