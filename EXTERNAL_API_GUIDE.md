# 晨读营外部系统API调用指南

本文档为外部系统提供了两个公开API接口，用于与晨读营系统进行集成。

---

## 📌 接口概览

| API | 方法 | 端点 | 说明 |
|-----|------|------|------|
| 创建小凡看见 | POST | `/api/v1/insights/external/create` | 为指定用户创建"小凡看见" |
| 获取期次用户 | GET | `/api/v1/enrollments/external/users-by-period` | 获取某期次的所有参与用户 |

---

## 🔌 API #1: 创建小凡看见

### 接口说明

为指定用户在某个期次中创建一条"小凡看见"记录。小凡看见是对用户在学习中的表现、进步或特点的观察记录。

### 请求信息

**HTTP方法**: `POST`

**URL**: `http://localhost:3000/api/v1/insights/external/create`

**Content-Type**: `application/json`

### 请求参数

| 参数 | 类型 | 必填 | 说明 | 示例 |
|------|------|------|------|------|
| periodName | string | ✅ | 期次名称（精确匹配） | `"平衡之道"` |
| targetUserId | string | ✅ | 被看见人的用户ID | `"692fe16a962d558224f4133f"` |
| content | string | ⭕ | 文字内容（与imageUrl二选一） | `"感谢你的坚持和付出"` |
| imageUrl | string | ⭕ | 图片地址（与content二选一） | `"https://example.com/image.jpg"` |
| day | number | ❌ | 第几天的课程（可选） | `7` |

**⭕ 说明**: content 和 imageUrl 必须至少填写一个

### 成功响应示例

**HTTP状态码**: `200 OK`

```json
{
  "code": 200,
  "message": "小凡看见创建成功",
  "data": {
    "_id": "6934dd8ae345a7b83afdb660",
    "userId": {
      "_id": "692fe16a962d558224f4133f",
      "nickname": "狮子",
      "avatar": "🦁"
    },
    "targetUserId": {
      "_id": "692fe16a962d558224f4133f",
      "nickname": "狮子",
      "avatar": "🦁"
    },
    "periodId": {
      "_id": "692fe16a962d558224f41347",
      "name": "平衡之道"
    },
    "day": 7,
    "type": "insight",
    "mediaType": "text",
    "content": "感谢你的坚持和付出",
    "imageUrl": null,
    "status": "completed",
    "source": "manual",
    "isPublished": true,
    "createdAt": "2025-12-07T01:51:19.001Z",
    "updatedAt": "2025-12-07T01:51:19.001Z"
  },
  "timestamp": 1765072279003
}
```

### 错误响应示例

#### 1. 缺少必填参数

**HTTP状态码**: `400 Bad Request`

```json
{
  "code": 400,
  "message": "缺少必填字段：targetUserId",
  "timestamp": 1765072741506
}
```

#### 2. 被看见人不存在

**HTTP状态码**: `404 Not Found`

```json
{
  "code": 404,
  "message": "被看见人不存在：ID 不存在的ID",
  "timestamp": 1765072123456
}
```

#### 3. 期次不存在

**HTTP状态码**: `404 Not Found`

```json
{
  "code": 404,
  "message": "期次不存在：不存在的期次",
  "timestamp": 1765072123456
}
```

#### 4. 用户未报名期次

**HTTP状态码**: `403 Forbidden`

```json
{
  "code": 403,
  "message": "用户 狮子 未报名期次 平衡之道",
  "timestamp": 1765072123456
}
```

#### 5. content和imageUrl都未提供

**HTTP状态码**: `400 Bad Request`

```json
{
  "code": 400,
  "message": "content 和 imageUrl 必选其一（至少填写一个）",
  "timestamp": 1765072123456
}
```

### 使用示例

#### cURL 请求

```bash
# 只包含文字内容
curl -X POST http://localhost:3000/api/v1/insights/external/create \
  -H "Content-Type: application/json" \
  -d '{
    "periodName": "平衡之道",
    "targetUserId": "692fe16a962d558224f4133f",
    "content": "狮子，我看见你在学习中的坚持",
    "day": 7
  }'

# 包含文字和图片
curl -X POST http://localhost:3000/api/v1/insights/external/create \
  -H "Content-Type: application/json" \
  -d '{
    "periodName": "心流之境",
    "targetUserId": "692fe16a962d558224f4133f",
    "content": "你在分享时表现出的深思熟虑给我留下了深刻印象",
    "imageUrl": "https://example.com/insights/photo.jpg",
    "day": 5
  }'
```

