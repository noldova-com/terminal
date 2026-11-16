set -e
sudo apt-get update -qq
sudo DEBIAN_FRONTEND=noninteractive apt-get -o DPkg::Lock::Timeout=600 install -y --no-install-recommends zsh fish
insecure="$(zsh -c 'autoload -Uz compaudit; compaudit' 2>/dev/null)" || true
if [ -n "$insecure" ]; then
  printf '%s\n' "$insecure" | while IFS= read -r folder; do sudo chmod g-w,o-w "$folder"; done
fi
for shell in bash pwsh zsh fish; do
  file="$(command -v "$shell")" || continue
  grep -qxF "$file" /etc/shells || printf '%s\n' "$file" | sudo tee -a /etc/shells > /dev/null
done
cat /etc/shells
