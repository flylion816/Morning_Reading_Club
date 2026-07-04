#!/bin/zsh
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT_DIR"

echo "Mini Program tenant upload"
echo "This will read tenant config from the backend Admin API, apply the tenant, and upload via miniprogram-ci."
echo

slug="${1:-}"
version="${2:-}"
desc="${3:-}"
api_base_url="${TENANT_SYNC_API_BASE_URL:-https://wx.shubai01.com/api/v1}"
admin_email="${TENANT_SYNC_ADMIN_EMAIL:-}"
admin_password="${TENANT_SYNC_ADMIN_PASSWORD:-}"

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

printf "Admin API base URL [%s]: " "$api_base_url"
read -r input_api_base_url
if [[ -n "$input_api_base_url" ]]; then
  api_base_url="$input_api_base_url"
fi

if [[ -z "$admin_email" ]]; then
  printf "Admin email: "
  read -r admin_email
fi

if [[ -z "$admin_password" ]]; then
  printf "Admin password: "
  stty -echo
  read -r admin_password
  stty echo
  echo
fi

if [[ -z "$admin_email" || -z "$admin_password" ]]; then
  echo "Missing admin email or password."
  exit 1
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
TENANT_SYNC_API_BASE_URL="$api_base_url" \
TENANT_SYNC_ADMIN_EMAIL="$admin_email" \
TENANT_SYNC_ADMIN_PASSWORD="$admin_password" \
  npm run tenant:push -- "${args[@]}"

echo
echo "Done. Press Enter to close."
read -r _
