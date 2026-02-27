const express = require('express');
const path = require('path');
const app = express();

// 提供静态文件
app.use(express.static(path.join(__dirname, '../admin/dist')));

// 处理 SPA 路由
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../admin/dist/index.html'));
});

const PORT = 5173;
app.listen(PORT, () => {
  console.log(`✅ 管理后台已启动: http://localhost:${PORT}`);
});
