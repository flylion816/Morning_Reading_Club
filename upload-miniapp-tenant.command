#!/bin/zsh
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT_DIR"

echo "Mini Program tenant upload"
echo "This will sync tenant config, apply the tenant, and upload via miniprogram-ci."
echo

slug="${1:-}"
version="${2:-}"
desc="${3:-}"

if [[ -z "$slug" ]]; then
  printf "Tenant slug: "
  read -r slug
fi

if [[ -z "$slug" ]]; then
  echo "Missing tenant slug."
  exit 1
fi

if [[ -z "$version" ]]; then
  printf "Version (optional, press Enter for default): "
  read -r version
fi

if [[ -z "$desc" ]]; then
  printf "Upload description (optional, press Enter for default): "
  read -r desc
fi

args=("$slug")
if [[ -n "$version" ]]; then
  args+=("$version")
fi
if [[ -n "$desc" ]]; then
  if [[ -z "$version" ]]; then
    version="1.0.0-$(date +%F)"
    args+=("$version")
  fi
  args+=("$desc")
fi

echo
echo "Running: npm run tenant:push -- ${args[*]}"
echo
npm run tenant:push -- "${args[@]}"

echo
echo "Done. Press Enter to close."
read -r _
