#!/usr/bin/env bash
set -u
log() { echo "PROBE $(date +%T.%3N) $*"; }
log "pwsh $(pwsh -NoProfile -Command '"$($PSVersionTable.PSVersion) on .NET $([Environment]::Version)"')"
log "PSReadLine $(pwsh -NoProfile -Command '(Get-Module -ListAvailable PSReadLine | Select-Object -First 1).Version.ToString()')"
base="$(mktemp -d)"
rounds=30
processes=8
failed=0
enoent=0
for round in $(seq 1 "$rounds"); do
  runtime="$base/round-$round"
  mkdir -m 700 "$runtime"
  for process in $(seq 1 "$processes"); do
    XDG_RUNTIME_DIR="$runtime" pwsh -NoProfile -NonInteractive -Command '$m = [System.Threading.Mutex]::new($false, "NoldovaProbe"); $m.Dispose()' > "$runtime.out-$process" 2>&1 &
  done
  wait
  for process in $(seq 1 "$processes"); do
    if [ -s "$runtime.out-$process" ]; then
      failed=$((failed + 1))
      if grep -q "errno == ENOENT" "$runtime.out-$process"; then enoent=$((enoent + 1)); fi
      if [ "$failed" -le 3 ]; then log "round $round process $process: $(tr '\n' ' ' < "$runtime.out-$process" | cut -c1-600)"; fi
    fi
  done
done
log "failed $failed of $((rounds * processes)) processes, $enoent with errno ENOENT, in $rounds fresh runtime folders of $processes at once"
prepared=0
for round in $(seq 1 "$rounds"); do
  runtime="$base/prepared-$round"
  mkdir -m 700 "$runtime" "$runtime/.dotnet" "$runtime/.dotnet/shm"
  for process in $(seq 1 "$processes"); do
    XDG_RUNTIME_DIR="$runtime" pwsh -NoProfile -NonInteractive -Command '$m = [System.Threading.Mutex]::new($false, "NoldovaProbe"); $m.Dispose()' > "$runtime.out-$process" 2>&1 &
  done
  wait
  for process in $(seq 1 "$processes"); do
    if [ -s "$runtime.out-$process" ]; then prepared=$((prepared + 1)); fi
  done
done
log "with .dotnet/shm made first: failed $prepared of $((rounds * processes)) processes"