#### Python 请求

```python
import requests
import json

def create_insight(period_name, target_user_id, content, day=None, image_url=None):
    """创建小凡看见"""
    url = "http://localhost:3000/api/v1/insights/external/create"

    payload = {
        "periodName": period_name,
        "targetUserId": target_user_id,
        "content": content,
    }

    if day:
        payload["day"] = day
    if image_url:
        payload["imageUrl"] = image_url

    headers = {
        "Content-Type": "application/json"
    }

    try:
        response = requests.post(url, json=payload, headers=headers)
        response.raise_for_status()

        result = response.json()
        if result["code"] == 200:
            print("✅ 小凡看见创建成功")
            print(f"ID: {result['data']['_id']}")
            return result["data"]
        else:
            print(f"❌ 创建失败: {result['message']}")
            return None

    except requests.exceptions.RequestException as e:
        print(f"❌ 请求失败: {str(e)}")
        return None

# 使用示例
create_insight(
    period_name="平衡之道",
    target_user_id="692fe16a962d558224f4133f",
    content="感谢你的坚持和努力",
    day=7
)
```

#### Node.js 请求

```javascript
const axios = require('axios');

async function createInsight(params) {
  try {
    const response = await axios.post(
      'http://localhost:3000/api/v1/insights/external/create',
      {
        periodName: params.periodName,
        targetUserId: params.targetUserId,
        content: params.content,
        day: params.day || undefined,
        imageUrl: params.imageUrl || undefined
      },
      {
        headers: {
          'Content-Type': 'application/json'
        }
      }
    );

    if (response.data.code === 200) {
      console.log('✅ 小凡看见创建成功');
      console.log('ID:', response.data.data._id);
      return response.data.data;
    } else {
      console.error('❌ 创建失败:', response.data.message);
      return null;
    }
  } catch (error) {
    console.error('❌ 请求失败:', error.message);
    return null;
  }
}

// 使用示例
createInsight({
  periodName: '平衡之道',
  targetUserId: '692fe16a962d558224f4133f',
  content: '感谢你的坚持和努力',
  day: 7
});
```

---

## 🔌 API #2: 获取期次用户列表

### 接口说明

根据期次名称获取该期次中所有已报名的用户列表。返回用户ID和昵称信息。

### 请求信息

**HTTP方法**: `GET`

**URL**: `http://localhost:3000/api/v1/enrollments/external/users-by-period`

**查询参数**: periodName（在URL中使用）

### 请求参数

| 参数 | 类型 | 必填 | 说明 | 示例 |
|------|------|------|------|------|
| periodName | string | ✅ | 期次名称（URL编码） | `平衡之道` → `%E5%B9%B3%E8%A1%A1%E4%B9%8B%E9%81%93` |

**⚠️ 重要**: 中文字符需要进行URL编码

### 成功响应示例

**HTTP状态码**: `200 OK`

```json
{
  "code": 200,
  "message": "获取成功",
  "data": {
    "periodName": "平衡之道",
    "userCount": 5,
    "users": [
      {
        "userId": "692fe16a962d558224f4133f",
        "nickname": "狮子"
      },
      {
        "userId": "692fe16a962d558224f41340",
        "nickname": "阿泰"
      },
      {
        "userId": "692fe16a962d558224f41341",
        "nickname": "小明"
      }
    ]
  },
  "timestamp": 1765072328904
}
```

### 错误响应示例

#### 1. 缺少periodName参数

**HTTP状态码**: `400 Bad Request`

```json
{
  "code": 400,
  "message": "缺少必填字段：periodName",
  "timestamp": 1765072123456
}
```

#### 2. 期次不存在

**HTTP状态码**: `404 Not Found`

```json
{
  "code": 404,
  "message": "期次不存在：不存在的期次",
  "timestamp": 1765072123456
}
```

### 使用示例

#### cURL 请求

