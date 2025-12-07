#!/bin/bash
# 启动小程序开发脚本
# 说明：小程序通过微信开发工具运行，此脚本提供快速启动信息

# 颜色定义
BLUE='\033[0;34m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${BLUE}════════════════════════════════════════════${NC}"
echo -e "${BLUE}🚀 小程序开发指南${NC}"
echo -e "${BLUE}════════════════════════════════════════════${NC}"
echo ""

echo -e "${GREEN}📋 小程序项目位置:${NC}"
echo "  $(pwd)/miniprogram"
echo ""

echo -e "${GREEN}🛠️ 使用微信开发者工具:${NC}"
echo "  1. 打开微信开发者工具"
echo "  2. 点击 '导入项目'"
echo "  3. 选择项目根目录中的 'miniprogram' 文件夹"
echo "  4. 点击 '导入' 按钮"
echo ""

echo -e "${GREEN}⚙️ 开发配置:${NC}"
echo "  • 后端地址: http://localhost:3000/api/v1"
echo "  • 小程序AppID: 需要配置在微信公众平台"
echo ""

echo -e "${YELLOW}💡 开发流程:${NC}"
echo "  1. 确保后端服务已启动 (.claude/commands/development/start-backend.sh)"
echo "  2. 打开微信开发工具，导入 miniprogram 目录"
echo "  3. 在开发工具中编辑代码、实时预览"
echo "  4. 使用真机扫码测试"
echo ""

echo -e "${GREEN}📚 相关文件:${NC}"
echo "  • miniprogram/app.json - 小程序配置"
echo "  • miniprogram/config/ - 配置文件目录"
echo "  • miniprogram/pages/ - 页面目录"
echo "  • miniprogram/components/ - 组件目录"
echo ""

echo -e "${YELLOW}🔗 快速链接:${NC}"
echo "  • 微信开发者工具: https://developers.weixin.qq.com/miniprogram/dev/devtools/download.html"
echo "  • 小程序文档: https://developers.weixin.qq.com/miniprogram/dev/framework/"
echo "  • WeUI组件库: https://github.com/wechat-miniprogram/weui-miniprogram"
echo ""

exit 0
