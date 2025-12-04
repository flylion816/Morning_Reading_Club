#!/bin/bash

# ========== 晨读营项目 API 测试脚本 ==========
# 用途: 测试所有新增和已有的API接口
# 使用: bash .claude/commands/testing/test-all-apis.sh [token]
# 说明: 在项目根目录执行此脚本
# 更新日期: 2025-12-04

set -e

API_BASE="http://localhost:3000/api/v1"

# 颜色定义
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# 测试统计
TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0

log_info() {
  echo -e "${BLUE}ℹ️  $1${NC}"
}

log_success() {
  echo -e "${GREEN}✅ $1${NC}"
}

log_error() {
  echo -e "${RED}❌ $1${NC}"
}

log_warning() {
  echo -e "${YELLOW}⚠️  $1${NC}"
}

test_api() {
  local test_name="$1"
  local method="$2"
  local endpoint="$3"
  local data="$4"
  local expected_status="$5"
  
  TOTAL_TESTS=$((TOTAL_TESTS + 1))
  
  log_info "测试: $test_name"
  
  local curl_cmd="curl -s -w '\n%{http_code}' -X $method $API_BASE$endpoint"
  
  if [ -n "$TOKEN" ]; then
    curl_cmd="$curl_cmd -H 'Authorization: Bearer $TOKEN'"
  fi
  
  curl_cmd="$curl_cmd -H 'Content-Type: application/json'"
  
  if [ -n "$data" ]; then
    curl_cmd="$curl_cmd -d '$data'"
  fi
  
  response=$(eval "$curl_cmd")
  http_code=$(echo "$response" | tail -n1)
  body=$(echo "$response" | head -n-1)
  
  echo "  Method: $method $endpoint"
  echo "  HTTP Code: $http_code"
  
  if [ $http_code -eq 200 ] || [ $http_code -eq 201 ] || [ $http_code -eq 400 ] || [ $http_code -eq 401 ] || [ $http_code -eq 403 ] || [ $http_code -eq 404 ]; then
    echo "  Response (partial): $(echo "$body" | python3 -m json.tool 2>/dev/null | head -3)..."
  fi
  
  if [ "$http_code" = "$expected_status" ]; then
    log_success "$test_name - HTTP $http_code"
    PASSED_TESTS=$((PASSED_TESTS + 1))
  else
    log_error "$test_name - Expected $expected_status but got $http_code"
    echo "  Full Response: $body"
    FAILED_TESTS=$((FAILED_TESTS + 1))
  fi
  
  echo ""
}

main() {
  echo "========== 🚀 晨读营 API 测试套件 =========="
  echo ""
  
  log_info "检查后端服务..."
  health=$(curl -s $API_BASE/health)
  
  if echo "$health" | grep -q "healthy"; then
    log_success "后端服务正常运行"
  else
    log_error "后端服务未运行"
    exit 1
  fi
  
  echo ""
  
  if [ -z "$TOKEN" ]; then
    log_info "没有提供TOKEN，尝试自动登录..."
    login_response=$(curl -s -X POST $API_BASE/auth/admin/login \
      -H "Content-Type: application/json" \
      -d '{"email":"admin@morningreading.com","password":"admin123456"}')
    
    TOKEN=$(echo "$login_response" | grep -o '"token":"[^"]*' | cut -d'"' -f4 || echo "")
    
    if [ -z "$TOKEN" ]; then
      log_warning "登录失败，将进行无认证测试"
    else
      log_success "登录成功，已获得Token"
    fi
  fi
  
  echo ""
  echo "========== 📝 API 接口测试 =========="
  echo ""
  
  # ========== 用户相关API ==========
  echo "### 1️⃣  用户接口 (Users API)"
  echo ""
  
  test_api "GET /users/me - 获取当前用户信息" "GET" "/users/me" "" "200"
  
  # 新增: 2025-12-04 - GET /users/:userId
  test_api "GET /users/:userId - 获取他人用户信息" "GET" "/users/test_user_id" "" "404"
  
  echo ""
  echo "### 2️⃣  小凡看见接口 (Insights API)"
  echo ""
  
  # 新增: 2025-12-04 - POST /insights/requests
  test_api "POST /insights/requests - 创建查看申请" "POST" "/insights/requests" \
    '{"toUserId":"test_user_id"}' "400"

  # 新增: 2025-12-04 - GET /insights/requests/received
  test_api "GET /insights/requests/received - 获取收到的申请" "GET" "/insights/requests/received" "" "200"

  # 新增: 2025-12-04 - GET /insights/requests/sent
  test_api "GET /insights/requests/sent - 获取发起的申请" "GET" "/insights/requests/sent" "" "200"

  # 新增: 2025-12-04 - PUT /insights/requests/:requestId/revoke (用户撤销权限)
  test_api "PUT /insights/requests/:id/revoke - 用户撤销权限" "PUT" "/insights/requests/test_request_id/revoke" "" "404"

  # 新增: 2025-12-04 - PUT /admin/insights/requests/:requestId/approve (管理员同意)
  test_api "PUT /admin/insights/requests/:id/approve - 管理员同意申请" "PUT" "/admin/insights/requests/test_request_id/approve" \
    '{"periodId":"test_period_id"}' "404"

  # 新增: 2025-12-04 - PUT /admin/insights/requests/:requestId/reject (管理员拒绝)
  test_api "PUT /admin/insights/requests/:id/reject - 管理员拒绝申请" "PUT" "/admin/insights/requests/test_request_id/reject" \
    '{"adminNote":"test"}' "404"

  # 新增: 2025-12-04 - DELETE /admin/insights/requests/:requestId (管理员删除)
  test_api "DELETE /admin/insights/requests/:id - 管理员删除申请" "DELETE" "/admin/insights/requests/test_request_id" \
    '{"adminNote":"test"}' "404"

  # 新增: 2025-12-04 - GET /admin/insights/requests (获取所有申请)
  test_api "GET /admin/insights/requests - 获取所有申请" "GET" "/admin/insights/requests" "" "200"

  # 新增: 2025-12-04 - GET /admin/insights/requests/stats (获取统计)
  test_api "GET /admin/insights/requests/stats - 获取申请统计" "GET" "/admin/insights/requests/stats" "" "200"

  echo ""
  echo "### 3️⃣  系统接口 (System API)"
  echo ""
  
  test_api "GET /health - 健康检查" "GET" "/health" "" "200"
  
  # ========== 测试总结 ==========
  echo ""
  echo "========== 📊 测试总结 =========="
  echo "总测试数: $TOTAL_TESTS"
  echo -e "通过: ${GREEN}$PASSED_TESTS${NC}"
  echo -e "失败: ${RED}$FAILED_TESTS${NC}"
  
  if [ $FAILED_TESTS -eq 0 ]; then
    log_success "所有测试通过！"
    echo ""
    echo "💡 提示: 添加新接口时，请在此脚本中添加相应的test_api调用"
    return 0
  else
    log_error "$FAILED_TESTS 个测试失败"
    return 1
  fi
}

main "$@"
