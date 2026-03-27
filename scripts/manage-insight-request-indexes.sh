#!/bin/bash

set -euo pipefail

ACTION="${1:-inspect}"

SERVER_USER="ubuntu"
SERVER_IP="118.25.145.179"
SSH_KEY="${HOME}/.ssh/id_rsa"
REMOTE_BACKEND_DIR="/var/www/morning-reading/backend"

if [[ "${ACTION}" != "inspect" && "${ACTION}" != "apply" ]]; then
  echo "用法: bash scripts/manage-insight-request-indexes.sh [inspect|apply]"
  exit 1
fi

ssh -i "${SSH_KEY}" -o StrictHostKeyChecking=no "${SERVER_USER}@${SERVER_IP}" bash -s -- "${ACTION}" "${REMOTE_BACKEND_DIR}" <<'EOF'
set -euo pipefail

ACTION="$1"
REMOTE_BACKEND_DIR="$2"

cd "${REMOTE_BACKEND_DIR}"

MONGO_URI=$(grep '^MONGODB_URI=' .env | cut -d= -f2-)

if [[ -z "${MONGO_URI}" ]]; then
  echo "未找到 MONGODB_URI，请检查 ${REMOTE_BACKEND_DIR}/.env"
  exit 1
fi

detect_mongo_runner() {
  if command -v mongosh >/dev/null 2>&1; then
    echo "host:mongosh"
    return 0
  fi

  if command -v mongo >/dev/null 2>&1; then
    echo "host:mongo"
    return 0
  fi

  if command -v docker >/dev/null 2>&1; then
    local container=""

    for name in morning-reading-mongodb-prod morning-reading-mongodb; do
      if docker ps -a --format '{{.Names}}' | grep -qx "${name}"; then
        container="${name}"
        break
      fi
    done

    if [[ -n "${container}" ]]; then
      if docker exec "${container}" sh -lc 'command -v mongosh >/dev/null 2>&1'; then
        echo "docker:${container}:mongosh"
        return 0
      fi

      if docker exec "${container}" sh -lc 'command -v mongo >/dev/null 2>&1'; then
        echo "docker:${container}:mongo"
        return 0
      fi
    fi
  fi

  return 1
}

run_mongo_script() {
  local runner="$1"
  local script_file="$2"

  case "${runner}" in
    host:mongosh)
      echo "使用宿主机 mongosh 执行"
      mongosh "${MONGO_URI}" --quiet < "${script_file}"
      ;;
    host:mongo)
      echo "使用宿主机 mongo 执行"
      mongo "${MONGO_URI}" --quiet < "${script_file}"
      ;;
    docker:*:mongosh)
      local container="${runner#docker:}"
      container="${container%:mongosh}"
      echo "使用 Docker 容器 ${container} 内的 mongosh 执行"
      docker exec -i "${container}" sh -lc 'mongosh "$1" --quiet' -- "${MONGO_URI}" < "${script_file}"
      ;;
    docker:*:mongo)
      local container="${runner#docker:}"
      container="${container%:mongo}"
      echo "使用 Docker 容器 ${container} 内的 mongo 执行"
      docker exec -i "${container}" sh -lc 'mongo "$1" --quiet' -- "${MONGO_URI}" < "${script_file}"
      ;;
    *)
      echo "未识别的 Mongo 执行器: ${runner}"
      return 1
      ;;
  esac
}

RUNNER="$(detect_mongo_runner || true)"

if [[ -z "${RUNNER}" ]]; then
  echo "未找到可用的 Mongo Shell。请检查宿主机或 MongoDB 容器内是否安装了 mongosh/mongo。"
  exit 1
fi

TMP_SCRIPT="$(mktemp)"
trap 'rm -f "${TMP_SCRIPT}"' EXIT

if [[ "${ACTION}" == "inspect" ]]; then
  cat > "${TMP_SCRIPT}" <<'MONGO'
print("=== insight_requests indexes ===");
printjson(db.insight_requests.getIndexes());
MONGO
  run_mongo_script "${RUNNER}" "${TMP_SCRIPT}"
  exit 0
fi

cat > "${TMP_SCRIPT}" <<'MONGO'
print("=== BEFORE ===");
printjson(db.insight_requests.getIndexes());

const indexes = db.insight_requests.getIndexes();
const oldIndex = indexes.find(index =>
  index.key &&
  index.key.fromUserId === 1 &&
  index.key.toUserId === 1 &&
  index.key.status === 1 &&
  index.key.insightId === undefined
);

if (oldIndex) {
  print(`Dropping old index: ${oldIndex.name}`);
  db.insight_requests.dropIndex(oldIndex.name);
} else {
  print("Old unique pending index not found, skip drop");
}

print("Creating new unique pending index for insightId...");
db.insight_requests.createIndex(
  { fromUserId: 1, toUserId: 1, insightId: 1, status: 1 },
  { unique: true, partialFilterExpression: { status: "pending" } }
);

print("Ensuring updatedAt index...");
db.insight_requests.createIndex({ updatedAt: -1 });

print("=== AFTER ===");
printjson(db.insight_requests.getIndexes());
MONGO

run_mongo_script "${RUNNER}" "${TMP_SCRIPT}"
EOF