```bash
# 方式1: 直接在URL中使用URL编码
curl -X GET "http://localhost:3000/api/v1/enrollments/external/users-by-period?periodName=%E5%B9%B3%E8%A1%A1%E4%B9%8B%E9%81%93"

# 方式2: 使用 curl 自动编码（推荐）
curl -X GET --get "http://localhost:3000/api/v1/enrollments/external/users-by-period" \
  --data-urlencode "periodName=平衡之道"
```

#### Python 请求

```python
import requests
from urllib.parse import quote

def get_period_users(period_name):
    """获取期次用户列表"""
    url = "http://localhost:3000/api/v1/enrollments/external/users-by-period"

    params = {
        "periodName": period_name
    }

    try:
        response = requests.get(url, params=params)
        response.raise_for_status()

        result = response.json()
        if result["code"] == 200:
            data = result["data"]
            print(f"✅ 获取成功")
            print(f"期次: {data['periodName']}")
            print(f"用户数: {data['userCount']}")
            print("\n用户列表:")
            for user in data["users"]:
                print(f"  - {user['nickname']} (ID: {user['userId']})")
            return data["users"]
        else:
            print(f"❌ 获取失败: {result['message']}")
            return None

    except requests.exceptions.RequestException as e:
        print(f"❌ 请求失败: {str(e)}")
        return None

# 使用示例
get_period_users("平衡之道")
```

#### Node.js 请求

```javascript
const axios = require('axios');
const qs = require('qs');

async function getPeriodUsers(periodName) {
  try {
    const response = await axios.get(
      'http://localhost:3000/api/v1/enrollments/external/users-by-period',
      {
        params: {
          periodName: periodName
        }
      }
    );

    if (response.data.code === 200) {
      const data = response.data.data;
      console.log('✅ 获取成功');
      console.log(`期次: ${data.periodName}`);
      console.log(`用户数: ${data.userCount}`);
      console.log('\n用户列表:');
      data.users.forEach(user => {
        console.log(`  - ${user.nickname} (ID: ${user.userId})`);
      });
      return data.users;
    } else {
      console.error('❌ 获取失败:', response.data.message);
      return null;
    }
  } catch (error) {
    console.error('❌ 请求失败:', error.message);
    return null;
  }
}

// 使用示例
getPeriodUsers('平衡之道');
```

---

## 🔐 安全建议

1. **不存储敏感信息**: 这些API是公开的，不要在请求中传递敏感信息
2. **验证期次名称**: 确保期次名称完全匹配（精确匹配，区分大小写）
3. **验证用户ID**: 创建小凡看见前，确保targetUserId有效
4. **错误处理**: 始终检查响应中的 `code` 和 `message` 字段
5. **请求超时**: 建议设置适当的请求超时（如5秒）

---

## 📊 常见问题

### Q1: 期次名称如何确定？
**A**: 可以使用获取期次用户列表API，或直接咨询晨读营管理员获取准确的期次名称。

### Q2: targetUserId在哪里获取？
**A**: 可以调用获取期次用户列表API获取该期次的所有用户ID，或从用户的个人资料中获取。

### Q3: 中文参数总是报错？
**A**: 确保对中文字符进行URL编码，或使用HTTP客户端库自动编码（推荐）。

### Q4: 为什么创建小凡看见时提示"用户未报名期次"？
**A**: 确保:
   - targetUserId 对应的用户存在
   - 该用户已报名到指定的期次
   - 期次名称完全匹配

### Q5: 响应中的timestamp字段是什么？
**A**: 这是服务器生成该响应的Unix时间戳（毫秒），可用于调试和日志记录。

---

## 📞 技术支持

如有问题，请检查：

1. ✅ API URL是否正确
2. ✅ 请求参数是否完整和正确
3. ✅ 中文字符是否正确编码
4. ✅ HTTP方法是否正确（POST/GET）
5. ✅ Content-Type头部是否设置为 application/json

---

## 📝 更新日志

| 日期 | 版本 | 更新内容 |
|------|------|--------|
| 2025-12-07 | v1.0 | 初始版本，包含两个API文档 |

---

**最后更新**: 2025-12-07

**联系方式**: 请通过项目GitHub Issues联系技术支持
